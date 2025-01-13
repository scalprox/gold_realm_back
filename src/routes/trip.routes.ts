import { Router, Request, Response } from "express";
import { /*claim_lost_nft,*/ get_location_data, validate_claim_request, validate_send_request } from "../controllers/trip.controller";
import { claim_mine_trip, send_nfts_to_trip } from "../games/trip";
import { createResponse } from "../utils/responseUtils";

const tripRoute = Router()


tripRoute.get("/test", (req, res) => {
    res.json(createResponse({
        message: "success", data: {
            "lost_claimed": [{
                nftName: "Miner #8874",
                nftId: "ergergberg"
            }],
            "success_claimed": [
                {
                    "event": "success",
                    "claimAmount": 254.304,
                    "nftId": "aerg8h8tefghteth",
                    "nftName": "Miner #182"
                }, {
                    "event": "nothing",
                    "claimAmount": 0,
                    "nftId": "aerh8tefghteth",
                    "nftName": "Miner #158"
                }, {
                    "event": "lost",
                    "claimAmount": 0,
                    "nftId": "aerg8h8tefeth",
                    "nftName": "Miner #1582"
                }, {
                    "event": "stucked",
                    "claimAmount": 0,
                    "nftId": "rg8h8tefghteth",
                    "nftName": "Miner #582"
                },
            ]
        }
    }))
})

tripRoute.post("/send", validate_send_request, send_nfts_to_trip)

tripRoute.post("/claim", validate_claim_request, claim_mine_trip)

// tripRoute.post("/claim/lost", claim_lost_nft)

tripRoute.get("/info/:location", get_location_data)


export default tripRoute