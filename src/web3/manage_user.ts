import { v4 } from "uuid"
import { mongo_client } from "../utils"
import env from "node:process"
import { add } from "date-fns"
import { _user_doc, _jwt_payload } from "../types/models.type"
import jwt, { JwtPayload } from "jsonwebtoken"
import nacl from "tweetnacl"
import bs58 from "bs58"
import { NextFunction, Request, Response } from "express"
import { createError } from "../utils/errorUtils"
import { createResponse } from "../utils/responseUtils"

export async function get_auth_message(req: Request, res: Response) {
    //user send his pubKey
    //first create a message with a nonce and send it back to the user so he can sign. aside that create or update user_doc in db doc id is pubkey, and set the nonce and a timestamp.
    //after client sign the message an send back th txId
    //verify if txId is ok with the provided info, nonce / walletAddress, and check if tx life is not > 3 min
    try {
        const pubkey = req.params.pubkey
        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_user_doc>("users")
        const get_user_doc = await collection.findOne({ _id: pubkey })

        const nonce = v4()

        const signInData = { sign_message: `Sign this message to authentificate the wallet "${pubkey}":${nonce}` }

        if (get_user_doc) {
            await collection.updateOne(
                { _id: pubkey },
                { $set: { sign_message: signInData.sign_message, nonce } },
                { upsert: true }
            );
        } else {
            await collection.insertOne({
                _id: pubkey,
                sign_message: signInData.sign_message,
                role: "user",
                nonce,
                nonce_iat: new Date(),
                data: {
                    username: pubkey.slice(0, 4) + "..." + pubkey.slice(-4),
                    totalMiners: 0,
                    totalRefiners: 0,
                    ingotsBalance: 0,
                    nuggetsBalance: 0,
                    allTimeIngots: 0,
                    allTimeNuggets: 0
                },
                owned_miners: [],
                owned_refiners: [],


            })
        }
        res.json(createResponse({ data: { sign_message: signInData.sign_message }, message: "Sign this message to connect" }))
        return

    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
    }
}

export async function check_jwt(req: Request, res: Response, next: NextFunction) {

    try {
        const JWT = req.cookies.authToken

        if (!JWT) {
            res.status(401).json(createError({ type: "global", code: "JWT_MISSING" }))
            return
        }

        if (!process.env.JWT_KEY) {
            res.status(500).json(createError({ type: "global", code: "INTERNAL" }))
            return
        }
        const decoded_jwt = jwt.verify(JWT, process.env.JWT_KEY as string) as _jwt_payload;
        const pubkey = decoded_jwt.pubkey

        if (decoded_jwt.exp < Date.now()) {
            res.status(401).json(createError({ type: "global", code: "JWT_EXPIRED" }));
            return
        }

        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_user_doc>("users")
        const get_user_doc = await collection.findOne({ _id: pubkey })

        if (!get_user_doc || !get_user_doc.nonce) {
            res.status(401).json(createError({ type: "user", code: "USER_NOT_FOUND" }));
            return
        }
        req.user = decoded_jwt
        next()

    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
        return
    }
}

export async function create_jwt(req: Request, res: Response) {
    try {

        const signature: Uint8Array = req.body.signature.data
        const pubkey: string = req.body.publicKey

        if (!pubkey || !signature) {
            res.status(400).json(createError({ type: "global", code: "MISSING_DATA_IN_REQUEST" }))
            return
        }

        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_user_doc>(("users"))
        const get_user_doc = await collection.findOne({ _id: pubkey })

        if (!get_user_doc?.sign_message || !get_user_doc?.nonce_iat) {
            throw new Error("User data unreachable.");
        }

        const expire_at = add(new Date(), { minutes: 3 })

        if (expire_at < get_user_doc.nonce_iat) {
            await collection.updateOne({ _id: pubkey }, { $set: { nonce: "", sign_message: "" } })
            throw new Error("Message has expired, try again please.")
        }

        if (typeof get_user_doc.sign_message !== "string") {
            throw new Error("Sign message must be a string.");
        }

        const messageUint8 = new TextEncoder().encode(get_user_doc?.sign_message)
        const publicKeyUint8 = bs58.decode(pubkey)
        const verify = nacl.sign.detached.verify(messageUint8, Uint8Array.from(signature), publicKeyUint8)

        if (verify) {
            // signature valid, create jwt
            const now = Date.now()
            const payload: _jwt_payload = { pubkey, iat: now, exp: add(now, { days: 1 }).getTime(), role: get_user_doc.role }

            if (!process.env.JWT_KEY) {
                res.status(500).json(createError({ type: "global", code: "INTERNAL" }))
                return
            }

            const token = jwt.sign(payload, process.env.JWT_KEY)

            res.cookie("authToken", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 24 * 60 * 60 * 1000//1day
            })
            res.status(200).json(createResponse({ message: "Connected", data: {} }))
            return
        } else {
            // siganture invalid, delete message in db / maybe log the pubkey and ip ?
            await collection.updateOne({ _id: pubkey }, { $set: { nonce: "", sign_message: "" } })
            res.status(401).json(createError({ type: "global", code: "WRONG_SIGNATURE" }))
            return
        }

    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
    } finally {
        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_user_doc>(("users"))
        await collection.updateOne({ _id: req.body.publicKey }, { $set: { sign_message: "" } })

    }
}

export async function get_user_data(req: Request, res: Response): Promise<void> {
    try {
        const user = req.user
        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_user_doc>("users")
        const user_doc = await collection.findOne({ _id: user?.pubkey })

        if (!user_doc?.data) {
            res.status(404).json(createError({ type: "user", code: "USER_NOT_FOUND" }))
            return
        }
        res.json(createResponse({ data: user_doc.data, message: "" }))
    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
    }
}

export function logout(req: Request, res: Response): void {
    try {
        res.clearCookie("authToken", {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict"
        })
        res.status(200).send(createResponse({ data: {}, message: "Logged out." }))
    } catch (error) {
        res.status(500).json(createError({ type: "global", code: "INTERNAL", detail: error instanceof Error ? error : undefined }))
    }
}

