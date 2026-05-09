/**
 * scripts/initialize.js
 *
 * Initializes the oracle and vault programs after deployment.
 * Called automatically by deploy.sh
 *
 * Usage:
 *   node scripts/initialize.js [cluster] [oracle_program_id] [vault_program_id]
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
} = require("@solana/web3.js");
const { createHash } = require("crypto");
const fs = require("fs");

const cluster    = process.argv[2] || "localnet";
const oracleId   = process.argv[3];
const vaultId    = process.argv[4];

const RPC_URL = cluster === "devnet"
  ? "https://api.devnet.solana.com"
  : "http://localhost:8899";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOC_TOKEN   = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS");

function disc(name) {
  return createHash("sha256").update(`global:${name}`).digest().slice(0, 8);
}

async function main() {
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`[init] RPC:     ${RPC_URL}`);
  console.log(`[init] Payer:   ${payer.publicKey.toBase58()}`);

  if (!oracleId || !vaultId) {
    console.error("[init] Missing program IDs. Pass as arguments.");
    process.exit(1);
  }

  const oracleProgramId = new PublicKey(oracleId);
  const vaultProgramId  = new PublicKey(vaultId);

  // ── Derive PDAs ──────────────────────────────────────────────────────────
  const [oraclePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_v1")], oracleProgramId
  );
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")], vaultProgramId
  );
  const [fluxMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("flux_mint")], vaultProgramId
  );

  console.log(`[init] Oracle PDA: ${oraclePda.toBase58()}`);
  console.log(`[init] Config PDA: ${configPda.toBase58()}`);
  console.log(`[init] Flux Mint:  ${fluxMintPda.toBase58()}`);

  // ── Initialize oracle ────────────────────────────────────────────────────
  const oracleInfo = await connection.getAccountInfo(oraclePda);
  if (oracleInfo) {
    console.log("[init] Oracle already initialized — skipping");
  } else {
    console.log("[init] Initializing oracle...");

    // Data: discriminator(8) + authority pubkey(32)
    const data = Buffer.concat([
      disc("initialize"),
      payer.publicKey.toBuffer(),
    ]);

    const ix = new TransactionInstruction({
      programId: oracleProgramId,
      keys: [
        { pubkey: oraclePda,                    isSigner: false, isWritable: true },
        { pubkey: payer.publicKey,              isSigner: true,  isWritable: true },
        { pubkey: SystemProgram.programId,      isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log(`[init] ✓ Oracle initialized — ${sig.slice(0, 20)}...`);
  }

  // ── Initialize vault ─────────────────────────────────────────────────────
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo) {
    console.log("[init] Vault already initialized — skipping");
  } else {
    console.log("[init] Initializing vault...");

    const data = Buffer.concat([disc("initialize")]);

    const ix = new TransactionInstruction({
      programId: vaultProgramId,
      keys: [
        { pubkey: configPda,               isSigner: false, isWritable: true },
        { pubkey: fluxMintPda,             isSigner: false, isWritable: true },
        { pubkey: oraclePda,               isSigner: false, isWritable: false },
        { pubkey: payer.publicKey,         isSigner: true,  isWritable: true },
        { pubkey: TOKEN_PROGRAM,           isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log(`[init] ✓ Vault initialized — ${sig.slice(0, 20)}...`);
  }

  // ── Submit initial score ─────────────────────────────────────────────────
  console.log("[init] Submitting initial score (88)...");
  const scoreData = Buffer.concat([
    disc("update_score"),
    Buffer.from([88, 10, 8, 15, 5]), // score, lr, at, od, vs
  ]);

  const scoreIx = new TransactionInstruction({
    programId: oracleProgramId,
    keys: [
      { pubkey: oraclePda,       isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true,  isWritable: false },
    ],
    data: scoreData,
  });

  try {
    const tx  = new Transaction().add(scoreIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log(`[init] ✓ Initial score submitted — ${sig.slice(0, 20)}...`);
  } catch (e) {
    console.log("[init] Score submit failed (may already be set):", e.message);
  }

  console.log("\n[init] All programs initialized successfully!");
}

main().catch((e) => {
  console.error("[init] Fatal:", e);
  process.exit(1);
});
