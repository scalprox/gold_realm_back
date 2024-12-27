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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const manage_nft_1 = require("../web3/manage_nft");
const manage_user_1 = require("../web3/manage_user");
const router = (0, express_1.Router)();
// route GET
router.get("/gold", (req, res) => {
    res.json({ message: "Voici l'or récolté !" });
});
router.get("/ask-auth/:pubkey", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const auth_message = yield (0, manage_user_1.get_auth_message)(req.params.pubkey);
    if (auth_message) {
        res.send(auth_message);
    }
    else {
        res.statusCode = 500;
        res.send("Unable to create message data");
    }
}));
router.get("/user/:pubkey", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // check cookie
    const JWT = req.cookies.authToken;
    const pubkey = req.params.pubkey;
    if (!JWT || !pubkey) {
        res.status(401).send({ message: "Unauthorized " });
        return;
    }
    else {
        //check token
    }
    res.send("");
}));
// route POST
router.post("/verify-auth", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { publicKey, signature } = req.body;
        if (!publicKey || !signature) {
            res.status(500).send({ message: "Missing data" });
            return;
        }
        const create_auth_token = yield (0, manage_user_1.create_jwt)(signature.data, publicKey);
        res.cookie("authToken", create_auth_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000 //1day
        });
        res.status(200).json({ message: "Connected" });
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(500).send(error.message);
            return;
        }
        res.status(500).send("Unknown error");
    }
}));
router.post("/gold", (req, res) => {
    const { amount } = req.body;
    res.json({ message: `Vous avez ajouté ${amount} pièces d'or !` });
});
router.post("/:walletAddress/stakeNft", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO check if JWT = wallet address
    const result = yield (0, manage_nft_1.stake_nft)(nft_exemple, req.params.walletAddress);
    if (result) {
        res.send("Good");
    }
    else {
        res.send("Error");
    }
}));
router.post("/:walletAddress/unstakeNft", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO check if JWT = wallet address
    const result = yield (0, manage_nft_1.unstake_nft)(unstake_nft_exemple, req.params.walletAddress);
    if (result) {
        res.send("Good");
    }
    else {
        res.send("Error");
    }
}));
exports.default = router;
const nft_exemple = [{
        owner: "Fqhnoym",
        mintAddress: "acergheth",
        type: "miner"
    }, {
        owner: "Fqhnoym",
        mintAddress: "acerefghteth",
        type: "miner"
    }, {
        owner: "Fqhnoym",
        mintAddress: "648gerrefghteth",
        type: "refiner"
    }, {
        owner: "Fqhnoym",
        mintAddress: "aerg8h8tefghteth",
        type: "miner"
    }];
const unstake_nft_exemple = ["acerefghteth", "648gerrefghteth"];
