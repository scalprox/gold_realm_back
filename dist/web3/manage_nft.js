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
exports.stake_nft = stake_nft;
exports.unstake_nft = unstake_nft;
// need to implement logic to stake and unstake nft, first jsut via api call and mongoDb and next with blockchain
const utils_1 = require("../utils");
//user send stake demand with an array of mintAddres / first check if nft is known otherwise create it in db with base score / then stake it
function stake_nft(nfts, walletAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO check if user own the nfts before
        try {
            const mint_address_array = [];
            for (const nft of nfts) {
                mint_address_array.push(nft.mintAddress);
            }
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection("nfts");
            const existing_nft = yield collection.find({ _id: { $in: mint_address_array } }).toArray();
            const update_nft_doc = [];
            if (existing_nft) {
                // some or all nft already exist in db
                for (const nft of existing_nft) {
                    if (nft.staked)
                        continue;
                    const updatedNft = {
                        _id: nft._id,
                        type: nft.type,
                        mintAddress: nft.mintAddress,
                        owner: walletAddress,
                        staked: true,
                        unstakedAt: undefined,
                        stakedAt: new Date(),
                        boosted: false,
                        onTrip: false,
                    };
                    update_nft_doc.push(updatedNft);
                }
                const existing_ids = new Set(existing_nft.map((nft) => nft._id));
                const unknown_nft = nfts.filter((obj) => !existing_ids.has(obj.mintAddress));
                for (const nft of unknown_nft) {
                    const create_doc = new CreateNft(nft).getNft();
                    update_nft_doc.push(Object.assign({}, create_doc));
                }
            }
            else {
                //no nft in db
                for (const nft of nfts) {
                    const create_doc = new CreateNft(nft).getNft();
                    if (!update_nft_doc.some(doc => doc._id === create_doc._id)) {
                        update_nft_doc.push(create_doc);
                    }
                }
            }
            //update db
            if (update_nft_doc.length > 0) {
                const bulkOps = update_nft_doc.map(doc => ({
                    updateOne: {
                        filter: { _id: doc._id },
                        update: { $set: doc },
                        upsert: true,
                    }
                }));
                yield collection.bulkWrite(bulkOps);
            }
            return { message: "NFT Staked", error: "" };
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    });
}
function unstake_nft(nfts, walletAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO check if user own the nfts before
        try {
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection("nfts");
            const existing_nft = yield collection.find({ _id: { $in: nfts } }).toArray();
            const update_nft_doc = [];
            if (existing_nft) {
                for (const nft of existing_nft) {
                    if (nft.onTrip || !nft.staked)
                        continue;
                    const updatedNft = {
                        _id: nft._id,
                        type: nft.type,
                        mintAddress: nft.mintAddress,
                        owner: walletAddress,
                        staked: false,
                        unstakedAt: new Date(),
                        stakedAt: undefined,
                        boosted: false,
                        onTrip: false,
                    };
                    update_nft_doc.push(updatedNft);
                }
            }
            else {
                throw new Error("No staked NFT");
            }
            //update db
            if (update_nft_doc.length > 0) {
                const bulkOps = update_nft_doc.map(doc => ({
                    updateOne: {
                        filter: { _id: doc._id },
                        update: { $set: doc },
                        upsert: true,
                    }
                }));
                yield collection.bulkWrite(bulkOps);
            }
            return { message: "NFT Unstaked", error: "" };
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    });
}
class CreateNft {
    constructor(data) {
        if (!data.mintAddress || !data.type || !data.owner) {
            throw new Error("Missing required fields: mintAddress, type, or owner");
        }
        if (data.type === "miner") {
            this.nft = this.createMiner(data);
        }
        else if (data.type === "refiner") {
            this.nft = this.createRefiner(data);
        }
        else {
            throw new Error("Invalid type: must be 'miner' or 'refiner'");
        }
    }
    createMiner(data) {
        return {
            _id: data.mintAddress,
            staked: true,
            mintAddress: data.mintAddress,
            type: "miner",
            owner: data.owner,
            stakedAt: new Date(),
            unstakedAt: undefined,
            boosted: false,
            onTrip: false,
            levelHarvest: 1,
            levelMemory: 1,
            tripStartedAt: undefined,
            totalNuggetHarvested: 0,
        };
    }
    createRefiner(data) {
        return {
            _id: data.mintAddress,
            staked: true,
            mintAddress: data.mintAddress,
            type: "refiner",
            owner: data.owner,
            stakedAt: new Date(),
            unstakedAt: undefined,
            boosted: false,
            onTrip: false,
            levelRefine: 1,
            totalGoldRefined: 0,
        };
    }
    getNft() {
        return this.nft;
    }
}
