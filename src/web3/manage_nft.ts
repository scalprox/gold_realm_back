// need to implement logic to stake and unstake nft, first jsut via api call and mongoDb and next with blockchain
import { mongo_client } from "../utils";
import { _miner_nft, _new_nft, _refiner_nft, _staked_nft, _staked_nft_base } from "../types/models.type";

//user send stake demand with an array of mintAddres / first check if nft is known otherwise create it in db with base score / then stake it



export async function stake_nft(nfts: _new_nft[], walletAddress: string) {
    // TODO check if user own the nfts before
    try {
        const mint_address_array: string[] = []
        for (const nft of nfts) {
            mint_address_array.push(nft.mintAddress)
        }

        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_staked_nft_base>("nfts")
        const existing_nft = await collection.find({ _id: { $in: mint_address_array } }).toArray()

        const update_nft_doc: _staked_nft[] = []
        if (existing_nft) {
            // some or all nft already exist in db
            for (const nft of existing_nft) {
                if (nft.staked) continue
                const updatedNft: _staked_nft = {
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
                const create_doc = new CreateNft(nft).getNft()
                update_nft_doc.push({
                    ...create_doc
                })
            }
        } else {
            //no nft in db
            for (const nft of nfts) {
                const create_doc = new CreateNft(nft).getNft()
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

            await collection.bulkWrite(bulkOps);
        }
        return { message: "NFT Staked", error: "" }
    } catch (error) {
        console.error(error);
        throw error

    }

}

export async function unstake_nft(nfts: string[], walletAddress: string) {
    // TODO check if user own the nfts before
    try {
        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_staked_nft_base>("nfts")
        const existing_nft = await collection.find({ _id: { $in: nfts } }).toArray()

        const update_nft_doc: _staked_nft[] = []
        if (existing_nft) {

            for (const nft of existing_nft) {
                if (nft.onTrip || !nft.staked) continue

                const updatedNft: _staked_nft = {
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
        } else {
            throw new Error("No staked NFT")
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

            await collection.bulkWrite(bulkOps);
        }
        return { message: "NFT Unstaked", error: "" }
    } catch (error) {
        console.error(error);
        throw error

    }
}

class CreateNft {
    private nft: _staked_nft

    constructor(data: Pick<_staked_nft, "mintAddress" | "type" | "owner"> & Partial<_staked_nft>) {
        if (!data.mintAddress || !data.type || !data.owner) {
            throw new Error("Missing required fields: mintAddress, type, or owner");
        }

        if (data.type === "miner") {
            this.nft = this.createMiner(data as Partial<_miner_nft>)
        } else if (data.type === "refiner") {
            this.nft = this.createRefiner(data as Partial<_refiner_nft>)
        } else {
            throw new Error("Invalid type: must be 'miner' or 'refiner'");
        }
    }

    private createMiner(data: Partial<_miner_nft>): _miner_nft {
        return {
            _id: data.mintAddress!,
            staked: true,
            mintAddress: data.mintAddress!,
            type: "miner",
            owner: data.owner!,
            stakedAt: new Date(),
            unstakedAt: undefined,
            boosted: false,
            onTrip: false,
            levelHarvest: 1,
            levelMemory: 1,
            tripStartedAt: undefined,
            totalNuggetHarvested: 0,
        }
    }
    private createRefiner(data: Partial<_refiner_nft>): _refiner_nft {
        return {
            _id: data.mintAddress!,
            staked: true,
            mintAddress: data.mintAddress!,
            type: "refiner",
            owner: data.owner!,
            stakedAt: new Date(),
            unstakedAt: undefined,
            boosted: false,
            onTrip: false,
            levelRefine: 1,
            totalGoldRefined: 0,
        };
    }

    getNft(): _staked_nft {
        return this.nft
    }
}