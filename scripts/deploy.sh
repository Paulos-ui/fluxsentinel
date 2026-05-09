#!/usr/bin/env bash
# scripts/deploy.sh — Build and deploy all FluxSentinel programs
set -e

CLUSTER=${1:-localnet}
echo "=== Deploying FluxSentinel to: $CLUSTER ==="

# Set cluster
if [ "$CLUSTER" = "devnet" ]; then
  solana config set --url devnet
  ANCHOR_ARGS="--provider.cluster devnet"
else
  solana config set --url localhost
  ANCHOR_ARGS="--provider.cluster localnet"
fi

WALLET=$(solana config get | grep "Keypair Path" | awk '{print $3}')
PUBKEY=$(solana-keygen pubkey $WALLET)
echo "Deployer: $PUBKEY"

# Check balance
if [ "$CLUSTER" = "devnet" ]; then
  BAL=$(solana balance --url devnet | awk '{print $1}')
  echo "Balance: $BAL SOL"
  if (( $(echo "$BAL < 2" | bc -l) )); then
    echo "Airdropping 2 SOL..."
    solana airdrop 2 --url devnet
    sleep 3
  fi
else
  # Localnet — airdrop to self
  solana airdrop 10 --url localhost 2>/dev/null || true
fi

# Build
echo ""
echo "Building programs..."
anchor build
echo "✓ Build complete"

# Deploy in order (oracle first, then breaker, then vault)
echo ""
echo "Deploying risk_oracle..."
anchor deploy --program-name risk_oracle $ANCHOR_ARGS
echo "✓ risk_oracle deployed"

echo "Deploying circuit_breaker..."
anchor deploy --program-name circuit_breaker $ANCHOR_ARGS
echo "✓ circuit_breaker deployed"

echo "Deploying rwa_vault..."
anchor deploy --program-name rwa_vault $ANCHOR_ARGS
echo "✓ rwa_vault deployed"

# Read deployed program IDs from Anchor.toml or keypairs
ORACLE_ID=$(solana-keygen pubkey target/deploy/risk_oracle-keypair.json 2>/dev/null || echo "NOT_DEPLOYED")
BREAKER_ID=$(solana-keygen pubkey target/deploy/circuit_breaker-keypair.json 2>/dev/null || echo "NOT_DEPLOYED")
VAULT_ID=$(solana-keygen pubkey target/deploy/rwa_vault-keypair.json 2>/dev/null || echo "NOT_DEPLOYED")

echo ""
echo "=== Deployed Program IDs ==="
echo "risk_oracle:     $ORACLE_ID"
echo "circuit_breaker: $BREAKER_ID"
echo "rwa_vault:       $VAULT_ID"

# Update .env.local
ENV_FILE="app/.env.local"
if [ -f "$ENV_FILE" ]; then
  sed -i.bak "s|NEXT_PUBLIC_ORACLE_PROGRAM_ID=.*|NEXT_PUBLIC_ORACLE_PROGRAM_ID=$ORACLE_ID|" $ENV_FILE
  sed -i.bak "s|NEXT_PUBLIC_BREAKER_PROGRAM_ID=.*|NEXT_PUBLIC_BREAKER_PROGRAM_ID=$BREAKER_ID|" $ENV_FILE
  sed -i.bak "s|NEXT_PUBLIC_VAULT_PROGRAM_ID=.*|NEXT_PUBLIC_VAULT_PROGRAM_ID=$VAULT_ID|" $ENV_FILE
  rm -f ${ENV_FILE}.bak
  echo "✓ Updated app/.env.local with program IDs"
fi

# Initialize oracle program
echo ""
echo "Initializing oracle program..."
node scripts/initialize.js $CLUSTER $ORACLE_ID $VAULT_ID
echo "✓ Programs initialized"

echo ""
echo "=== Deployment complete! ==="
echo ""
echo "Run the app: yarn dev"
echo "Then open:   http://localhost:3000"
