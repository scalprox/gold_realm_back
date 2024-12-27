import { SolanaSignInInput } from "@solana/wallet-standard-features";


export interface _userData {
  wallet: string;
  amountOfMiners: number;
  amountOfRefiners: number;
  amountOfGoldNuggets: number;
  amountOfGoldIngots: number;
  ownedNft: [_miners, _refiners];
}

export interface _miners {
  mintAddress: string;
  isStaked: boolean;
  isOnTrip: boolean;
  onTripSince: Date | null;
  /**
   * @info Total mined nugget in actual TRIP !
   */
  nuggetHarvested: number;
  /**
   * @info total nuggets mined
   */
  totalNuggetHarvested: number;
  /**
   * @info amount of Nuggets sold to a refiner against Gold
   */
  totalNuggetSold: number;
  /**
   * @info total of ingot buyed against nuggets
   */
  totalIngotBuyed: number;
}

export interface _refiners {
  mintAddress: string;
  isStaked: boolean;
  isOnTrip: boolean;
  onTripSince: Date | null;
  /**
   * @info Total transformed Ingot in actual TRIP !
   */
  ingotTransformed: number;
  /**
   * @info total Ingot transformed
   */
  totalNuggetHarvested: number;
  /**
   * @info amount of Nuggets sold to a refiner against Gold
   */
  totalNuggetSold: number;
  /**
   * @info total of ingot buyed against nuggets
   */
  totalIngotBuyed: number;
}

export interface _staked_miners {
  owner: string;
  mintAddress: string;
  levelHarvest: number;
  levelMemory: number;
  boosted: boolean;
  startedAt: Date;
  actualHarvest: number;
  onTrip: boolean;
}

export interface _staked_refiners {
  owner: string;
  mintAddress: string;
  levelRefine: number;
  boosted: boolean;
  startedAt: Date;
  actualHarvest: number;
  onTrip: boolean;
}

export interface _miners_on_trip {
  _id: string;
  walletAddress: string;
  miners: _staked_miners[];
}

export interface _new_nft {
  mintAddress: string;
  /**
   * @info The type of the NFT ( Miner or Refiner )
   */
  type: "miner" | "refiner"
  owner: string
}

export interface _staked_nft_base {
  _id: string;
  mintAddress: string;
  type: "miner" | "refiner";
  owner: string;
  stakedAt: Date | undefined;
  unstakedAt: Date | undefined;
  boosted: boolean;
  onTrip: boolean;
  tripStartedAt?: Date | undefined;
  staked: boolean;
}

export interface _miner_nft extends _staked_nft_base {
  type: "miner";
  totalNuggetHarvested?: number;
  levelHarvest?: number;
  levelMemory?: number;

}
export interface _refiner_nft extends _staked_nft_base {
  type: "refiner";
  levelRefine?: number;
  totalGoldRefined?: number;
}

export type _staked_nft = _miner_nft | _refiner_nft

export interface _user_doc {
  _id: string;
  role: string | "user";
  sign_message: string;
  nonce: string;
  nonce_iat: Date;
  data: {
    nuggetsBalance: number | 0;
    ingotsBalance: number | 0;
    totalMiners: number | 0;
    totalRefiners: number | 0;
    username: string
    allTimeNuggets: number | 0
    allTimeIngots: number | 0

  }
}

export interface _jwt_payload {
  pubkey: string;
  iat: number;
  exp: number;
  role: string | "user";
}

