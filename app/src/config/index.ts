import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// ── Safe helper ───────────────────────────────────────────────
const toPubkey = (key?: string, fallback = "11111111111111111111111111111111") =>
  new PublicKey(key ?? fallback);

// ── Program IDs ───────────────────────────────────────────────
export const ORACLE_PROGRAM_ID = toPubkey(process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID);
export const BREAKER_PROGRAM_ID = toPubkey(process.env.NEXT_PUBLIC_BREAKER_PROGRAM_ID);
export const VAULT_PROGRAM_ID = toPubkey(process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID);

// ── PDAs ───────────────────────────────────────────────────────
export const [ORACLE_STATE_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle_v1")],
  ORACLE_PROGRAM_ID
);

export const [PROGRAM_CONFIG_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  VAULT_PROGRAM_ID
);

export const [FLUX_MINT_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("flux_mint")],
  VAULT_PROGRAM_ID
);

// ── PDA helper ────────────────────────────────────────────────
export function getVaultPDA(owner: PublicKey, collateralMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer(), collateralMint.toBuffer()],
    VAULT_PROGRAM_ID
  );
  return pda;
}

// ── Network ────────────────────────────────────────────────────
export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "localnet") as
  "localnet" | "devnet" | "mainnet-beta";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (NETWORK === "localnet" ? "http://localhost:8899" : clusterApiUrl(NETWORK));

// ── Constants ───────────────────────────────────────────────────
export const FLUX_DECIMALS = 6;
export const THRESHOLD_OPEN = 80;
export const THRESHOLD_RESTRICTED = 60;
export const MAX_SCORE_AGE_SEC = 300;