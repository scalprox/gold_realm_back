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
const uuid_1 = require("uuid");
const utils_1 = require("../utils");
const date_fns_1 = require("date-fns");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
function get_auth_message(pubkey) {
    return __awaiter(this, void 0, void 0, function* () {
        //user send his pubKey
        //first create a message with a nonce and send it back to the user so he can sign. aside that create or update user_doc in db doc id is pubkey, and set the nonce and a timestamp.
        //after client sign the message an send back th txId
        //verify if txId is ok with the provided info, nonce / walletAddress, and check if tx life is not > 3 min
        try {
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
                    _id: pubkey, sign_message: signInData.sign_message, role: "user", nonce, nonce_iat: new Date()
                });
            }
            return signInData;
        }
        catch (error) {
            throw error;
        }
    });
}
function check_jwt(JWT, pubkey) {
    return __awaiter(this, void 0, void 0, function* () {
        //
        try {
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection("users");
            const get_user_doc = yield collection.findOne({ _id: pubkey });
            if (!get_user_doc || !get_user_doc.nonce) {
                return { code: 401, message: "Unauthorized" };
            }
            if (process.env.JWT_KEY) {
                return;
            }
            const decoded_jwt = jsonwebtoken_1.default.verify(JWT, process.env.JWT_KEY);
            // Vérifier les informations du JWT
            if (decoded_jwt.pubkey !== pubkey ||
                decoded_jwt.exp < Date.now()) {
                return { code: 401, message: "Unauthorized" };
            }
            return decoded_jwt;
        }
        catch (error) {
            throw error;
        }
    });
}
function create_jwt(signature, pubkey) {
    return __awaiter(this, void 0, void 0, function* () {
        //const payload: _jwt_payload = { pubkey, iat: new Date(), nonce: get_user_doc.sign_message.nonce, exp: add(now, { days: 1 }), role: get_user_doc.role }
        try {
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection(("users"));
            const get_user_doc = yield collection.findOne({ _id: pubkey });
            if (!(get_user_doc === null || get_user_doc === void 0 ? void 0 : get_user_doc.sign_message) || (get_user_doc === null || get_user_doc === void 0 ? void 0 : get_user_doc.nonce_iat)) {
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
                if (!process.env.JWT_KEY)
                    throw new Error("Temporarly unable to get JWT");
                const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_KEY);
                return token;
            }
            else {
                // siganture invalid, delete message in db
                yield collection.updateOne({ _id: pubkey }, { $set: { nonce: "", sign_message: "" } });
                throw new Error("Wrong signature");
            }
        }
        catch (error) {
            console.log(error);
            throw error;
        }
        finally {
            const db = (yield utils_1.mongo_client.getInstance()).db("private_data");
            const collection = db.collection(("users"));
            yield collection.updateOne({ _id: pubkey }, { $set: { nonce: "", sign_message: "" } });
        }
    });
}
