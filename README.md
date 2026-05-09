# FluxSentinel — MVP

RWA-backed stablecoin protocol with real-time on-chain security scoring. Built on Solana + Anchor.

---

## Project Structure

```
fluxsentinel-mvp/
├── programs/
│   ├── risk_oracle/      # On-chain security score storage
│   ├── circuit_breaker/  # Protocol state enforcement
│   └── rwa_vault/        # Vault + FluxUSD minting
├── app/                  # Next.js frontend
│   └── src/
│       ├── app/          # Pages (dashboard, mint, explorer)
│       ├── components/   # UI components
│       ├── hooks/        # Oracle store, vault hook
│       ├── lib/          # Anchor client, tx builders
│       └── config/       # Program IDs, constants
├── mock-engine/          # Mock risk engine (submits scores)
└── scripts/              # Setup, deploy, initialize
```

---

## Quick Start — Local Development

### Prerequisites

```bash
# Solana CLI >= 1.18
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"

# Anchor >= 0.30.1
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.1 && avm use 0.30.1

# Node.js >= 20
# Yarn: npm install -g yarn
```

### Step 1 — Setup

```bash
git clone https://github.com/your-org/fluxsentinel-mvp
cd fluxsentinel-mvp

yarn setup
# This installs dependencies and creates app/.env.local
```

### Step 2 — Start Local Validator

```bash
# In a separate terminal:
solana-test-validator --reset

# Keep this running throughout development
```

### Step 3 — Deploy Programs

```bash
yarn deploy:programs
# Builds all 3 Anchor programs, deploys to localhost, initializes accounts
# Automatically updates app/.env.local with deployed program IDs
```

### Step 4 — Start Mock Risk Engine

```bash
# In a separate terminal:
yarn dev:engine
# Submits score updates every 30s. Requires oracle to be initialized.
```

### Step 5 — Start Frontend

```bash
# In another terminal:
yarn dev:app
# Opens at http://localhost:3000
```

### Step 6 — Connect Phantom Wallet

1. Open http://localhost:3000
2. Click **CONNECT WALLET** in the sidebar
3. Select Phantom
4. In Phantom settings → Developer Settings → Change Network to **Localhost**
5. Airdrop SOL: `solana airdrop 2 <YOUR_WALLET_ADDRESS>`

---

## What You Can Do (MVP Flow)

1. **Dashboard** — See the live security score (updated by mock engine every 30s)
2. **Mint/Vault** — Connect wallet → Open Vault → Deposit collateral → Mint FluxUSD
3. **Risk Explorer** — View score history chart + component breakdown

---

## Environment Variables

Copy `app/.env.local.example` to `app/.env.local`:

```bash
# Solana network
NEXT_PUBLIC_RPC_URL=http://localhost:8899     # localnet
NEXT_PUBLIC_WS_URL=ws://localhost:8900
NEXT_PUBLIC_NETWORK=localnet

# Program IDs (auto-filled by deploy script)
NEXT_PUBLIC_ORACLE_PROGRAM_ID=FSRsk...
NEXT_PUBLIC_BREAKER_PROGRAM_ID=FSCrk...
NEXT_PUBLIC_VAULT_PROGRAM_ID=FSVlt...

# Mock engine
ORACLE_AUTHORITY_KEY_PATH=~/.config/solana/id.json
ENGINE_INTERVAL_MS=30000
```

---

## Devnet Deployment

### 1. Deploy Programs to Devnet

```bash
# Get devnet SOL
solana airdrop 2 --url devnet

# Deploy (pass "devnet" as argument)
yarn deploy:programs devnet

# Or manually:
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

### 2. Update .env.local for Devnet

```bash
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_WS_URL=wss://api.devnet.solana.com
NEXT_PUBLIC_NETWORK=devnet

# Use Helius for higher rate limits (recommended):
# NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

### 3. Run Mock Engine Against Devnet

```bash
RPC_URL=https://api.devnet.solana.com yarn dev:engine
```

---

## Deploy Frontend to Vercel

### Method 1 — Vercel CLI

```bash
npm install -g vercel
cd app
vercel

# Set environment variables when prompted:
# NEXT_PUBLIC_RPC_URL = https://api.devnet.solana.com
# NEXT_PUBLIC_NETWORK = devnet
# NEXT_PUBLIC_ORACLE_PROGRAM_ID = <your deployed oracle ID>
# NEXT_PUBLIC_BREAKER_PROGRAM_ID = <your deployed breaker ID>
# NEXT_PUBLIC_VAULT_PROGRAM_ID = <your deployed vault ID>
```

### Method 2 — Vercel Dashboard

1. Push to GitHub
2. Go to vercel.com → New Project → Import your repo
3. **Root Directory**: set to `app`
4. **Framework**: Next.js
5. **Environment Variables** — add all `NEXT_PUBLIC_*` vars:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_NETWORK` | `devnet` |
| `NEXT_PUBLIC_ORACLE_PROGRAM_ID` | Your oracle program ID |
| `NEXT_PUBLIC_BREAKER_PROGRAM_ID` | Your breaker program ID |
| `NEXT_PUBLIC_VAULT_PROGRAM_ID` | Your vault program ID |

6. Click **Deploy**

### Recommended: Helius RPC for Vercel

Free Helius account gives you 100k req/day on devnet — much better than public RPC:

1. Sign up at https://helius.dev
2. Create a devnet API key
3. Set: `NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY`

---

## Architecture Summary

```
Browser (Phantom wallet)
    ↓ signs transactions
Next.js App (Vercel)
    ↓ reads oracle account every 10s
    ↓ submits txs via wallet adapter
Solana (devnet/localnet)
    ├── risk_oracle       — stores security score S(t)
    ├── circuit_breaker   — enforces Open/Restricted/Frozen states
    └── rwa_vault         — vault collateral + FluxUSD minting

Mock Risk Engine (your server / separate process)
    └── submits update_score every 30s → risk_oracle
```

### Score Formula

```
S(t) = 100 - (0.35×Lr + 0.30×At + 0.20×Od + 0.15×Vs)

Score ≥ 80: Open        — all ops permitted, 150% collateral ratio
Score 60–79: Restricted — minting blocked, 200% ratio
Score < 60: Frozen      — all mutations blocked
Score stale (>5min): Frozen — treated as max risk (fail-safe)
```

---

## Common Issues

**"Oracle account not found"**
→ Deploy programs first: `yarn deploy:programs`

**"Transaction simulation failed: insufficient funds"**
→ Airdrop SOL: `solana airdrop 2`

**Phantom shows wrong network**
→ In Phantom: Settings → Developer Settings → Change to Localhost or Devnet

**Score not updating**
→ Check mock engine is running: `yarn dev:engine`
→ Check oracle is initialized: `solana account <ORACLE_PDA>`

**Vercel build fails**
→ Ensure root directory is set to `app/` (not the repo root)
→ Check all `NEXT_PUBLIC_*` env vars are set in Vercel dashboard

---

## Program IDs (Localnet Defaults)

These are placeholder IDs replaced by the deploy script:

| Program | Placeholder ID |
|---|---|
| risk_oracle | `FSRsk1111111111111111111111111111111111111111` |
| circuit_breaker | `FSCrk1111111111111111111111111111111111111111` |
| rwa_vault | `FSVlt1111111111111111111111111111111111111111` |
