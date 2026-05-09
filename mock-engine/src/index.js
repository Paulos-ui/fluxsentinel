/**
 * FluxSentinel Mock Risk Engine
 */

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env.local"),
});

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const fs = require("fs");

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8899";
const UPDATE_INTERVAL_MS = parseInt(process.env.ENGINE_INTERVAL_MS || "30000");

// ── Oracle Program ID (FIXED SAFELY) ─────────────────────────────────────────

const ORACLE_PROGRAM_ID_RAW = process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID?.trim();

if (!ORACLE_PROGRAM_ID_RAW) {
  console.error("[engine] ❌ Missing NEXT_PUBLIC_ORACLE_PROGRAM_ID in .env.local");
  process.exit(1);
}

let oracleProgramId;

try {
  oracleProgramId = new PublicKey(ORACLE_PROGRAM_ID_RAW);
} catch (e) {
  console.error("[engine] ❌ Invalid ORACLE_PROGRAM_ID:", ORACLE_PROGRAM_ID_RAW);
  process.exit(1);
}

console.log("[engine] Oracle Program ID:", oracleProgramId.toBase58());

// ── Load authority keypair ────────────────────────────────────────────────────

let authorityKeypair;
try {
  // Try env var first (for cloud deploy), fallback to file (for local dev)
  if (process.env.ORACLE_AUTHORITY_KEY_JSON) {
    const raw = process.env.ORACLE_AUTHORITY_KEY_JSON;
    authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } else {
    const keyPath = process.env.ORACLE_AUTHORITY_KEY_PATH || `${process.env.HOME}/.config/solana/id.json`;
    const raw = fs.readFileSync(keyPath, "utf-8");
    authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  console.log(`[engine] Authority: ${authorityKeypair.publicKey.toBase58()}`);
} catch (e) {
  console.error("[engine] Could not load keypair:", e.message);
  console.error("[engine] Set ORACLE_AUTHORITY_KEY_JSON (cloud) or ORACLE_AUTHORITY_KEY_PATH (local)");
  process.exit(1);
}

// ── Connection ────────────────────────────────────────────────────────────────

const connection = new Connection(RPC_URL, "confirmed");

// ── Derive oracle PDA ────────────────────────────────────────────────────────

const [oracleStatePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle_v1")],
  oracleProgramId
);

// ── Score simulation ──────────────────────────────────────────────────────────

let cycleCount = 0;

function computeComponents() {
  const lr = Math.max(
    0,
    Math.min(
      100,
      15 + Math.sin(cycleCount * 0.1) * 8 + Math.random() * 5
    )
  );

  const at = Math.max(
    0,
    Math.min(
      100,
      cycleCount % 20 === 0
        ? 35 + Math.random() * 20
        : 5 + Math.random() * 10
    )
  );

  const od = Math.max(
    0,
    Math.min(
      100,
      12 + Math.cos(cycleCount * 0.07) * 6 + Math.random() * 4
    )
  );

  const vs = Math.max(0, Math.min(100, 8 + Math.random() * 6));

  const composite =
    100 - (0.35 * lr + 0.3 * at + 0.2 * od + 0.15 * vs);

  return {
    score: Math.max(0, Math.min(100, Math.round(composite))),
    lr: Math.round(lr),
    at: Math.round(at),
    od: Math.round(od),
    vs: Math.round(vs),
  };
}

// ── Submit to chain ───────────────────────────────────────────────────────────

async function submitScore({ score, lr, at, od, vs }) {
  const discriminator = Buffer.from([
    188, 226, 238, 41, 14, 241, 105, 215,
  ]);

  const data = Buffer.concat([
    discriminator,
    Buffer.from([score, lr, at, od, vs]),
  ]);

  const ix = new TransactionInstruction({
    programId: oracleProgramId,
    keys: [
      { pubkey: oracleStatePda, isSigner: false, isWritable: true },
      {
        pubkey: authorityKeypair.publicKey,
        isSigner: true,
        isWritable: false,
      },
    ],
    data,
  });

  const tx = new Transaction().add(ix);

  const { blockhash } = await connection.getLatestBlockhash();

  tx.recentBlockhash = blockhash;
  tx.feePayer = authorityKeypair.publicKey;

  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [authorityKeypair],
    { commitment: "confirmed" }
  );

  return sig;
}

// ── Loop ─────────────────────────────────────────────────────────────────────

async function tick() {
  cycleCount++;

  const components = computeComponents();

  console.log(
    `[engine] cycle=${cycleCount} score=${components.score} ` +
      `Lr=${components.lr} At=${components.at} Od=${components.od} Vs=${components.vs}`
  );

  try {
    const sig = await submitScore(components);
    console.log(`[engine] ✓ submitted — ${sig.slice(0, 20)}...`);
  } catch (err) {
    console.error(`[engine] ✗ submission failed:`, err.message);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[engine] Starting FluxSentinel Mock Engine`);
  console.log(`[engine] RPC: ${RPC_URL}`);
  console.log(`[engine] Oracle PDA: ${oracleStatePda.toBase58()}`);
  console.log(
    `[engine] Update interval: ${UPDATE_INTERVAL_MS}ms`
  );

  const info = await connection.getAccountInfo(oracleStatePda);

  if (!info) {
    console.error(
      "[engine] ❌ Oracle state account not found. Initialize program first."
    );
    process.exit(1);
  }

  console.log("[engine] Oracle account found. Running...\n");

  await tick();
  setInterval(tick, UPDATE_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[engine] Fatal:", err);
  process.exit(1);
});