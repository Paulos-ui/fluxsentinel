/**
 * scripts/gen-discriminators.js
 *
 * Run this AFTER `anchor build` to regenerate the DISC table in
 * app/src/lib/program.ts with the correct values for your compiled programs.
 *
 * Usage:
 *   node scripts/gen-discriminators.js
 *
 * It will print updated TypeScript you can paste into lib/program.ts.
 */

const { createHash } = require("crypto");

const INSTRUCTIONS = [
  // risk_oracle
  "initialize",
  "update_score",
  "rotate_authority",
  // circuit_breaker
  "query_state",
  "check_and_gate",
  // rwa_vault
  "open_vault",
  "deposit",
  "mint_flux",
  "repay",
  "withdraw",
];

function disc(name) {
  const hash = createHash("sha256").update(`global:${name}`).digest();
  return [...hash.slice(0, 8)];
}

console.log("// ── Generated discriminators ──────────────────────────────");
console.log("// Paste this into app/src/lib/program.ts → DISC constant\n");
console.log("const DISC: Record<string, number[]> = {");
for (const name of INSTRUCTIONS) {
  const d = disc(name);
  console.log(`  ${name.padEnd(20)}: [${d.join(",")}],`);
}
console.log("};");
console.log("\n// Verification — each discriminator should be 8 bytes:");
for (const name of INSTRUCTIONS) {
  console.log(`//   ${name}: ${disc(name).length} bytes ✓`);
}
