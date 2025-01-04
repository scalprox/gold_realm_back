import { v4 } from "uuid"
import { mongo_client } from "../utils"
import env from "node:process"
import { add } from "date-fns"
import { _user_doc, _jwt_payload } from "../types/models.type"
import jwt, { JwtPayload } from "jsonwebtoken"
import nacl from "tweetnacl"
import bs58 from "bs58"
import { NextFunction, Request, Response } from "express"

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
        res.json({ sign_message: signInData.sign_message })
        return

    } catch (error) {
        res.status(500).json({ message: "Unknown error", error })
        throw error
    }
}

export async function check_jwt(req: Request, res: Response, next: NextFunction) {

    try {
        const JWT = req.cookies.authToken

        if (!JWT) {
            res.status(401).json({ message: "Unauthorized: No token provided" })
            return
        }

        if (!process.env.JWT_KEY) {
            res.status(500).json({ message: "Unauthorized: Internal" });
            return
        }
        const decoded_jwt = jwt.verify(JWT, process.env.JWT_KEY as string) as _jwt_payload;
        const pubkey = decoded_jwt.pubkey

        if (decoded_jwt.exp < Date.now()) {
            res.status(401).json({ message: "Unauthorized: Token expired" });
            return
        }

        const db = (await mongo_client.getInstance()).db("private_data")
        const collection = db.collection<_user_doc>("users")
        const get_user_doc = await collection.findOne({ _id: pubkey })

        if (!get_user_doc || !get_user_doc.nonce) {
            res.status(401).json({ message: "Unauthorized: User not found" });
            return
        }
        req.user = decoded_jwt
        next()

    } catch (error) {
        res.status(403).json({ message: "Forbidden: Invalid or expired token" });
        return
    }
}

export async function create_jwt(req: Request, res: Response) {
    try {

        const signature: Uint8Array = req.body.signature.data
        const pubkey: string = req.body.publicKey

        if (!pubkey || !signature) {
            res.status(400).send({ message: "Missing data" })
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
                res.status(500).json({ message: "Temporarly unable to get JWT" })
                return
            }

            const token = jwt.sign(payload, process.env.JWT_KEY)

            res.cookie("authToken", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 24 * 60 * 60 * 1000//1day
            })
            res.status(200).json({ message: "Connected" })
            return
        } else {
            // siganture invalid, delete message in db / maybe log the pubkey and ip ?
            await collection.updateOne({ _id: pubkey }, { $set: { nonce: "", sign_message: "" } })
            res.status(401).json({ message: "Wrong signature" })
            return
        }

    } catch (error) {
        console.error(error);

        res.status(500).json({ message: "Unknown error" })
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
            res.status(404).json({ message: "User doc not found" })
            return
        }
        res.json({
            data: user_doc.data
        })
    } catch (error) {
        res.status(500).json({ message: "Internal : Unknown error", error })
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
        res.status(200).send("Logged out")
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ mesage: "Error occured", error: error.message })
        } else {
            res.status(500).json({ mesage: "Error occured", error: "Unknown" })

        }

    }
}

