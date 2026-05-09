#!/usr/bin/env bash
# scripts/setup.sh — One-time local setup
set -e

echo "=== FluxSentinel Setup ==="

# Check dependencies
command -v solana  >/dev/null || { echo "ERROR: solana CLI not found. Install: https://docs.solana.com/cli/install-solana-cli-tools"; exit 1; }
command -v anchor  >/dev/null || { echo "ERROR: anchor not found. Install: https://www.anchor-lang.com/docs/installation"; exit 1; }
command -v node    >/dev/null || { echo "ERROR: node not found. Install: https://nodejs.org"; exit 1; }
command -v yarn    >/dev/null || { echo "ERROR: yarn not found. Install: npm i -g yarn"; exit 1; }

echo "✓ Dependencies found"

# Create keypair if needed
if [ ! -f ~/.config/solana/id.json ]; then
  echo "Creating new Solana keypair..."
  solana-keygen new --no-bip39-passphrase
fi

# Set to localnet by default
solana config set --url localhost
echo "✓ Solana CLI configured for localhost"

# Install JS dependencies
echo "Installing JS dependencies..."
cd "$(dirname "$0")/.."
yarn install --silent
echo "✓ Dependencies installed"

# Copy env file
if [ ! -f app/.env.local ]; then
  cp app/.env.local.example app/.env.local
  echo "✓ Created app/.env.local — review and update if needed"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Start local validator:  solana-test-validator"
echo "  2. Deploy programs:        yarn deploy:programs"
echo "  3. Run the app:            yarn dev"
echo ""
