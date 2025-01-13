import { Router, Request, Response } from "express";
import tripRoute from "./trip.routes";
import nftRoute from "./nft.routes";
import userRoute from "./user.routes";
import { _new_nft } from "../types/models.type";
import { get_user_nft, stake_nft, unstake_nft } from "../web3/manage_nft";
import { get_auth_message, create_jwt, check_jwt, get_user_data, logout } from "../web3/manage_user";
import { send_nfts_to_trip } from "../games/trip";

const api = Router();

// unSecured route
api.get("/ask-auth/:pubkey", get_auth_message);
api.post("/verify-auth", create_jwt)

// secured route after this
api.use(check_jwt)

// user route

api.use("/user", userRoute)

// nft route

api.use("/nft", nftRoute)

// trip route

api.use("/trip", tripRoute)







const unstake_nft_exemple: string[] = ["acerefghteth", "648gerrefghteth"]

export default api;