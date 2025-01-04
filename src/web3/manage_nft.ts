// need to implement logic to stake and unstake nft, first jsut via api call and mongoDb and next with blockchain
import { mongo_client } from "../utils";
import { _miner_nft, _new_nft, _refiner_nft, _staked_nft, _staked_nft_base, _user_doc } from "../types/models.type";
import { Request, Response } from "express";
//user send stake demand with an array of mintAddres / first check if nft is known otherwise create it in db with base score / then stake it



export async function stake_nft(nfts: _new_nft[], walletAddress: string) {
    // TODO check if user own the nfts before in wallet
    try {
        const mint_address_array: string[] = []
        for (const nft of nfts) {
            mint_address_array.push(nft.mintAddress)
        }

        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_staked_nft>("nfts")
        const existing_nft = await collection.find({ _id: { $in: mint_address_array } }).toArray()

        const update_nft_doc: _staked_nft[] = []
        if (existing_nft.length > 0) {
            // some or all nft already exist in db
            for (const nft of existing_nft) {
                if (nft.isFrozen) continue
                const updatedNft: _staked_nft = {
                    ...nft,
                    owner: walletAddress,
                    isFrozen: true,
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
            await update_user_nft_amount(walletAddress)
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
        const collection = db.collection<_staked_nft>("nfts")
        const existing_nft = await collection.find({ _id: { $in: nfts } }).toArray()

        const update_nft_doc: _staked_nft[] = []
        if (existing_nft) {

            for (const nft of existing_nft) {
                if (nft.activeTrip || !nft.isFrozen) continue

                const updatedNft: _staked_nft = {
                    ...nft,
                    isFrozen: false

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
            await update_user_nft_amount(walletAddress)
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
            isFrozen: true,
            mintAddress: data.mintAddress!,
            type: "miner",
            owner: data.owner!,
            activeTrip: null,
            totalNuggetHarvested: 0,
            image: "",
            name: "",
            stats: {
                levelMemory: 1,
                levelHarvest: 1
            }
        }
    }
    private createRefiner(data: Partial<_refiner_nft>): _refiner_nft {
        return {
            _id: data.mintAddress!,
            isFrozen: true,
            mintAddress: data.mintAddress!,
            type: "refiner",
            owner: data.owner!,
            activeTrip: null,
            totalGoldRefined: 0,
            image: "",
            name: "",
            stats: {
                levelRefine: 1
            }
        };
    }

    getNft(): _staked_nft {
        return this.nft
    }
}

export async function get_user_nft(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user?.pubkey) {
            res.status(401).json({ message: "Unauthorized : no user found in jwt" })
        }
        const user = req.user
        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_staked_nft>("nfts")
        const owned_nft = await collection.aggregate([
            {
                $search: {
                    index: "owner",
                    text: {
                        query: user?.pubkey,
                        path: "owner"
                    }
                }
            }
        ]).toArray()

        res.json({ owned_nft })
    } catch (error) {
        res.status(500).json({ message: "Internal : Unknown error", error })
    }
}

async function update_user_nft_amount(walletAddress: string) {
    try {
        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_staked_nft>("nfts")
        const owned_nft = await collection.aggregate([
            {
                $search: {
                    index: "owner",
                    text: {
                        query: walletAddress,
                        path: "owner"
                    }
                }
            }
        ]).toArray()

        if (owned_nft.length === 0) {
            throw new Error("No staked NFT")
        } else {
            //
            const miners = owned_nft.filter((elem) => elem.type === "miner")
            const refiners = owned_nft.filter((elem) => elem.type === "refiner")
            const miners_id = miners.map((miner) => miner._id)
            const refiners_id = refiners.map((refiner) => refiner._id)

            const user_collection = db.collection<_user_doc>("users")
            const get_user_doc = await user_collection.findOne({ _id: walletAddress })

            if (!get_user_doc) {
                throw new Error("No user doc")
            } else {
                await user_collection.updateOne({ _id: walletAddress }, {
                    $set: {
                        owned_miners: miners_id,
                        owned_refiners: refiners_id,
                        data: {
                            ...get_user_doc.data,
                            totalMiners: miners.length,
                            totalRefiners: refiners.length
                        }
                    }
                })
            }
        }
    } catch (error) {
        console.error(error);
        throw error

    }
}

// TODO check why update user nft amount dont work when done just after update mongo, maybe add a delay ?