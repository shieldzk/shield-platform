/**
 * Deployed ShieldZK contract addresses and default network parameters for Stellar Testnet.
 */
export const TESTNET_CONFIG = {
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  contracts: {
    vault: "CDH5S7ABGMLM5FORYUQJSEG2RVKPDSSM2OZI7DORVOASFMDKAEKHP5WH",
    claimVerifier: "CCKKXDUSPGADSFYKEYM4C2APHGIJ3M4L5HRPSDPPKFOMRTTRVZTZCUAB",
    conservationVerifier: "CA52T5EAH6YTR4GXH475TY2EFIEMCXIBYHWAUDU3ONBLSLT23Y3ZWO2B",
    nativeAsset: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
} as const
