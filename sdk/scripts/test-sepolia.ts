/**
 * Integration test script for Amora on Sepolia testnet
 *
 * This script demonstrates the full stealth address flow:
 * 1. Generate recipient keys
 * 2. Register meta-address
 * 3. Generate stealth address and send tokens
 * 4. Scan for payments
 * 5. Verify the stealth private key works
 *
 * Usage:
 *   npx tsx scripts/test-sepolia.ts
 */

import { RpcProvider, Account } from "starknet";
import {
  Amora,
  generateKeys,
  encodeMetaAddress,
  derivePublicKey,
} from "../src/index";

// Configuration from deployments/sepolia.json
const CONFIG = {
  // Chainstack Starknet Sepolia RPC
  rpc: "https://starknet-sepolia.core.chainstack.com/572113f9e0575edfa160e9940828d86b",
  amoraAddress:
    "0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2",
  stealthAccountClassHash:
    "0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a",
  // Deployer account from accounts.json
  deployer: {
    address:
      "0xdd6e2acdf0602b8ff2a1dd23c7bf382c4d0afaabc4daec909f6af0135a5105",
    privateKey:
      "0x981de34300a183256e550c1263c2ffcbaef3dfbbd0b25a61f8b93ec38c2cc",
  },
  // ETH token address on Sepolia
  ethAddress:
    "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
};

async function main() {
  console.log("=== Amora Sepolia Integration Test ===\n");

  // 1. Setup provider and account (starknet.js v6 API)
  const provider = new RpcProvider({ nodeUrl: CONFIG.rpc });
  const deployerAccount = new Account(
    provider,
    CONFIG.deployer.address,
    CONFIG.deployer.privateKey
  );

  // Initialize Amora SDK
  const amora = new Amora({
    provider,
    amoraAddress: CONFIG.amoraAddress,
    accountClassHash: CONFIG.stealthAccountClassHash,
  });

  console.log("Provider connected to Sepolia");
  console.log(`Amora Registry: ${CONFIG.amoraAddress}`);
  console.log(`Deployer: ${CONFIG.deployer.address}\n`);

  // 2. Generate recipient keys
  console.log("--- Step 1: Generate Recipient Keys ---");
  const recipientKeys = generateKeys();
  const metaAddress = encodeMetaAddress(recipientKeys);
  console.log(`Meta-address: ${metaAddress}`);
  console.log(
    `Spending public key: 0x${recipientKeys.spendingKey.publicKey.toString(16)}`
  );
  console.log(
    `Viewing public key: 0x${recipientKeys.viewingKey.publicKey.toString(16)}\n`
  );

  // 3. Register meta-address
  console.log("--- Step 2: Register Meta-Address ---");
  try {
    const registerTx = await amora.register(deployerAccount, recipientKeys);
    console.log(`Registration tx: ${registerTx.transaction_hash}`);
    console.log("Waiting for confirmation...");
    await provider.waitForTransaction(registerTx.transaction_hash);
    console.log("Registration confirmed!\n");
  } catch (e: any) {
    if (e.message?.includes("already registered")) {
      console.log("Already registered, continuing...\n");
    } else {
      throw e;
    }
  }

  // 4. Verify registration
  console.log("--- Step 3: Verify Registration ---");
  const isRegistered = await amora.isRegistered(CONFIG.deployer.address);
  console.log(`Is registered: ${isRegistered}`);
  const fetchedMeta = await amora.getMetaAddress(CONFIG.deployer.address);
  if (fetchedMeta) {
    console.log(
      `Fetched spending key: 0x${fetchedMeta.spendingPubKey.toString(16)}`
    );
    console.log(
      `Fetched viewing key: 0x${fetchedMeta.viewingPubKey.toString(16)}\n`
    );
  }

  // 5. Generate stealth address
  console.log("--- Step 4: Generate Stealth Address ---");
  const stealthResult = amora.generateStealthAddress(metaAddress);
  console.log(`Stealth address: ${stealthResult.stealthAddress}`);
  console.log(
    `Stealth public key: 0x${stealthResult.stealthPubKey.toString(16)}`
  );
  console.log(
    `Ephemeral public key: 0x${stealthResult.ephemeralPubKey.toString(16)}`
  );
  console.log(`View tag: ${stealthResult.viewTag}\n`);

  // 6. Send announcement (without actual token transfer to save gas)
  console.log("--- Step 5: Send Announcement ---");
  console.log(
    "Sending announcement only (no token transfer to conserve testnet ETH)..."
  );

  const announceCall = {
    contractAddress: CONFIG.amoraAddress,
    entrypoint: "announce",
    calldata: [
      stealthResult.stealthAddress,
      stealthResult.ephemeralPubKey.toString(),
      stealthResult.viewTag.toString(),
      "0", // metadata length
    ],
  };

  const announceTx = await deployerAccount.execute([announceCall]);
  console.log(`Announcement tx: ${announceTx.transaction_hash}`);
  console.log("Waiting for confirmation...");
  await provider.waitForTransaction(announceTx.transaction_hash);
  console.log("Announcement confirmed!\n");

  // 7. Scan for payments
  console.log("--- Step 6: Scan for Payments ---");
  console.log("Fetching recent announcements...");

  // Get current block
  const block = await provider.getBlockLatestAccepted();
  const currentBlock =
    typeof block.block_number === "number" ? block.block_number : 0;
  const fromBlock = Math.max(0, currentBlock - 100); // Last 100 blocks

  console.log(`Scanning blocks ${fromBlock} to ${currentBlock}...`);
  const payments = await amora.scan(recipientKeys, fromBlock);
  console.log(`Found ${payments.length} payment(s) for this recipient\n`);

  if (payments.length > 0) {
    const payment = payments[payments.length - 1]; // Most recent
    console.log("--- Payment Details ---");
    console.log(`Stealth address: ${payment.announcement.stealthAddress}`);
    console.log(`Shared secret: 0x${payment.sharedSecret.toString(16)}`);
    console.log(
      `Stealth private key: 0x${payment.stealthPrivateKey.toString(16)}`
    );

    // Verify the private key derives the correct public key
    const derivedPubKey = derivePublicKey(payment.stealthPrivateKey);
    console.log(`\nVerification:`);
    console.log(`  Expected stealth pubkey: 0x${payment.stealthPubKey.toString(16)}`);
    console.log(`  Derived from privkey:    0x${derivedPubKey.toString(16)}`);
    console.log(`  Match: ${derivedPubKey === payment.stealthPubKey}`);
  }

  console.log("\n=== Test Complete ===");
  console.log(
    "\nTo perform a full test with token transfer, ensure the deployer has testnet ETH"
  );
  console.log("and uncomment the token transfer section in this script.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
