import { _trip_interaction, _staked_nft, _db_trip_data_doc, _db_foundry_data_doc__default, _db_mine_data_doc__default } from "../types/models.type";
import { Request, Response, NextFunction } from "express";
import { mongo_client } from "../utils";
import { createError } from "../utils/errorUtils";
import { createResponse } from "../utils/responseUtils";
import { differenceInHours, DifferenceInHoursOptions } from "date-fns";

export async function validate_send_request(req: Request, res: Response, next: NextFunction) {
    try {
        const { nfts, location }: _trip_interaction = req.body
        const user = req.user
        const db_priv = (await mongo_client.getInstance()).db("private_data")
        const collection_nfts = db_priv.collection<_staked_nft>("nfts")
        const get_nfts = await collection_nfts.find({ _id: { $in: nfts } }).toArray()

        if (get_nfts.length === 0) {
            res.status(404).json(createError({ type: "nft", code: "NFT_NOT_FOUND" }))
            return
        }

        for (const nft of get_nfts) {
            // check if user own the nft
            if (nft.owner !== user?.pubkey) {
                res.status(400).json(createError({ type: "nft", code: "WRONG_OWNER", detail: new Error(`'${user?.pubkey}' don't own '${nft._id}'`) }))
                return
            }
            // check if nft is not already in a trip
            if (nft.isOnTrip) {
                res.status(400).json(createError({ type: "trip", code: "MINER_ALREADY_IN_TRIP", detail: new Error(`'${nft._id}' already in trip`) }))
                return
            }
            // check if nft is staked
            if (!nft.isFrozen) {
                res.status(400).json(createError({ type: "nft", code: "NFT_NOT_FROZEN", detail: new Error(`'${nft._id}' not frozen`) }))
                return
            }
            // check if nft can access this location
            if (nft.type === "miner" && location !== "mine" || nft.type === "refiner" && location !== "foundry") {
                res.status(400).json(createError({ type: "trip", code: "WRONG_LOCATION", detail: new Error(`'${nft._id}' cannot be sent to ${location}`) }))
                return
            }
        }

        req.nftList = { toSend: get_nfts }
        next()

    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
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
            res.status(404).json(createError({ type: "nft", code: "NFT_NOT_FOUND" }))
            return
        }

        const lost_nfts: _staked_nft[] = []
        const to_claim_nfts: _staked_nft[] = []

        for (const nft of get_nfts) {
            // check if user own the nft
            if (nft.owner !== user?.pubkey) {
                res.status(400).json(createError({ type: "nft", code: "WRONG_OWNER", detail: new Error(`'${user?.pubkey}' don't own '${nft._id}'`) }))
                return
            }
            // check if nft is not on trip
            if (!nft.isOnTrip) {
                res.status(400).json(createError({ type: "trip", code: "MINER_NOT_IN_TRIP", detail: new Error(`'${nft._id}' not in trip`) }))
                return
            }
            // check if nft is staked
            if (!nft.isFrozen) {
                res.status(400).json(createError({ type: "nft", code: "NFT_NOT_FROZEN", detail: new Error(`'${nft._id}' not frozen`) }))
                return
            }
            // check if nft can access this location
            if (nft.type === "miner" && location !== "mine" || nft.type === "refiner" && location !== "foundry") {
                res.status(400).json(createError({ type: "trip", code: "WRONG_LOCATION", detail: new Error(`'${nft._id}' cannot be sent to ${location}`) }))
                return
            }
            if (nft.activeTrip?.startedAt && differenceInHours(new Date(), new Date(nft.activeTrip.startedAt)) < 4) {
                res.status(400).json(createError({ type: "trip", code: "MINER_NOT_READY", detail: new Error(`'${nft._id}' - ${nft.activeTrip.startedAt}`) }))
                return
            }
            if (nft.activeTrip?.lostUntil && nft.type === "miner") {
                const now = new Date()
                const lostUntil = new Date(nft.activeTrip.lostUntil)

                if (lostUntil < now) {
                    // claimable
                    lost_nfts.push(nft)
                    continue
                } else {
                    //not claimable
                    continue
                }
            }
            to_claim_nfts.push(nft)
        }

        req.nftList = { toClaim: to_claim_nfts, lostNft: lost_nfts }
        next()

    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
    }
}

// export async function claim_lost_nft(req: Request, res: Response) {
//     try {
//         const { nfts }: _trip_interaction = req.body
//         const user = req.user
//         const db_priv = (await mongo_client.getInstance()).db("private_data")
//         const collection_nfts = db_priv.collection<_staked_nft>("nfts")
//         const get_nfts = await collection_nfts.find({ _id: { $in: nfts } }).toArray()

//         if (get_nfts.length === 0) {
//             res.status(404).json({ message: "No nft found", error: "" })
//             return
//         }

//         const nft_to_update: _staked_nft[] = []

//         for (const nft of get_nfts) {
//             // check if user own the nft
//             if (nft.owner !== user?.pubkey) {
//                 throw new Error(`User (${user?.pubkey}) doesn't own NFT (${nft._id})`);
//             }
//             // check if nft is not on trip
//             if (!nft.isOnTrip) {
//                 throw new Error(`NFT (${nft._id}) is not in a trip`);
//             }
//             // check if nft is staked
//             if (!nft.isFrozen) {
//                 throw new Error(`NFT (${nft._id}) is not frozen`);
//             }
//             // check if nft can access this location
//             if (nft.type !== "miner") {
//                 throw new Error(`${nft.type} (${nft._id}) cannot be lost`);
//             }
//             // check if nft is no more lost
//             if (nft.activeTrip?.lostUntil) {
//                 const now = new Date()
//                 const lostUntil = new Date(nft.activeTrip?.lostUntil)

//                 if (lostUntil < now) {
//                     // claimable
//                     nft.activeTrip = null
//                     nft.isOnTrip = false
//                     nft_to_update.push(nft)
//                 } else {
//                     //not claimable
//                     continue
//                 }
//             }

//         }

//         if (nft_to_update.length < 0) {
//             res.status(422).json(createError({ type: "trip", code: "MINER_LOST" }))
//         }

//         const bulkOps = nft_to_update.map(nft => {
//             return {
//                 updateOne: {
//                     filter: { _id: nft._id },
//                     update: {
//                         $set: {
//                             activeTrip: nft.activeTrip,
//                             isOnTrip: nft.isOnTrip,
//                         }
//                     },
//                     upsert: false
//                 }
//             }
//         })

//         await collection_nfts.bulkWrite(bulkOps)

//         res.json(createResponse({ data: {}, message: "Success" }))

//     } catch (error) {
//         res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
//     }
// }

export async function get_location_data(req: Request, res: Response) {
    try {
        const location: string = req.params.location
        const db = (await mongo_client.getInstance()).db("public_data")
        const collection = location === "mine" ? db.collection<_db_mine_data_doc__default>('mine_data') : db.collection<_db_foundry_data_doc__default>("foundry_data")
        const get_data = await collection.findOne({ _id: "default" })

        if (!get_data) {
            throw new Error("Unable to find location data")
        }

        if (location === "mine" && "totalMiners" in get_data) {
            const payload: Partial<_db_mine_data_doc__default> = {
                totalMiners: get_data.totalMiners,
                lostMiners: get_data.lostMiners,
                stuckedMiners: get_data.stuckedMiners,
                totalEmitted: get_data.totalEmitted,
                boosted: get_data.boosted,
            }
            res.json(createResponse({ data: payload, message: "Success" }))
        } else if (location === "foundry" && "totalRefiners" in get_data) {
            const payload: Partial<_db_foundry_data_doc__default> = {
                totalRefiners: get_data.totalRefiners,
                totalEmitted: get_data.totalEmitted,
                totalRafined: get_data.totalRafined,
                boosted: get_data.boosted,
            }
            res.json(createResponse({ data: payload, message: "Success" }))
        } else {
            throw new Error("Unable to prepare data")
        }

    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
    }
}