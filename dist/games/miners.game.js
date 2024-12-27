"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.send_miners_in_trip = send_miners_in_trip;
exports.test = test;
const date_fns_1 = require("date-fns");
const utils_1 = require("../utils");
/**
 * @important this value must not be changed ( 64 ) !!!
 */
const NUGGET_EMISSION_PER_HOUR_PER_MINER = 64;
const staked_miners = [
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
function manage_miners_emission(miners) {
    const now = new Date();
    for (const miner of miners) {
        const diff_in_hours = (0, date_fns_1.differenceInMilliseconds)(now, miner.startedAt) / (1000 * 60 * 60);
        if (diff_in_hours > 4) {
            // miner is active for more than 4h so can claim
            const nuggets_to_emmit = diff_in_hours * NUGGET_EMISSION_PER_HOUR_PER_MINER;
            miner.actualHarvest = miner.actualHarvest + nuggets_to_emmit * miner.levelHarvest;
            continue;
        }
        else {
            // cant claim
            continue;
        }
    }
}
function send_miners_in_trip(miners, wallet_address) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const db = (yield utils_1.mongo_client.getInstance()).db("public_data");
            const collection = db.collection("miners_in_trip");
            const doc_exist = yield collection.findOne({ _id: wallet_address });
            if (!doc_exist) {
                //create it first
                const new_miners_doc = new Miner({
                    _id: wallet_address,
                    walletAddress: wallet_address,
                    miners,
                });
                const result = yield collection.insertOne(new_miners_doc);
            }
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    });
}
function test() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const db = (yield utils_1.mongo_client.getInstance()).db("public_data");
            const collection = db.collection("miners_in_trip");
            const doc = {
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
            const result = yield collection.insertOne(doc);
        }
        catch (error) { }
    });
}
class Miner {
    constructor(data) {
        this._id = data._id;
        this.walletAddress = data.walletAddress;
        this.miners = data.miners.map((miner) => ({
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
    createUserDoc(wallet_address) {
        this._id = wallet_address;
        this.walletAddress = wallet_address;
    }
    //Add a miner
    addMiner(miner) {
        this.miners.push(Object.assign(Object.assign({}, miner), { startedAt: miner.startedAt || new Date() }));
    }
    updateMiner(mintAddress, updates) {
        const miner = this.miners.find((m) => m.mintAddress === mintAddress);
        if (!miner) {
            throw new Error("Miner not found");
        }
        Object.assign(miner, updates);
    }
}
