import { Router, Request, Response } from "express";
import { _new_nft } from "../types/models.type";
import { stake_nft, unstake_nft } from "../web3/manage_nft";
import { get_auth_message, create_jwt, check_jwt, get_user_data, logout } from "../web3/manage_user";

const router = Router();

// route GET
router.get("/gold", (req: Request, res: Response) => {
  res.json({ message: "Voici l'or récolté !" });
});

router.get("/ask-auth/:pubkey", get_auth_message);

router.get("/user/info", check_jwt, get_user_data);

router.get("/user/logout", logout)

// route POST
router.post("/verify-auth", create_jwt)

router.post("/gold", (req: Request, res: Response) => {
  const { amount } = req.body;
  res.json({ message: `Vous avez ajouté ${amount} pièces d'or !` });
});

router.post("/:walletAddress/stakeNft", async (req, res) => {
  // TODO check if JWT = wallet address
  const result = await stake_nft(nft_exemple, req.params.walletAddress)
  if (result) {
    res.send("Good")
  } else {
    res.send("Error")
  }
})

router.post("/:walletAddress/unstakeNft", async (req, res) => {
  // TODO check if JWT = wallet address
  const result = await unstake_nft(unstake_nft_exemple, req.params.walletAddress)
  if (result) {
    res.send("Good")
  } else {
    res.send("Error")
  }
})

export default router;


const nft_exemple: _new_nft[] = [{
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
}]

const unstake_nft_exemple: string[] = ["acerefghteth", "648gerrefghteth"]