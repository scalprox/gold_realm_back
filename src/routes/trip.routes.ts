import { Router, Request, Response } from "express";
import { validate_claim_request, validate_send_request } from "../controllers/trip.controller";
import { claim_nft_trip, send_nfts_to_trip } from "../games/trip";

const tripRoute = Router()

tripRoute.post("/send", validate_send_request, send_nfts_to_trip)

tripRoute.post("/claim", validate_claim_request, claim_nft_trip)

export default tripRoute