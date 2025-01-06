/**
 * 1. Need to get all staked nft in th mines
 * 2. 1 epoch is 15min - capped distribution is 93.750 nugget per epoch - but capped to miner a miner earn with basic stats an average of 9 nugget per epoch.
 * 3. each epoch check if user still in mines and calc his income.
 * 4. if user claim the Nuggets, draw the issue of his trip ( success / unsuccess / get lost / dead...)
 *
 * usefull info
 * - 40% to found Nuggets in the first 4h after thats     growing to 50% to 8h          and growing to 60% to 12h and more
 * - 50% to found nothing in the first 4h                 decreasing to 30%             and decresing to 0% to 12h and more
 * - 10% chance to be stuck in the mines during first 4h. growing to 19.9990% to 8h     and growing to 39.990% to 12h and more
 * - 0% chance to be perma stuck in mine (BURN)           growing to 0.001%   to 8h     and growing to 0.01% to 12h and more
 */
import { _staked_miners, _staked_nft, _miners_on_trip, _trip_interaction, _db_trip_data_doc, _db_foundry_data_doc__default, _db_mine_data_doc__default, _active_trip } from "../types/models.type";
import { differenceInMilliseconds } from "date-fns";
import { mongo_client } from "../utils";
import { Request, Response } from "express";
import { Collection } from "mongodb";

/**
 * @important this value must not be changed ( 64 ) !!!
 */
const NUGGET_EMISSION_PER_HOUR_PER_MINER: number = 64;

const staked_miners: _staked_miners[] = [
  {
    owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
    mintAddress: "abcde123456",
    levelHarvest: 1,
    levelMemory: 1,
    boosted: false,
    startedAt: new Date("Tue Dec 10 2024 22:04:41 GMT+0100 (heure normale d’Europe centrale)"),
    actualHarvest: 0,
    onTrip: false,
  },
];

function manage_miners_emission(miners: _staked_miners[]): void {
  const now = new Date();
  for (const miner of miners) {
    const diff_in_hours: number = differenceInMilliseconds(now, miner.startedAt) / (1000 * 60 * 60);
    if (diff_in_hours > 4) {
      // miner is active for more than 4h so can claim
      const nuggets_to_emmit: number = diff_in_hours * NUGGET_EMISSION_PER_HOUR_PER_MINER;
      miner.actualHarvest = miner.actualHarvest + nuggets_to_emmit * miner.levelHarvest;

      continue;
    } else {
      // cant claim
      continue;
    }
  }
}

export async function send_nfts_to_trip(req: Request, res: Response): Promise<void> {
  try {
    const { nfts, location }: _trip_interaction = req.body // array of mint address and location
    const user = req.user
    const db_priv = (await mongo_client.getInstance()).db("private_data")
    const db_public = (await mongo_client.getInstance()).db("public_data")
    const collection_nfts = db_priv.collection<_staked_nft>("nfts")
    const collection_trips = location === "mine" ? db_public.collection<_db_trip_data_doc>("mine_data") : db_public.collection<_db_trip_data_doc>("foundry_data")
    const get_nfts = await collection_nfts.find({ _id: { $in: nfts } }).toArray()

    if (get_nfts.length === 0) {
      res.status(404).json({ message: "No nft found", error: "" })
      return
    }

    const tripPromises = get_nfts.map(async (nft) => {
      // check if user own the nft
      if (nft.owner !== user?.pubkey) {
        throw new Error(`User (${user?.pubkey}) doesn't own NFT (${nft._id})`);
      }
      // check if nft is not already in a trip
      if (nft.isOnTrip) {
        throw new Error(`NFT (${nft._id}) is already in a trip`);
      }
      // check if nft is staked
      if (!nft.isFrozen) {
        throw new Error(`NFT (${nft._id}) is not frozen`);
      }
      // check if nft can access this location
      if (nft.type === "miner" && location !== "mine" || nft.type === "refiner" && location !== "foundry") {
        throw new Error(`${nft.type} (${nft._id}) cannot access (${location})`);
      }

      return Trip.create(nft.owner, nft._id, location);
    });

    const nft_ready_to_send = await Promise.all(tripPromises);

    const send_trip = await collection_trips.insertMany(nft_ready_to_send);
    // je bloque ici ↓↓
    if (send_trip) {
      const update_nft = nft_ready_to_send.map(obj => ({
        updateOne: {
          filter: { _id: obj.nftId },
          update: {
            $set: {
              activeTrip: <_active_trip>{
                tripId: obj._id,
                startedAt: obj.startedAt,
                endedAt: null,
                currentEmission: obj.currentEmission,
                claimed: obj.claimed,
                owner: obj.owner,
                isLost: obj.isLost,
                lostUntil: obj.lostUntil,
                isStucked: obj.isStucked
              }
            }
          }
        }
      }))

      await collection_nfts.bulkWrite(update_nft)
    }

    res.json({ message: "Success" })

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : "Unknown" });
  }
}

//class

class Trip implements _db_trip_data_doc {
  _id!: number;
  nftId!: string
  owner!: string
  currentEmission!: number;
  claimedEmission!: number;
  startedAt!: Date;
  claimedAt!: Date | null;
  claimed!: boolean;
  isLost!: boolean;
  isStucked!: boolean;
  lostUntil!: Date | null;

  private constructor(data: _db_trip_data_doc) {
    Object.assign(this, data)
  }

  static async create(owner: string, nftId: string, location: "mine" | "foundry"): Promise<Trip> {
    // Start a trip
    const tripId = await Trip.generateTripId(location)
    const tripData: _db_trip_data_doc = {
      _id: tripId,
      nftId,
      owner,
      currentEmission: 0,
      claimedEmission: 0,
      startedAt: new Date(),
      claimedAt: null,
      claimed: false,
      isLost: false,
      isStucked: false,
      lostUntil: null,
    }
    return new Trip(tripData)
  }

  static async claim(trips: { owner: string, nftId: string }[], location: "mine" | "foundry") {
    // Claim trips
    const db = (await mongo_client.getInstance()).db("public_data")
    const collection = db.collection<_db_trip_data_doc>(`${location}_data`)

  }

  private static async generateTripId(location: "mine" | "foundry"): Promise<number> {
    // generate a tripId
    const db = (await mongo_client.getInstance()).db("public_data");
    const collection = location === "mine" ? db.collection<_db_mine_data_doc__default>("mine_data") : db.collection<_db_foundry_data_doc__default>("foundry_data")

    const result = await (collection as Collection<_db_foundry_data_doc__default | _db_mine_data_doc__default>).findOneAndUpdate(
      { _id: "default" },
      { $inc: { currentTripId: 1 } }, // Incrémente atomiquement
      { returnDocument: "after", upsert: true }
    );
    if (result === null) {
      throw new Error("Unable to get a tripId")
    }
    return result.currentTripId; // Retourne le nouveau tripId
  }

}

const test = Trip.create("", "", "mine")