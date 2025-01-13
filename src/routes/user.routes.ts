import { Router, Request, Response } from "express";
import { get_user_data, logout } from "../web3/manage_user";

const userRoute = Router()

userRoute.get("/info", get_user_data);

userRoute.get("/logout", logout)

export default userRoute