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
import { _staked_miners, _miners_on_trip } from "../types/models.type";
import { differenceInMilliseconds } from "date-fns";
import { mongo_client } from "../utils";

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

export async function send_miners_in_trip(miners: [_staked_miners], wallet_address: string) {
  try {
    const db = (await mongo_client.getInstance()).db("public_data");
    const collection = db.collection<_miners_on_trip>("miners_in_trip");
    const doc_exist = await collection.findOne({ _id: wallet_address });

    if (!doc_exist) {
      //create it first
      const new_miners_doc = new Miner({
        _id: wallet_address,
        walletAddress: wallet_address,
        miners,
      });
      const result = await collection.insertOne(new_miners_doc);
    }
  } catch (error) {
    console.error(error);

    throw error;
  }
}

export async function test(): Promise<void> {
  try {
    const db = (await mongo_client.getInstance()).db("public_data");
    const collection = db.collection<_miners_on_trip>("miners_in_trip");

    const doc: _miners_on_trip = {
      _id: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
      walletAddress: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
      miners: [
        {
          owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
          mintAddress: "abcde123456",
          levelHarvest: 1,
          levelMemory: 1,
          boosted: false,
          startedAt: new Date(),
          actualHarvest: 0,
          onTrip: false,
        },
      ],
    };
    const result = await collection.insertOne(doc);
  } catch (error) { }
}

class Miner implements _miners_on_trip {
  _id: string;
  walletAddress: string;
  miners: _staked_miners[];

  constructor(data: _miners_on_trip) {
    this._id = data._id;
    this.walletAddress = data.walletAddress;
    this.miners = data.miners.map((miner: _staked_miners) => ({
      owner: miner.owner,
      mintAddress: miner.mintAddress,
      levelHarvest: miner.levelHarvest || 1,
      levelMemory: miner.levelMemory || 1,
      boosted: miner.boosted || false,
      startedAt: miner.startedAt,
      actualHarvest: miner.actualHarvest || 0,
      onTrip: miner.onTrip || false,
    }));
  }

  //create doc miners_on_trip in db
  createUserDoc(wallet_address: string) {
    this._id = wallet_address;
    this.walletAddress = wallet_address;
  }

  //Add a miner
  addMiner(miner: _staked_miners) {
    this.miners.push({
      ...miner,
      startedAt: miner.startedAt || new Date(),
    });
  }

  updateMiner(mintAddress: string, updates: _staked_miners) {
    const miner = this.miners.find((m) => m.mintAddress === mintAddress);
    if (!miner) {
      throw new Error("Miner not found");
    }
    Object.assign(miner, updates);
  }
}
