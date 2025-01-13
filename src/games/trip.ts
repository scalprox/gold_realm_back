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
import { _miner_trip_outcome, _claim_response_payload, _staked_miners, _staked_nft, _miners_on_trip, _trip_interaction, _db_trip_data_doc, _db_foundry_data_doc__default, _db_mine_data_doc__default, _active_trip, _miner_nft, _user_doc } from "../types/models.type";
import { differenceInHours, differenceInMilliseconds, addHours } from "date-fns";
import { mongo_client } from "../utils";
import { Request, Response } from "express";
import { Collection } from "mongodb";
import { randomInt } from "node:crypto";
import { createError } from "../utils/errorUtils";
import { createResponse } from "../utils/responseUtils";

/**
 * @important this values must not be changed !!!
 */
const NUGGET_EMISSION_PER_EPOCH_PER_MINER: number = 16;
/**
 * @important this values must not be changed !!!
 */
const EPOCH_DURATION = 15 * 60 * 1000
/**
 * @important this values must not be changed !!!
 */
const CHANCE_BY_HOURS = [
  { hours: 0, success: 0, nothing: 100, lost: 0, stuck: 0 },
  { hours: 4, success: 50, nothing: 45, lost: 5, stuck: 0 },
  { hours: 8, success: 59.009, nothing: 30, lost: 10, stuck: 0.001 },
  { hours: 12, success: 69.09, nothing: 0, lost: 30, stuck: 0.01 },
];

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

function manage_miner_emission(trip: _db_trip_data_doc): number {
  const now = new Date();
  const dif_in_mill = differenceInMilliseconds(now, trip.startedAt)
  const proportion = parseFloat(Math.min(dif_in_mill / EPOCH_DURATION, 1).toFixed(3))
  const emission = NUGGET_EMISSION_PER_EPOCH_PER_MINER * proportion * trip.nftStats.multiplier
  trip.currentEmission = trip.currentEmission + emission

  return trip.currentEmission

}

type TripOutcome = "success" | "nothing" | "lost" | "stuck"
export function roll_miner_claim_event(trip: _db_trip_data_doc): _db_trip_data_doc {
  const now = new Date()
  const diff_in_hour = parseFloat((differenceInMilliseconds(now, trip.startedAt) / (1000 * 60 * 60)).toFixed(2))


  // check if user can claim first

  if (trip.claimed) {
    throw new Error("Trip already claimed")
  }
  if (trip.isLost) {
    throw new Error("Miner is still lost")
  }
  if (diff_in_hour < 4) {
    throw new Error("You need to wait 4h before claiming")
  }

  const chances = interpolateChances(diff_in_hour)
  console.log(chances);


  const event_result = getRandomOutcome(chances)

  switch (event_result) {
    case "success":
      trip.claimed = true
      trip.claimedAt = now
      trip.claimedEmission = manage_miner_emission(trip)
      trip.claimEvent = "success"
      return trip

    case "nothing":
      trip.claimed = true
      trip.claimedAt = now
      trip.claimedEmission = 0
      trip.currentEmission = 0
      trip.claimEvent = "nothing"
      return trip
    case "lost":
      trip.claimed = true
      trip.claimedEmission = 0
      trip.currentEmission = 0
      trip.claimedAt = now
      trip.isLost = true
      trip.lostUntil = calculateLostUntil()
      trip.claimEvent = "lost"
      return trip
    case "stuck":
      trip.claimed = true
      trip.claimedEmission = 0
      trip.currentEmission = 0
      trip.claimedAt = now
      trip.isStucked = true
      trip.claimEvent = "stucked"
      return trip
  }

  function calculateLostUntil(): Date {
    const now = Date.now()
    return addHours(now, 1)
  }

  function interpolateChances(durationTime: number): _miner_trip_outcome {
    const lastPoint = CHANCE_BY_HOURS[CHANCE_BY_HOURS.length - 1];

    if (durationTime >= lastPoint.hours) {
      return {
        success: lastPoint.success,
        nothing: lastPoint.nothing,
        lost: lastPoint.lost,
        stuck: lastPoint.stuck,
      };
    }

    const prevPoint =
      CHANCE_BY_HOURS.find(
        (p, i, arr) =>
          durationTime >= p.hours && durationTime < (arr[i + 1]?.hours || Infinity)
      ) || lastPoint;

    const nextPoint =
      CHANCE_BY_HOURS[CHANCE_BY_HOURS.indexOf(prevPoint) + 1] || prevPoint;

    const hoursDiff = nextPoint.hours - prevPoint.hours;
    const proportion =
      hoursDiff !== 0 ? (durationTime - prevPoint.hours) / hoursDiff : 0;

    const rawChances = {
      success: prevPoint.success + proportion * (nextPoint.success - prevPoint.success),
      nothing: prevPoint.nothing + proportion * (nextPoint.nothing - prevPoint.nothing),
      lost: prevPoint.lost + proportion * (nextPoint.lost - prevPoint.lost),
      stuck: prevPoint.stuck + proportion * (nextPoint.stuck - prevPoint.stuck),
    };

    const total = rawChances.success + rawChances.nothing + rawChances.lost + rawChances.stuck;

    if (total === 0) {
      throw new Error("Total chances cannot be zero. Check your data.");
    }

    return {
      success: (rawChances.success / total) * 100,
      nothing: (rawChances.nothing / total) * 100,
      lost: (rawChances.lost / total) * 100,
      stuck: (rawChances.stuck / total) * 100,
    };
  }



  function getRandomOutcome(chances: _miner_trip_outcome): TripOutcome {
    const total = chances.success + chances.nothing + chances.lost + chances.stuck;
    const random = randomInt(0, Math.floor(total * 1000)) / 1000

    if (random <= chances.success) return "success"
    if (random <= chances.success + chances.nothing) return "nothing"
    if (random <= chances.success + chances.nothing + chances.lost) return "lost"
    return "stuck"
  }
}

export async function update_mine_emission() {
  // scheduled : update emission of each nft every 15min
  try {
    const db_public = (await mongo_client.getInstance()).db("public_data")
    const db_private = (await mongo_client.getInstance()).db("private_data")
    const collection_mine_data = db_public.collection<_db_trip_data_doc>("mine_data")
    const collection_nfts = db_private.collection<_staked_nft>("nfts")
    const active_trip = await collection_mine_data.aggregate<_db_trip_data_doc>([
      {
        $match: {
          claimed: false, // Recherche les documents où claimed est false (booléen)
        },
      },
    ]).toArray();

    for (const trip of active_trip) {
      const emission = manage_miner_emission(trip)
      trip.currentEmission = emission
    }

    const bulkOpsTrip = active_trip.map(trip => {
      return {
        updateOne: {
          filter: { _id: trip._id },
          update: { $set: { currentEmission: trip.currentEmission } },
          upsert: false,
        },
      };
    });

    const bulkOpsNft = active_trip.map(trip => {
      return {
        updateOne: {
          filter: { _id: trip.nftId },
          update: {
            $set: {
              "activeTrip.currentEmission": trip.currentEmission
            }
          },
          upsert: false,
        }
      }
    })

    if (bulkOpsTrip.length > 0) {
      await collection_mine_data.bulkWrite(bulkOpsTrip);

      if (bulkOpsNft.length > 0) {
        await collection_nfts.bulkWrite(bulkOpsNft)
      }
    }

  } catch (error) {
    throw error

  }

}

// TODO MANAGE REFINER EMISSION


export async function claim_mine_trip(req: Request, res: Response): Promise<void> {
  try {
    const { location }: _trip_interaction = req.body
    const user = req.user
    const get_nfts = req.nftList.toClaim || null
    const get_lost_nfts = req.nftList.lostNft || null
    const db_public = (await mongo_client.getInstance()).db("public_data")
    const db_priv = (await mongo_client.getInstance()).db("private_data")
    const collection_trips = location === "mine" ? db_public.collection<_db_trip_data_doc>("mine_data") : db_public.collection<_db_trip_data_doc>("foundry_data")
    const collection_nfts = db_priv.collection<_staked_nft>("nfts")
    const response_payload: _claim_response_payload = {
      lost_claimed: [],
      success_claimed: []
    }

    if (!user) {
      throw new Error("Unable to get user data")
    }

    if (get_nfts?.length === 0 && get_lost_nfts?.length === 0) {
      res.status(404).json(createError({ type: "nft", code: "NFT_NOT_FOUND" }))
      return
    }

    //update lost nfts
    if (get_lost_nfts && get_lost_nfts.length !== 0) {
      const lostNftPromise = get_lost_nfts.map((nft) => {
        return claimLost(nft)
      })

      if (lostNftPromise && lostNftPromise?.length > 0) {
        const prepare_nft_doc = lostNftPromise.map(obj => ({
          updateOne: {
            filter: { _id: obj?._id },
            update: {
              $set: {
                activeTrip: obj?.activeTrip,
                isOnTrip: obj?.isOnTrip
              }
            }
          }
        }))

        const update_lost_nft = await collection_nfts.bulkWrite(prepare_nft_doc)
        if (!update_lost_nft) {
          throw new Error("Unable to claim lost nft")
        }
        // update response payload
        for (const nft of lostNftPromise) {
          if (nft) {
            response_payload.lost_claimed?.push({ nftId: nft._id, nftName: nft.name })
          }
        }

      }
    }

    // update trip
    if (get_nfts && get_nfts.length !== 0) {
      const tripPromise = get_nfts.map(async (nft) => {
        return Trip.claim(nft.owner, nft, location)
      })
      const trip_ready_to_claim = await Promise.all(tripPromise)

      const prepare_doc = trip_ready_to_claim.map(obj => ({
        updateOne: {
          filter: { _id: obj?._id },
          update: {
            $set: <_db_trip_data_doc>{
              ...obj
            }
          }
        }
      }))

      const claim_trip = await collection_trips.bulkWrite(prepare_doc)
      if (!claim_trip) {
        throw new Error("Unable to claim")
      }
      //update response payload
      for (const trip of trip_ready_to_claim) {
        if (trip && trip.claimEvent !== null) {
          response_payload.success_claimed?.push({
            event: trip.claimEvent,
            claimAmount: trip.claimedEmission,
            nftId: trip.nftId,
            nftName: trip.nftName
          })
        }
      }

      // now update nfts
      const updated_nft = trip_ready_to_claim.map(obj => {
        const relatedNft = get_nfts.find(nft => nft.mintAddress === obj?.nftId);

        if (!obj) {
          throw new Error("Unable to update nft")
        }

        if (!relatedNft) {
          throw new Error(`NFT not found for mintAddress ${obj?.nftId}`);
        }

        const totalHarvested =
          "totalNuggetHarvested" in relatedNft && typeof relatedNft.totalNuggetHarvested === "number"
            ? relatedNft.totalNuggetHarvested
            : 0;

        const activeTripUpdate =
          obj.isStucked || obj.isLost
            ? {
              tripId: relatedNft.activeTrip?.tripId || obj._id,
              startedAt: relatedNft.activeTrip?.startedAt || obj.startedAt,
              claimed: obj.claimed,
              owner: obj.owner,
              isLost: obj.isLost,
              endedAt: obj.claimedAt,
              currentEmission: obj.currentEmission,
              lostUntil: obj.lostUntil,
              isStucked: obj.isStucked,
            }
            : null;

        return {
          updateOne: {
            filter: { _id: obj.nftId },
            update: {
              $set: {
                isOnTrip: obj.isStucked || obj.isLost,
                activeTrip: activeTripUpdate,
                totalNuggetHarvested: totalHarvested + (obj?.claimedEmission || 0),
              },
            },
          },
        };
      });

      const update_nfts = await collection_nfts.bulkWrite(updated_nft)
      if (!update_nfts) {
        throw new Error("Unable to claim")
      }

      // and then update the nugget balance of user
      await update_user_nugget_data(trip_ready_to_claim.filter(elem => typeof elem !== "undefined"), user.pubkey)

    }
    res.json(createResponse({ message: "success", data: response_payload }))

  } catch (error) {
    console.error(error);
    res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
  }
}

async function update_user_nugget_data(trip: _db_trip_data_doc[], owner: string) {
  const db = (await mongo_client.getInstance()).db("private_data")
  const collection = db.collection<_user_doc>("users")
  const filter_trip = trip.filter(trip => trip.owner === owner && trip.claimedEmission !== null)
  const totalSumEmission = filter_trip.reduce((acc, item) => acc + item.claimedEmission!, 0)
  await collection.findOneAndUpdate(
    { _id: owner },
    { $inc: { "data.nuggetsBalance": totalSumEmission, "data.allTimeNuggets": totalSumEmission } }, // Incrémente atomiquement
    { upsert: false }
  )

}

function claimLost(nft: _staked_nft) {

  if (nft.activeTrip?.isLost && nft.activeTrip?.lostUntil) {
    //is lost
    const now = new Date()
    const lostUntil = new Date(nft.activeTrip.lostUntil)
    if (now > lostUntil) {
      //is claimable
      nft.activeTrip = null
      nft.isOnTrip = false
      return nft
    } else return
  } else return
}

export async function send_nfts_to_trip(req: Request, res: Response): Promise<void> {
  try {
    const { location }: _trip_interaction = req.body // array of mint address and location
    const user = req.user
    const get_nfts = req.nftList.toSend
    const db_priv = (await mongo_client.getInstance()).db("private_data")
    const db_public = (await mongo_client.getInstance()).db("public_data")
    const collection_nfts = db_priv.collection<_staked_nft>("nfts")
    const collection_trips = location === "mine" ? db_public.collection<_db_trip_data_doc>("mine_data") : db_public.collection<_db_trip_data_doc>("foundry_data")

    if (!get_nfts || get_nfts.length === 0) {
      res.status(404).json(createError({ type: "nft", code: "NFT_NOT_FOUND" }))
      return
    }

    const tripPromises = get_nfts.map(async (nft) => {
      return Trip.create(nft, location);
    });

    const trip_ready_to_send = await Promise.all(tripPromises);

    const send_trip = await collection_trips.insertMany(trip_ready_to_send);

    if (send_trip) {
      const update_nft = trip_ready_to_send.map(obj => ({
        updateOne: {
          filter: { _id: obj.nftId },
          update: {
            $set: <_staked_nft>{
              isOnTrip: true,
              activeTrip: {
                tripId: obj._id,
                startedAt: obj.startedAt,
                endedAt: null,
                currentEmission: obj.currentEmission,
                claimed: obj.claimed,
                owner: obj.owner,
                isLost: obj.isLost,
                lostUntil: obj.lostUntil,
                isStucked: obj.isStucked,

              }
            }
          }
        }
      }))

      await collection_nfts.bulkWrite(update_nft)
    }

    res.json(createResponse({ message: "Success", data: {} }))

  } catch (error) {
    console.error(error);
    res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
  }
}

//class

class Trip implements _db_trip_data_doc {
  _id!: number;
  nftId!: string
  nftName!: string;
  owner!: string
  currentEmission!: number;
  claimedEmission!: number;
  startedAt!: Date;
  claimedAt!: Date | null;
  claimed!: boolean;
  isLost!: boolean;
  isStucked!: boolean;
  lostUntil!: Date | null;
  claimEvent!: "success" | "nothing" | "lost" | "stucked" | null;
  nftStats!: { multiplier: number; memory: number | null; };

  private constructor(data: _db_trip_data_doc) {
    Object.assign(this, data)
  }

  static async create(nft: _staked_nft, location: "mine" | "foundry"): Promise<Trip> {
    // Start a trip
    const tripId = await Trip.getTripId(location)
    const tripData: _db_trip_data_doc = {
      _id: tripId,
      nftId: nft.mintAddress,
      nftName: nft.name,
      owner: nft.owner,
      currentEmission: 0,
      claimedEmission: 0,
      startedAt: new Date(),
      claimedAt: null,
      claimed: false,
      isLost: false,
      isStucked: false,
      lostUntil: null,
      claimEvent: null,
      nftStats: {
        multiplier: nft.stats.harvestMultiplier,
        memory: nft.stats.memory
      }

    }
    return new Trip(tripData)
  }

  static async claim(owner: string, nft: _staked_nft, location: "mine" | "foundry") {
    // Claim trips
    // TODO add the claim logic like bad event etc
    try {
      const db = (await mongo_client.getInstance()).db("public_data")
      const collection = db.collection<_db_trip_data_doc>(`${location}_data`)
      const get_trip = await collection.findOne({ _id: nft.activeTrip?.tripId })

      if (get_trip) {

        const finishedTrip: _db_trip_data_doc = roll_miner_claim_event(get_trip)
        await this.update_location(location)
        return new Trip(finishedTrip)

      }
    } catch (error) {
      throw error
    }

  }

  private static async update_location(location: "mine" | "foundry"): Promise<void> {
    const db = (await mongo_client.getInstance()).db("public_data");
    const collection = location === "mine" ? db.collection<_db_mine_data_doc__default>("mine_data") : db.collection<_db_foundry_data_doc__default>("foundry_data")
    const totalNftParameter = location === "mine" ? "totalMiners" : "totalRefiners"
    const result = await (collection as Collection<_db_foundry_data_doc__default | _db_mine_data_doc__default>).findOneAndUpdate(
      { _id: "default" },
      { $inc: { [totalNftParameter]: -1 } }, // Incrémente atomiquement
      { returnDocument: "after", upsert: false }
    );
    if (result === null) {
      throw new Error("Unable to get a tripId")
    }
    return
  }

  private static async getTripId(location: "mine" | "foundry"): Promise<number> {
    // generate a tripId
    const db = (await mongo_client.getInstance()).db("public_data");
    const collection = location === "mine" ? db.collection<_db_mine_data_doc__default>("mine_data") : db.collection<_db_foundry_data_doc__default>("foundry_data")
    const totalNftParameter = location === "mine" ? "totalMiners" : "totalRefiners"
    const result = await (collection as Collection<_db_foundry_data_doc__default | _db_mine_data_doc__default>).findOneAndUpdate(
      { _id: "default" },
      { $inc: { currentTripId: 1, [totalNftParameter]: 1 } }, // Incrémente atomiquement
      { returnDocument: "after", upsert: false }
    );
    if (result === null) {
      throw new Error("Unable to get a tripId")
    }
    return result.currentTripId; // Retourne le nouveau tripId
  }

}


const test_data: _db_trip_data_doc = {
  _id: 1,
  nftId: "acerefghteth",
  nftName: "test",
  owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
  currentEmission: 0,
  claimedEmission: 0,
  startedAt: new Date("2025-01-08T10:25:54.422+00:00"),
  claimedAt: null,
  claimed: false,
  isLost: false,
  isStucked: false,
  lostUntil: null,
  claimEvent: null,
  nftStats: {
    multiplier: 1,
    memory: 1
  }
}