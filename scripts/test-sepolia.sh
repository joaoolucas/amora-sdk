#!/bin/bash
# Integration test for Amora on Starknet Sepolia using sncast
set -e

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK_DIR="$PROJECT_ROOT/sdk"

AMORA_ADDRESS="0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2"
PROFILE="sepolia"

echo "=== Amora Sepolia Integration Test (sncast) ==="
echo "Project root: $PROJECT_ROOT"
echo

# Generate test keys using the SDK
echo "--- Step 1: Generate Test Keys ---"
KEYS=$(cd "$SDK_DIR" && npx tsx -e "
const { generateKeys, encodeMetaAddress } = require('./dist/index.js');
const keys = generateKeys();
console.log(JSON.stringify({
  spendingPubKey: '0x' + keys.spendingKey.publicKey.toString(16),
  viewingPubKey: '0x' + keys.viewingKey.publicKey.toString(16),
  metaAddress: encodeMetaAddress(keys)
}));
")

SPENDING_PUBKEY=$(echo $KEYS | jq -r '.spendingPubKey')
VIEWING_PUBKEY=$(echo $KEYS | jq -r '.viewingPubKey')
META_ADDRESS=$(echo $KEYS | jq -r '.metaAddress')

echo "Spending public key: $SPENDING_PUBKEY"
echo "Viewing public key: $VIEWING_PUBKEY"
echo "Meta-address: $META_ADDRESS"
echo

# Check if already registered
echo "--- Step 2: Check Registration Status ---"
DEPLOYER="0xdd6e2acdf0602b8ff2a1dd23c7bf382c4d0afaabc4daec909f6af0135a5105"
IS_REGISTERED=$(cd "$PROJECT_ROOT" && sncast --profile $PROFILE call \
  --contract-address $AMORA_ADDRESS \
  --function is_registered \
  --calldata $DEPLOYER 2>&1 | grep "response:" | awk '{print $2}' | tr -d '[]')

echo "Deployer registered: $IS_REGISTERED"
echo

# Register keys
echo "--- Step 3: Register Meta-Address ---"
if [ "$IS_REGISTERED" = "0x0" ]; then
  echo "Registering keys..."
  cd "$PROJECT_ROOT" && sncast --profile $PROFILE invoke \
    --contract-address $AMORA_ADDRESS \
    --function register_keys \
    --calldata $SPENDING_PUBKEY $VIEWING_PUBKEY
  echo "Waiting for transaction confirmation..."
  sleep 15
else
  echo "Already registered, skipping..."
fi
echo

# Verify registration
echo "--- Step 4: Verify Registration ---"
RESULT=$(cd "$PROJECT_ROOT" && sncast --profile $PROFILE call \
  --contract-address $AMORA_ADDRESS \
  --function get_meta_address \
  --calldata $DEPLOYER 2>&1)
echo "$RESULT"
echo

# Generate stealth address and announce
echo "--- Step 5: Generate Stealth Address ---"
STEALTH=$(cd "$SDK_DIR" && npx tsx -e "
const { generateStealthAddress, parseMetaAddress } = require('./dist/index.js');
const meta = parseMetaAddress('$META_ADDRESS');
const result = generateStealthAddress(meta, '0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a');
console.log(JSON.stringify({
  stealthAddress: result.stealthAddress,
  ephemeralPubKey: '0x' + result.ephemeralPubKey.toString(16),
  viewTag: result.viewTag
}));
")

STEALTH_ADDRESS=$(echo $STEALTH | jq -r '.stealthAddress')
EPHEMERAL_PUBKEY=$(echo $STEALTH | jq -r '.ephemeralPubKey')
VIEW_TAG=$(echo $STEALTH | jq -r '.viewTag')

echo "Stealth address: $STEALTH_ADDRESS"
echo "Ephemeral public key: $EPHEMERAL_PUBKEY"
echo "View tag: $VIEW_TAG"
echo

# Send announcement
echo "--- Step 6: Send Announcement ---"
cd "$PROJECT_ROOT" && sncast --profile $PROFILE invoke \
  --contract-address $AMORA_ADDRESS \
  --function announce \
  --calldata $STEALTH_ADDRESS $EPHEMERAL_PUBKEY $VIEW_TAG 0

echo
echo "=== Test Complete ==="
echo "Check the explorer for transactions:"
echo "https://sepolia.starkscan.co/contract/$AMORA_ADDRESS"
