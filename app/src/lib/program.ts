import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  ORACLE_PROGRAM_ID,
  VAULT_PROGRAM_ID,
  ORACLE_STATE_PDA,
  PROGRAM_CONFIG_PDA,
  FLUX_MINT_PDA,
  getVaultPDA,
} from "@/config";
import { OracleData, VaultData, ProtocolStats, ProtocolState } from "@/types";

// ── Instruction discriminators ───────────────────────────────────────────────
// Pre-computed: sha256("global:<name>")[0..8]
// Run: node -e "const {createHash}=require('crypto'); console.log(createHash('sha256').update('global:initialize').digest().slice(0,8))"
const DISC: Record<string, number[]> = {
  initialize:     [175,175,109,31,13,152,155,237],
  update_score:   [188,226,238,41,14,241,105,215],
  rotate_authority:[248,225,151,35,28,15,85,12],
  query_state:    [117,131,172,238,205,183,33,251],
  check_and_gate: [201,89,189,162,240,219,182,37],
  open_vault:     [181,248,228,67,6,175,37,167],
  deposit:        [242,35,198,137,82,225,242,182],
  mint_flux:      [26,17,214,191,85,6,75,50],
  repay:          [234,103,67,82,208,234,219,166],
  withdraw:       [183,18,70,156,148,109,161,34],
};

function getDisc(name: string): Buffer {
  const d = DISC[name];
  if (!d) throw new Error(`Unknown instruction: ${name}`);
  return Buffer.from(d);
}

// ── Account readers ──────────────────────────────────────────────────────────

export async function fetchOracleData(connection: Connection): Promise<OracleData | null> {
  try {
    const info = await connection.getAccountInfo(ORACLE_STATE_PDA);
    if (!info || info.data.length < 54) return null;

    const data = info.data;
    let offset = 8 + 32; // discriminator + authority

    const score       = data[offset++];
    const lr          = data[offset++];
    const at          = data[offset++];
    const od          = data[offset++];
    const vs          = data[offset++];
    const lastUpdated = Number(data.readBigInt64LE(offset)); offset += 8;
    const updateCount = Number(data.readBigUInt64LE(offset));

    const now = Math.floor(Date.now() / 1000);
    const isStale = now - lastUpdated > 300;
    const effectiveScore = isStale ? 0 : score;

    const protocolState: ProtocolState =
      effectiveScore >= 80 ? "Open" :
      effectiveScore >= 60 ? "Restricted" : "Frozen";

    return { score, lr, at, od, vs, lastUpdated, updateCount, protocolState, isStale };
  } catch (e) {
    console.warn("fetchOracleData:", e);
    return null;
  }
}

export async function fetchVaultData(
  connection: Connection,
  owner: PublicKey,
  collateralMint: PublicKey
): Promise<VaultData | null> {
  try {
    const vaultPda = getVaultPDA(owner, collateralMint);
    const info = await connection.getAccountInfo(vaultPda);
    if (!info || info.data.length < 105) return null;

    const data = info.data;
    let offset = 8;
    const ownerKey         = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const mintKey          = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const collateralAmount = data.readBigUInt64LE(offset); offset += 8;
    const collateralUsd    = data.readBigUInt64LE(offset); offset += 8;
    const fluxDebt         = data.readBigUInt64LE(offset); offset += 8;
    const tokenUsdPrice    = data.readBigUInt64LE(offset); offset += 8;
    const openedAt         = Number(data.readBigInt64LE(offset));

    const debtUsd = fluxDebt / 10_000n;
    const collateralRatioPct = debtUsd > 0n
      ? Number((collateralUsd * 100n) / debtUsd)
      : Infinity;

    const maxMintableUsd = (collateralUsd * 10_000n) / 15_000n;
    const remaining = maxMintableUsd > debtUsd ? maxMintableUsd - debtUsd : 0n;

    return {
      address:          vaultPda.toBase58(),
      owner:            ownerKey.toBase58(),
      collateralMint:   mintKey.toBase58(),
      collateralAmount,
      collateralUsd,
      fluxDebt,
      tokenUsdPrice,
      openedAt,
      collateralRatioPct,
      maxMintableUsd:   remaining,
    };
  } catch (e) {
    console.warn("fetchVaultData:", e);
    return null;
  }
}

export async function fetchProtocolStats(connection: Connection): Promise<ProtocolStats | null> {
  try {
    const info = await connection.getAccountInfo(PROGRAM_CONFIG_PDA);
    if (!info || info.data.length < 98) return null;

    const data = info.data;
    let offset = 8 + 32 + 32 + 32;
    const totalCollateralUsd = data.readBigUInt64LE(offset); offset += 8;
    const totalFluxMinted    = data.readBigUInt64LE(offset); offset += 8;
    const vaultCount         = data.readBigUInt64LE(offset);

    return { totalCollateralUsd, totalFluxMinted, vaultCount };
  } catch (e) {
    console.warn("fetchProtocolStats:", e);
    return null;
  }
}

// ── Transaction builders ──────────────────────────────────────────────────────

export async function buildOpenVaultTx(
  connection: Connection,
  wallet: WalletContextState,
  collateralMint: PublicKey,
  collateralUsdPrice: bigint
): Promise<Transaction> {
  const owner    = wallet.publicKey!;
  const vaultPda = getVaultPDA(owner, collateralMint);
  const priceBuffer = Buffer.alloc(8);
  priceBuffer.writeBigUInt64LE(collateralUsdPrice);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultPda,                isSigner: false, isWritable: true },
      { pubkey: PROGRAM_CONFIG_PDA,      isSigner: false, isWritable: true },
      { pubkey: collateralMint,          isSigner: false, isWritable: false },
      { pubkey: owner,                   isSigner: true,  isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([getDisc("open_vault"), priceBuffer]),
  });

  return buildTx(connection, owner, [ix]);
}

export async function buildDepositTx(
  connection: Connection,
  wallet: WalletContextState,
  collateralMint: PublicKey,
  amount: bigint
): Promise<Transaction> {
  const owner    = wallet.publicKey!;
  const vaultPda = getVaultPDA(owner, collateralMint);
  const ownerAta = await getAssociatedTokenAddress(collateralMint, owner);
  const escrow   = await getAssociatedTokenAddress(collateralMint, vaultPda, true);

  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(amount);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultPda,                      isSigner: false, isWritable: true },
      { pubkey: PROGRAM_CONFIG_PDA,            isSigner: false, isWritable: true },
      { pubkey: ORACLE_STATE_PDA,              isSigner: false, isWritable: false },
      { pubkey: ownerAta,                      isSigner: false, isWritable: true },
      { pubkey: escrow,                        isSigner: false, isWritable: true },
      { pubkey: collateralMint,                isSigner: false, isWritable: false },
      { pubkey: owner,                         isSigner: true,  isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID,              isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,            isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([getDisc("deposit"), amtBuf]),
  });

  return buildTx(connection, owner, [ix]);
}

export async function buildMintFluxTx(
  connection: Connection,
  wallet: WalletContextState,
  collateralMint: PublicKey,
  amountUsdCents: bigint
): Promise<Transaction> {
  const owner        = wallet.publicKey!;
  const vaultPda     = getVaultPDA(owner, collateralMint);
  const ownerFluxAta = await getAssociatedTokenAddress(FLUX_MINT_PDA, owner);

  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(amountUsdCents);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultPda,                    isSigner: false, isWritable: true },
      { pubkey: PROGRAM_CONFIG_PDA,          isSigner: false, isWritable: true },
      { pubkey: FLUX_MINT_PDA,               isSigner: false, isWritable: true },
      { pubkey: ORACLE_STATE_PDA,            isSigner: false, isWritable: false },
      { pubkey: ownerFluxAta,                isSigner: false, isWritable: true },
      { pubkey: owner,                       isSigner: true,  isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,          isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([getDisc("mint_flux"), amtBuf]),
  });

  return buildTx(connection, owner, [ix]);
}

export async function buildRepayTx(
  connection: Connection,
  wallet: WalletContextState,
  collateralMint: PublicKey,
  tokenAmount: bigint
): Promise<Transaction> {
  const owner        = wallet.publicKey!;
  const vaultPda     = getVaultPDA(owner, collateralMint);
  const ownerFluxAta = await getAssociatedTokenAddress(FLUX_MINT_PDA, owner);

  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(tokenAmount);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultPda,           isSigner: false, isWritable: true },
      { pubkey: PROGRAM_CONFIG_PDA, isSigner: false, isWritable: true },
      { pubkey: FLUX_MINT_PDA,      isSigner: false, isWritable: true },
      { pubkey: ownerFluxAta,       isSigner: false, isWritable: true },
      { pubkey: owner,              isSigner: true,  isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([getDisc("repay"), amtBuf]),
  });

  return buildTx(connection, owner, [ix]);
}

export async function buildWithdrawTx(
  connection: Connection,
  wallet: WalletContextState,
  collateralMint: PublicKey,
  amount: bigint
): Promise<Transaction> {
  const owner    = wallet.publicKey!;
  const vaultPda = getVaultPDA(owner, collateralMint);
  const ownerAta = await getAssociatedTokenAddress(collateralMint, owner);
  const escrow   = await getAssociatedTokenAddress(collateralMint, vaultPda, true);

  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(amount);

  const ix = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vaultPda,            isSigner: false, isWritable: true },
      { pubkey: PROGRAM_CONFIG_PDA,  isSigner: false, isWritable: true },
      { pubkey: ORACLE_STATE_PDA,    isSigner: false, isWritable: false },
      { pubkey: escrow,              isSigner: false, isWritable: true },
      { pubkey: ownerAta,            isSigner: false, isWritable: true },
      { pubkey: collateralMint,      isSigner: false, isWritable: false },
      { pubkey: owner,               isSigner: true,  isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,    isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([getDisc("withdraw"), amtBuf]),
  });

  return buildTx(connection, owner, [ix]);
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function buildTx(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<Transaction> {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  tx.add(...instructions);
  return tx;
}
