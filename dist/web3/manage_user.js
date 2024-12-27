"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_auth_message = get_auth_message;
exports.check_jwt = check_jwt;
exports.create_jwt = create_jwt;
exports.get_user_data = get_user_data;
exports.logout = logout;
const uuid_1 = require("uuid");
const utils_1 = require("../utils");
const date_fns_1 = require("date-fns");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
function get_auth_message(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        //user send his pubKey
        //first create a message with a nonce and send it back to the user so he can sign. aside that create or update user_doc in db doc id is pubkey, and set the nonce and a timestamp.
        //after client sign the message an send back th txId
        //verify if txId is ok with the provided info, nonce / walletAddress, and check if tx life is not > 3 min
        try {
            const pubkey = req.params.pubkey;
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection("users");
            const get_user_doc = yield collection.findOne({ _id: pubkey });
            const nonce = (0, uuid_1.v4)();
            const signInData = { sign_message: `Sign this message to authentificate the wallet "${pubkey}":${nonce}` };
            if (get_user_doc) {
                yield collection.updateOne({ _id: pubkey }, { $set: { sign_message: signInData.sign_message, nonce } }, { upsert: true });
            }
            else {
                yield collection.insertOne({
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
                    }
                });
            }
            res.json({ sign_message: signInData.sign_message });
            return;
        }
        catch (error) {
            res.status(500).json({ message: "Unknown error", error });
        }
    });
}
function check_jwt(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const JWT = req.cookies.authToken;
            if (!JWT) {
                res.status(401).json({ message: "Unauthorized: No token provided" });
                return;
            }
            if (!process.env.JWT_KEY) {
                res.status(500).json({ message: "Unauthorized: Internal" });
                return;
            }
            const decoded_jwt = jsonwebtoken_1.default.verify(JWT, process.env.JWT_KEY);
            const pubkey = decoded_jwt.pubkey;
            if (decoded_jwt.exp < Date.now()) {
                res.status(401).json({ message: "Unauthorized: Token expired" });
                return;
            }
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection("users");
            const get_user_doc = yield collection.findOne({ _id: pubkey });
            if (!get_user_doc || !get_user_doc.nonce) {
                res.status(401).json({ message: "Unauthorized: User not found" });
                return;
            }
            req.user = decoded_jwt;
            next();
        }
        catch (error) {
            res.status(403).json({ message: "Forbidden: Invalid or expired token" });
            return;
        }
    });
}
function create_jwt(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const signature = req.body.signature.data;
            const pubkey = req.body.publicKey;
            if (!pubkey || !signature) {
                res.status(400).send({ message: "Missing data" });
                return;
            }
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection(("users"));
            const get_user_doc = yield collection.findOne({ _id: pubkey });
            if (!(get_user_doc === null || get_user_doc === void 0 ? void 0 : get_user_doc.sign_message) || !(get_user_doc === null || get_user_doc === void 0 ? void 0 : get_user_doc.nonce_iat)) {
                throw new Error("User data unreachable.");
            }
            const expire_at = (0, date_fns_1.add)(new Date(), { minutes: 3 });
            if (expire_at < get_user_doc.nonce_iat) {
                yield collection.updateOne({ _id: pubkey }, { $set: { nonce: "", sign_message: "" } });
                throw new Error("Message has expired, try again please.");
            }
            if (typeof get_user_doc.sign_message !== "string") {
                throw new Error("Sign message must be a string.");
            }
            const messageUint8 = new TextEncoder().encode(get_user_doc === null || get_user_doc === void 0 ? void 0 : get_user_doc.sign_message);
            const publicKeyUint8 = bs58_1.default.decode(pubkey);
            const verify = tweetnacl_1.default.sign.detached.verify(messageUint8, Uint8Array.from(signature), publicKeyUint8);
            if (verify) {
                // signature valid, create jwt
                const now = Date.now();
                const payload = { pubkey, iat: now, exp: (0, date_fns_1.add)(now, { days: 1 }).getTime(), role: get_user_doc.role };
                if (!process.env.JWT_KEY) {
                    res.status(500).json({ message: "Temporarly unable to get JWT" });
                    return;
                }
                const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_KEY);
                res.cookie("authToken", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 24 * 60 * 60 * 1000 //1day
                });
                res.status(200).json({ message: "Connected" });
                return;
            }
            else {
                // siganture invalid, delete message in db / maybe log the pubkey and ip ?
                yield collection.updateOne({ _id: pubkey }, { $set: { nonce: "", sign_message: "" } });
                res.status(401).json({ message: "Wrong signature" });
                return;
            }
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Unknown error" });
        }
        finally {
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection(("users"));
            yield collection.updateOne({ _id: req.body.publicKey }, { $set: { sign_message: "" } });
        }
    });
}
function get_user_data(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const user = req.user;
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection("users");
            const user_doc = yield collection.findOne({ _id: user === null || user === void 0 ? void 0 : user.pubkey });
            if (!(user_doc === null || user_doc === void 0 ? void 0 : user_doc.data)) {
                res.status(404).json({ message: "User doc not found" });
                return;
            }
            res.json({
                data: user_doc.data
            });
        }
        catch (error) {
            res.status(500).json({ message: "Internal : Unknown error", error });
        }
    });
}
function logout(req, res) {
    try {
        res.clearCookie("authToken", {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict"
        });
        res.status(200).send("Logged out");
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ mesage: "Error occured", error: error.message });
        }
        else {
            res.status(500).json({ mesage: "Error occured", error: "Unknown" });
        }
    }
}
