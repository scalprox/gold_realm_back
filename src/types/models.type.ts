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
  name: string
}

export interface _nft_global_stats {
  /**
   * @info mint address
   */
  _id: string
  amountOfOwner: number | 0
  totalIngot: number | 0
  totalNugget: number | 0
  stucked: boolean
  stuckedAt: Date | null
}

export interface _staked_nft_base {
  /**
   * @info Mint Address
   */
  _id: string
  mintAddress: string;
  type: "miner" | "refiner";
  owner: string;
  image: string | ""
  isFrozen: boolean
  name: string
  isOnTrip: boolean
  activeTrip: _active_trip | null
}

export interface _active_trip {
  tripId: number
  startedAt: Date
  endedAt: Date | null
  currentEmission: number
  claimed: boolean
  owner: string
  isLost: boolean
  lostUntil: Date | null
  isStucked: boolean
}

export interface _user_owned_nft {
  /**
   * @info walletAddress
   */
  _id: string
  miners: _miner_nft[]
  refiners: _refiner_nft[]
}



export interface _miner_nft extends _staked_nft_base {
  type: "miner";
  totalNuggetHarvested: number;
  stats: {
    harvestMultiplier: number;
    memory: number;
  }
}

export interface _refiner_nft extends _staked_nft_base {
  type: "refiner";
  stats: {
    harvestMultiplier: number;
    memory: null
  }
  totalGoldRefined: number;
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
  owned_miners: _miner_nft[]
  owned_refiners: _refiner_nft[]
}

export interface _jwt_payload {
  pubkey: string;
  iat: number;
  exp: number;
  role: string | "user";
}

export interface _trip_interaction {
  nfts: string[]
  location: "mine" | "foundry"
}

export interface _db_mine_data_doc__default {
  /**
   * @info doc Default store location data such as emission, total miner..
   */
  _id: "default"
  totalMiners: number
  stuckedMiners: number
  lostMiners: number
  totalEmitted: Number
  boosted: boolean
  /**
   * @info Show the last trip id given to a player, (changing at every trip)
   */
  currentTripId: number
}

export interface _db_foundry_data_doc__default {
  /**
   * @info doc Default store location data such as emission, total miner..
   */
  _id: "default"
  totalRefiners: number
  /**
   * @info Amount of Nugget converted in Ingot
   */
  totalRafined: number
  totalEmitted: Number
  boosted: boolean
  /**
   * @info Show the last trip id given to a player, (changing at every trip)
   */
  currentTripId: number
}

export interface _db_trip_data_doc {
  _id: number
  nftId: string
  nftName: string
  owner: string
  currentEmission: number
  claimedEmission: number | null
  startedAt: Date
  claimedAt: Date | null
  claimed: boolean
  isLost: boolean
  isStucked: boolean
  lostUntil: Date | null
  claimEvent: "success" | "nothing" | "lost" | "stucked" | null
  nftStats: {
    multiplier: number,
    memory: number | null
  }
}

export interface _miner_trip_outcome {
  success: number
  nothing: number
  lost: number
  stuck: number
}

export interface _api_request {
  success: true
  message: string
  data: {}

}

export interface _api_request_error {
  success: false
  error: _error
  detail?: Error | undefined
}

export interface _response {
  message: string,
  data: {}
}

export type _error = {
  code: _code_global
  type: "global"
  detail?: Error | undefined
} | {
  code: _code_user
  type: "user"
  detail?: Error | undefined
} | {
  code: _code_trip
  type: "trip"
  detail?: Error | undefined
} | {
  code: _code_nft
  type: "nft"
  detail?: Error | undefined
}


type _code_global =
  "INTERNAL" |
  "UNKNOWN" |
  "NETWORK_ERROR" |
  "MISSING_DATA_IN_REQUEST" |
  "JWT_ERROR" |
  "JWT_EXPIRED" |
  "JWT_MISSING" |
  "PUBKEY_MISSING" |
  "WRONG_SIGNATURE" |
  "NOT_HANDLED"

type _code_user =
  "USER_NOT_FOUND"

type _code_trip =
  "MINER_LOST" |
  "MINER_STUCKED" |
  "MINER_ALREADY_IN_TRIP" |
  "MINER_NOT_IN_TRIP" |
  "MINER_NOT_READY" |
  "WRONG_LOCATION"



type _code_nft =
  "NFT_NOT_FOUND" |
  "NFT_NOT_FROZEN" |
  "WRONG_OWNER"

export interface _claim_response_payload {
  lost_claimed: { nftId: string, nftName: string }[] | null
  success_claimed: {
    event: "success" | "nothing" | "lost" | "stucked"
    nftId: string
    claimAmount: number
    nftName: string
  }[] | null
}