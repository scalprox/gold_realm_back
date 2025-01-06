import { Router, Request, Response } from "express";
import { _new_nft } from "../types/models.type";
import { get_user_nft, stake_nft, unstake_nft } from "../web3/manage_nft";
import { get_auth_message, create_jwt, check_jwt, get_user_data, logout } from "../web3/manage_user";
import { send_nfts_to_trip } from "../games/trip";

const router = Router();

// unSecured route
router.post("/verify-auth", create_jwt)
router.get("/ask-auth/:pubkey", get_auth_message);

// secured route after this
router.use(check_jwt)

// route GET
router.get("/gold", (req: Request, res: Response) => {
  res.json({ message: "Voici l'or récolté !" });
});

router.get("/nft/myNft", get_user_nft);

router.get("/user/info", get_user_data);

router.get("/user/logout", logout)

// route POST

router.post("/gold", (req: Request, res: Response) => {
  const { amount } = req.body;
  res.json({ message: `Vous avez ajouté ${amount} pièces d'or !` });
});

router.post("/nft/stakeNft", async (req, res) => {

  if (!req.user?.pubkey) {
    const result = await stake_nft(nft_exemple, /*req.user.pubkey*/  "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym")
    if (result) {
      res.send("Good")
    } else {
      res.send("Error")
    }
  }
})

router.post("/trip/send", send_nfts_to_trip)

router.post("/trip/claim")

router.post("/nft/unstakeNft", async (req, res) => {
  if (req.user?.pubkey) {

    const result = await unstake_nft(unstake_nft_exemple, req.user.pubkey)
    if (result) {
      res.send("Good")
    } else {
      res.send("Error")
    }
  }
})

export default router;


const nft_exemple: _new_nft[] = [{
  owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
  mintAddress: "acergheth",
  type: "miner",
  name: "Miner #9118"
}, {
  owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
  mintAddress: "acerefghteth",
  type: "miner",
  name: "Miner #7795"
}, {
  owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
  mintAddress: "648gerrefghteth",
  type: "refiner",
  name: "Refiner #164"
}, {
  owner: "FQhv45Kha4qhoPUBLPoJ7UhrdJbpkWMk4XhbYDAXnoym",
  mintAddress: "aerg8h8tefghteth",
  type: "miner",
  name: "Miner #1564"
}]

const unstake_nft_exemple: string[] = ["acerefghteth", "648gerrefghteth"]