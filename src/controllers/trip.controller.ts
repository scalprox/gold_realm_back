import { _trip_interaction, _staked_nft, _db_trip_data_doc } from "../types/models.type";
import { Request, Response, NextFunction } from "express";
import { mongo_client } from "../utils";

export async function validate_send_request(req: Request, res: Response, next: NextFunction) {
    try {
        const { nfts, location }: _trip_interaction = req.body
        const user = req.user
        const db_priv = (await mongo_client.getInstance()).db("private_data")
        const collection_nfts = db_priv.collection<_staked_nft>("nfts")
        const get_nfts = await collection_nfts.find({ _id: { $in: nfts } }).toArray()

        if (get_nfts.length === 0) {
            res.status(404).json({ message: "No nft found", error: "" })
            return
        }

        for (const nft of get_nfts) {
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
        }

        req.nftList = get_nfts
        next()

    } catch (error) {
        if (error instanceof Error) {
            res.send(500).json({ message: "Unable to send nft(s)", error: error.message })
        } else {
            res.send(500).json({ message: "unknown error", error: error })
        }
    }
}

export async function validate_claim_request(req: Request, res: Response, next: NextFunction) {
    try {
        const { nfts, location }: _trip_interaction = req.body
        const user = req.user
        const db_priv = (await mongo_client.getInstance()).db("private_data")
        const collection_nfts = db_priv.collection<_staked_nft>("nfts")
        const get_nfts = await collection_nfts.find({ _id: { $in: nfts } }).toArray()

        if (get_nfts.length === 0) {
            res.status(404).json({ message: "No nft found", error: "" })
            return
        }

        for (const nft of get_nfts) {
            // check if user own the nft
            if (nft.owner !== user?.pubkey) {
                throw new Error(`User (${user?.pubkey}) doesn't own NFT (${nft._id})`);
            }
            // check if nft is not already in a trip
            if (!nft.isOnTrip) {
                throw new Error(`NFT (${nft._id}) is not in a trip`);
            }
            // check if nft is staked
            if (!nft.isFrozen) {
                throw new Error(`NFT (${nft._id}) is not frozen`);
            }
            // check if nft can access this location
            if (nft.type === "miner" && location !== "mine" || nft.type === "refiner" && location !== "foundry") {
                throw new Error(`${nft.type} (${nft._id}) cannot access (${location})`);
            }
        }

        req.nftList = get_nfts
        next()

    } catch (error) {
        if (error instanceof Error) {
            res.send(500).json({ message: "Unable to claim nft(s)", error: error.message })
        } else {
            res.send(500).json({ message: "unknown error", error: error })
        }
    }
}