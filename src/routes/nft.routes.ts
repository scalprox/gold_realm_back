import { Router, Request, Response } from "express";
import { get_user_nft, stake_nft, unstake_nft } from "../web3/manage_nft";
import { _new_nft } from "../types/models.type";
import { createError } from "../utils/errorUtils";
import { createResponse } from "../utils/responseUtils";

const nftRoute = Router()

nftRoute.get("/myNft", get_user_nft)

nftRoute.post("/stake", async (req, res) => {
    try {
        if (!req.user?.pubkey) {
            const result = await stake_nft(nft_exemple, /*req.user.pubkey*/  "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym")
            if (result.success) {
                res.json(createResponse({ message: "Nft staked", data: {} }))
            } else {
                res.status(500).json(createError({ type: "global", code: "INTERNAL" }))
            }
        } else {
            res.status(400).json(createError({ type: "global", code: "PUBKEY_MISSING" }))
        }
    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
    }
})

nftRoute.post("/nft/unstakeNft", async (req, res) => {
    try {
        if (req.user?.pubkey) {

            const result = await unstake_nft(unstake_nft_exemple, req.user.pubkey)
            if (result.success) {
                res.json(createResponse({ message: "Nft unstaked", data: {} }))
            } else {
                res.status(500).json(createError({ type: "global", code: "INTERNAL" }))
            }
        } else {
            res.status(400).json(createError({ type: "global", code: "PUBKEY_MISSING" }))
        }
    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))

    }
})

export default nftRoute

const nft_exemple: _new_nft[] = [{
    owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
    mintAddress: "acergheth",
    type: "miner",
    name: "Miner #9118"
}, {
    owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
    mintAddress: "acerefghteth",
    type: "miner",
    name: "Miner #7795"
}, {
    owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
    mintAddress: "648gerrefghteth",
    type: "refiner",
    name: "Refiner #164"
}, {
    owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
    mintAddress: "aerg8h8tefghteth",
    type: "miner",
    name: "Miner #1564"
}]

const unstake_nft_exemple: string[] = ["acerefghteth", "648gerrefghteth"]
