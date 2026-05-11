/**
 * scripts/debug-deposit.js
 *
 * Tests the deposit flow directly using your CLI keypair, bypassing Phantom.
 * This proves whether the issue is Phantom or the on-chain program.
 *
 * Usage:
 *   node scripts/debug-deposit.js
 *
 * It will:
 *   1. Load your CLI keypair (~/.config/solana/id.json)
 *   2. Check if vault PDA exists for that wallet
 *   3. If not, create it
 *   4. If yes, attempt a deposit of 1 USDC and print the actual error
 */

const {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createHash } = require("crypto");

// ── Config ─────────────────────────────────────────────────────────────────
const RPC = "https://api.devnet.solana.com";
const ORACLE_PROGRAM_ID = new PublicKey("u6LFtFvriSjCibNRsFBJgPi61m4LkDPLXM3HYndFMJX");
const VAULT_PROGRAM_ID  = new PublicKey("27LUs2phpTGbAQ5vkb1K44Aa45HW2JoViFat5st8keFE");
const COLLATERAL_MINT   = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// ── PDAs ───────────────────────────────────────────────────────────────────
const [ORACLE_STATE_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle_v1")],
  ORACLE_PROGRAM_ID
);
const [PROGRAM_CONFIG_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  VAULT_PROGRAM_ID
);

function disc(name) {
  return createHash("sha256").update(`global:${name}`).digest().slice(0, 8);
}

function getVaultPDA(owner, mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer(), mint.toBuffer()],
    VAULT_PROGRAM_ID
  )[0];
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const keyPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, "utf-8")))
  );

  console.log("\n═══ DEBUG: DEPOSIT FLOW ═══\n");
  console.log("Wallet:        ", keypair.publicKey.toBase58());
  console.log("Vault Program: ", VAULT_PROGRAM_ID.toBase58());
  console.log("Oracle Program:", ORACLE_PROGRAM_ID.toBase58());
  console.log("USDC mint:     ", COLLATERAL_MINT.toBase58());

  const connection = new Connection(RPC, "confirmed");
  const owner = keypair.publicKey;

  // Compute all required addresses
  const vaultPda = getVaultPDA(owner, COLLATERAL_MINT);
  const ownerAta = await getAssociatedTokenAddress(COLLATERAL_MINT, owner);
  const escrow   = await getAssociatedTokenAddress(COLLATERAL_MINT, vaultPda, true);

  console.log("\n── Computed addresses ──");
  console.log("Vault PDA:     ", vaultPda.toBase58());
  console.log("Owner ATA:     ", ownerAta.toBase58());
  console.log("Escrow ATA:    ", escrow.toBase58());
  console.log("Config PDA:    ", PROGRAM_CONFIG_PDA.toBase58());
  console.log("Oracle PDA:    ", ORACLE_STATE_PDA.toBase58());

  // ── Check what exists on-chain ──
  console.log("\n── On-chain state ──");

  const vaultInfo = await connection.getAccountInfo(vaultPda);
  console.log("Vault PDA:     ", vaultInfo ? `EXISTS (${vaultInfo.data.length} bytes)` : "MISSING");

  const ataInfo = await connection.getAccountInfo(ownerAta);
  console.log("Owner ATA:     ", ataInfo ? `EXISTS (${ataInfo.data.length} bytes)` : "MISSING");

  if (ataInfo && ataInfo.data.length >= 72) {
    const balance = ataInfo.data.readBigUInt64LE(64);
    console.log("Owner balance: ", balance.toString(), "raw units (=", Number(balance) / 1e6, "USDC)");
  }

  const oracleInfo = await connection.getAccountInfo(ORACLE_STATE_PDA);
  if (oracleInfo) {
    const score = oracleInfo.data.readUInt8(40); // approx offset
    const ts = oracleInfo.data.readBigInt64LE(46);
    const age = Math.floor(Date.now() / 1000) - Number(ts);
    console.log(`Oracle score: ${score}, last updated ${age}s ago ${age > 300 ? "⚠ STALE" : "✓ FRESH"}`);
  } else {
    console.log("Oracle PDA:    MISSING (this is BAD)");
  }

  if (!vaultInfo) {
    console.log("\n❌ VAULT DOES NOT EXIST FOR THIS WALLET");
    console.log("Need to call open_vault first. Run this with: node scripts/debug-deposit.js open");
    if (process.argv[2] !== "open") process.exit(1);

    console.log("\n→ Opening vault...");
    const priceBuffer = Buffer.alloc(8);
    priceBuffer.writeBigUInt64LE(100_000_000n); // 100 cents per 1e6 units = $1.00/token

    const ix = new TransactionInstruction({
      programId: VAULT_PROGRAM_ID,
      keys: [
        { pubkey: vaultPda,                isSigner: false, isWritable: true },
        { pubkey: PROGRAM_CONFIG_PDA,      isSigner: false, isWritable: true },
        { pubkey: COLLATERAL_MINT,         isSigner: false, isWritable: false },
        { pubkey: owner,                   isSigner: true,  isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc("open_vault"), priceBuffer]),
    });

    try {
      const sig = await sendAndConfirmTransaction(
        connection,
        new Transaction().add(ix),
        [keypair]
      );
      console.log("✓ Vault opened:", sig);
      console.log("  https://solscan.io/tx/" + sig + "?cluster=devnet");
    } catch (e) {
      console.log("\n❌ OPEN_VAULT FAILED:");
      console.log(e.message);
      if (e.logs) console.log("Logs:", e.logs.join("\n"));
      process.exit(1);
    }
    process.exit(0);
  }

  // ── Try deposit ──
  console.log("\n→ Attempting deposit of 1 USDC (1,000,000 raw units)...");
  const amount = 1_000_000n;
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
      { pubkey: COLLATERAL_MINT,               isSigner: false, isWritable: false },
      { pubkey: owner,                         isSigner: true,  isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID,              isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,            isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("deposit"), amtBuf]),
  });

  try {
    const sig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(ix),
      [keypair],
      { commitment: "confirmed" }
    );
    console.log("\n✅ DEPOSIT SUCCEEDED:", sig);
    console.log("   https://solscan.io/tx/" + sig + "?cluster=devnet");
  } catch (e) {
    console.log("\n❌ DEPOSIT FAILED ON-CHAIN:");
    console.log("Message:", e.message);
    if (e.logs) {
      console.log("\n── Program logs ──");
      e.logs.forEach((line) => console.log("  " + line));
    }
    if (e.signature) {
      console.log("\nTransaction:", "https://solscan.io/tx/" + e.signature + "?cluster=devnet");
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
