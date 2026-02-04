// src/contracts.ts
import {
  Contract,
  Account,
  CallData
} from "starknet";

// src/stealth.ts
import { hash } from "starknet";

// src/crypto.ts
import {
  CURVE,
  ProjectivePoint,
  utils,
  poseidonHashMany,
  getPublicKey
} from "@scure/starknet";
var CURVE_ORDER = CURVE.n;
var FIELD_PRIME = CURVE.Fp.ORDER;
var ALPHA = CURVE.a;
var BETA = CURVE.b;
var SCHEME_ID_STARK = 357895852619;
function bigintToHex(n) {
  const hex = n.toString(16);
  return hex.padStart(64, "0");
}
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function normalizePrivateKey(privateKey) {
  const privateKeyHex = bigintToHex(privateKey);
  const point = ProjectivePoint.fromPrivateKey(privateKeyHex);
  if (point.y % 2n !== 0n) {
    return CURVE_ORDER - privateKey;
  }
  return privateKey;
}
function generatePrivateKey() {
  const bytes = utils.randomPrivateKey();
  const rawKey = BigInt("0x" + bytesToHex(bytes));
  return normalizePrivateKey(rawKey);
}
function derivePublicKey(privateKey) {
  const privateKeyHex = bigintToHex(privateKey);
  const pubKeyBytes = getPublicKey(privateKeyHex, true);
  const xCoordBytes = pubKeyBytes.slice(1);
  return BigInt("0x" + bytesToHex(xCoordBytes));
}
function scalarMultiply(scalar, pointX) {
  const point = recoverPoint(pointX);
  const result = point.multiply(scalar);
  return result.x;
}
function recoverPoint(x) {
  const x3 = CURVE.Fp.mul(CURVE.Fp.mul(x, x), x);
  const ax = CURVE.Fp.mul(ALPHA, x);
  const ySquared = CURVE.Fp.add(CURVE.Fp.add(x3, ax), BETA);
  const y = CURVE.Fp.sqrt(ySquared);
  if (y === void 0) {
    throw new Error("Invalid point: x-coordinate not on curve");
  }
  const finalY = y % 2n !== 0n ? CURVE.Fp.neg(y) : y;
  return new ProjectivePoint(x, finalY, 1n);
}
function poseidonHash(...inputs) {
  return poseidonHashMany(inputs);
}
function computeViewTag(sharedSecret) {
  const hash2 = poseidonHash(sharedSecret);
  return Number(hash2 & 0xffn);
}
function computeStealthPrivateKey(spendingPrivateKey, sharedSecret) {
  const hashValue = poseidonHash(sharedSecret);
  return (spendingPrivateKey + hashValue) % CURVE_ORDER;
}
function computeStealthPublicKey(spendingPubKey, sharedSecret) {
  const spendingPoint = recoverPoint(spendingPubKey);
  const hashValue = poseidonHash(sharedSecret);
  const hashPoint = ProjectivePoint.BASE.multiply(hashValue);
  const stealthPoint = spendingPoint.add(hashPoint);
  return stealthPoint.x;
}
function ecdh(privateKey, publicKey) {
  return scalarMultiply(privateKey, publicKey);
}

// src/stealth.ts
function generateStealthAddress(metaAddress, accountClassHash) {
  const ephemeralPrivateKey = generatePrivateKey();
  const ephemeralPubKey = derivePublicKey(ephemeralPrivateKey);
  const sharedSecret = ecdh(ephemeralPrivateKey, metaAddress.viewingPubKey);
  const viewTag = computeViewTag(sharedSecret);
  const stealthPubKey = computeStealthPublicKey(
    metaAddress.spendingPubKey,
    sharedSecret
  );
  const stealthAddress = computeStealthContractAddress(
    stealthPubKey,
    accountClassHash
  );
  return {
    stealthAddress,
    stealthPubKey,
    ephemeralPubKey,
    viewTag
  };
}
function generateStealthAddressWithKey(metaAddress, ephemeralPrivateKey, accountClassHash) {
  const ephemeralPubKey = derivePublicKey(ephemeralPrivateKey);
  const sharedSecret = ecdh(ephemeralPrivateKey, metaAddress.viewingPubKey);
  const viewTag = computeViewTag(sharedSecret);
  const stealthPubKey = computeStealthPublicKey(
    metaAddress.spendingPubKey,
    sharedSecret
  );
  const stealthAddress = computeStealthContractAddress(
    stealthPubKey,
    accountClassHash
  );
  return {
    stealthAddress,
    stealthPubKey,
    ephemeralPubKey,
    viewTag
  };
}
function computeStealthContractAddress(publicKey, classHash, salt) {
  const actualSalt = salt ?? publicKey;
  const constructorCalldata = [publicKey.toString()];
  const address = hash.calculateContractAddressFromHash(
    actualSalt.toString(),
    classHash,
    constructorCalldata,
    0
    // deployer_address = 0 for counterfactual deployment
  );
  return address;
}
function checkAnnouncementViewTag(announcement, viewingPrivateKey) {
  const sharedSecret = ecdh(viewingPrivateKey, announcement.ephemeralPubKey);
  const expectedViewTag = computeViewTag(sharedSecret);
  if (expectedViewTag !== announcement.viewTag) {
    return null;
  }
  return sharedSecret;
}
function verifyAndComputeStealthKey(announcement, viewingPrivateKey, spendingPublicKey, spendingPrivateKey, accountClassHash) {
  const sharedSecret = checkAnnouncementViewTag(announcement, viewingPrivateKey);
  if (sharedSecret === null) {
    return null;
  }
  const stealthPubKey = computeStealthPublicKey(spendingPublicKey, sharedSecret);
  const expectedAddress = computeStealthContractAddress(
    stealthPubKey,
    accountClassHash
  );
  if (normalizeAddress(expectedAddress) !== normalizeAddress(announcement.stealthAddress)) {
    return null;
  }
  const stealthPrivateKey = computeStealthPrivateKey(spendingPrivateKey, sharedSecret);
  return {
    announcement,
    sharedSecret,
    stealthPrivateKey,
    stealthPubKey
  };
}
function scanAnnouncements(announcements, viewingPrivateKey, spendingPublicKey, spendingPrivateKey, accountClassHash) {
  const payments = [];
  for (const announcement of announcements) {
    const payment = verifyAndComputeStealthKey(
      announcement,
      viewingPrivateKey,
      spendingPublicKey,
      spendingPrivateKey,
      accountClassHash
    );
    if (payment !== null) {
      payments.push(payment);
    }
  }
  return payments;
}
function computeStealthPrivateKey2(spendingPrivateKey, sharedSecret) {
  return computeStealthPrivateKey(spendingPrivateKey, sharedSecret);
}
function normalizeAddress(address) {
  const hex = address.toLowerCase().replace(/^0x0*/, "");
  return "0x" + hex;
}

// src/meta-address.ts
var META_ADDRESS_PREFIX = "st";
var CHAIN_ID = "starknet";
function encodeMetaAddress(keys) {
  return encodeMetaAddressFromPubKeys(
    keys.spendingKey.publicKey,
    keys.viewingKey.publicKey
  );
}
function encodeMetaAddressFromPubKeys(spendingPubKey, viewingPubKey) {
  const spendingHex = "0x" + spendingPubKey.toString(16);
  const viewingHex = "0x" + viewingPubKey.toString(16);
  return `${META_ADDRESS_PREFIX}:${CHAIN_ID}:${spendingHex}:${viewingHex}`;
}
function parseMetaAddress(metaAddress) {
  const parts = metaAddress.split(":");
  if (parts.length !== 4) {
    throw new Error(
      `Invalid meta-address format: expected 4 parts, got ${parts.length}`
    );
  }
  const [prefix, chain, spendingStr, viewingStr] = parts;
  if (prefix !== META_ADDRESS_PREFIX) {
    throw new Error(
      `Invalid meta-address prefix: expected "${META_ADDRESS_PREFIX}", got "${prefix}"`
    );
  }
  if (chain !== CHAIN_ID) {
    throw new Error(
      `Invalid chain ID: expected "${CHAIN_ID}", got "${chain}"`
    );
  }
  const spendingPubKey = parseFelt(spendingStr, "spending public key");
  const viewingPubKey = parseFelt(viewingStr, "viewing public key");
  return {
    chain,
    spendingPubKey,
    viewingPubKey
  };
}
function parseFelt(value, fieldName) {
  try {
    const normalized = value.startsWith("0x") ? value : `0x${value}`;
    const result = BigInt(normalized);
    const MAX_FELT = 2n ** 252n;
    if (result >= MAX_FELT || result < 0n) {
      throw new Error(`${fieldName} is out of felt252 range`);
    }
    return result;
  } catch (e) {
    if (e instanceof Error && e.message.includes("out of felt252 range")) {
      throw e;
    }
    throw new Error(`Invalid ${fieldName}: cannot parse "${value}" as hex`);
  }
}
function isValidMetaAddress(metaAddress) {
  try {
    parseMetaAddress(metaAddress);
    return true;
  } catch {
    return false;
  }
}

// src/contracts.ts
var ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress"
      }
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view"
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      {
        name: "recipient",
        type: "core::starknet::contract_address::ContractAddress"
      },
      { name: "amount", type: "core::integer::u256" }
    ],
    outputs: [{ type: "bool" }],
    state_mutability: "external"
  }
];
var AMORA_ABI = [
  {
    name: "register_keys",
    type: "function",
    inputs: [
      { name: "spending_pubkey", type: "felt252" },
      { name: "viewing_pubkey", type: "felt252" }
    ],
    outputs: [],
    state_mutability: "external"
  },
  {
    name: "get_meta_address",
    type: "function",
    inputs: [{ name: "registrant", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "(felt252, felt252)" }],
    state_mutability: "view"
  },
  {
    name: "is_registered",
    type: "function",
    inputs: [{ name: "registrant", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "bool" }],
    state_mutability: "view"
  },
  {
    name: "announce",
    type: "function",
    inputs: [
      { name: "stealth_address", type: "core::starknet::contract_address::ContractAddress" },
      { name: "ephemeral_pubkey", type: "felt252" },
      { name: "view_tag", type: "u8" },
      { name: "metadata", type: "core::array::Array::<felt252>" }
    ],
    outputs: [],
    state_mutability: "external"
  }
];
var Amora = class {
  provider;
  amoraContract;
  accountClassHash;
  constructor(config) {
    this.provider = config.provider;
    this.accountClassHash = config.accountClassHash;
    this.amoraContract = new Contract(
      AMORA_ABI,
      config.amoraAddress,
      this.provider
    );
  }
  /**
   * Register a meta-address (spending + viewing public keys)
   * @param account - The account to register from
   * @param keys - The stealth keys to register
   * @returns The transaction response
   */
  async register(account, keys) {
    const spendingHex = "0x" + keys.spendingKey.publicKey.toString(16);
    const viewingHex = "0x" + keys.viewingKey.publicKey.toString(16);
    const call = {
      contractAddress: this.amoraContract.address,
      entrypoint: "register_keys",
      calldata: [spendingHex, viewingHex]
    };
    return account.execute([call]);
  }
  /**
   * Get a registered meta-address for an account
   * @param registrantAddress - The address to look up
   * @returns The parsed MetaAddress or null if not registered
   */
  async getMetaAddress(registrantAddress) {
    const result = await this.amoraContract.call("get_meta_address", [
      registrantAddress
    ]);
    const [spendingPubKey, viewingPubKey] = result;
    if (spendingPubKey === 0n || viewingPubKey === 0n) {
      return null;
    }
    return {
      chain: "starknet",
      spendingPubKey,
      viewingPubKey
    };
  }
  /**
   * Check if an address is registered
   * @param registrantAddress - The address to check
   * @returns True if registered
   */
  async isRegistered(registrantAddress) {
    const result = await this.amoraContract.call("is_registered", [
      registrantAddress
    ]);
    return result;
  }
  /**
   * Generate a stealth address for sending to a recipient
   * @param recipientMetaAddress - The recipient's meta-address (string or parsed)
   * @returns The stealth address generation result
   */
  generateStealthAddress(recipientMetaAddress) {
    const meta = typeof recipientMetaAddress === "string" ? parseMetaAddress(recipientMetaAddress) : recipientMetaAddress;
    return generateStealthAddress(meta, this.accountClassHash);
  }
  /**
   * Build calls for sending tokens to a stealth address
   * @param tokenAddress - The token contract address (ETH or ERC20)
   * @param amount - The amount to send (as bigint)
   * @param stealthResult - The result from generateStealthAddress
   * @param metadata - Optional metadata to include in announcement
   * @returns Array of calls to execute
   */
  buildSendCalls(tokenAddress, amount, stealthResult, metadata = []) {
    const transferCall = {
      contractAddress: tokenAddress,
      entrypoint: "transfer",
      calldata: CallData.compile({
        recipient: stealthResult.stealthAddress,
        amount: { low: amount & (1n << 128n) - 1n, high: amount >> 128n }
      })
    };
    const fullMetadata = [BigInt(tokenAddress), amount, ...metadata];
    const announceCall = {
      contractAddress: this.amoraContract.address,
      entrypoint: "announce",
      calldata: CallData.compile({
        stealth_address: stealthResult.stealthAddress,
        ephemeral_pubkey: stealthResult.ephemeralPubKey.toString(),
        view_tag: stealthResult.viewTag,
        metadata: fullMetadata.map((m) => m.toString())
      })
    };
    return [transferCall, announceCall];
  }
  /**
   * Send tokens to a stealth address (transfer + announce)
   * @param account - The sender's account
   * @param tokenAddress - The token contract address
   * @param amount - The amount to send
   * @param stealthResult - The result from generateStealthAddress
   * @param metadata - Optional additional metadata
   * @returns The transaction response
   */
  async send(account, tokenAddress, amount, stealthResult, metadata = []) {
    const calls = this.buildSendCalls(
      tokenAddress,
      amount,
      stealthResult,
      metadata
    );
    return account.execute(calls);
  }
  /**
   * Fetch announcements from the blockchain
   * @param fromBlock - Starting block number
   * @param toBlock - Ending block number (or "latest")
   * @returns Array of parsed announcements
   */
  async fetchAnnouncements(fromBlock, toBlock = "latest") {
    const provider = this.provider;
    const eventsResponse = await provider.getEvents({
      from_block: { block_number: fromBlock },
      to_block: toBlock === "latest" ? "latest" : { block_number: toBlock },
      address: this.amoraContract.address,
      keys: [],
      chunk_size: 1e3
    });
    const announcements = [];
    for (const event of eventsResponse.events) {
      try {
        const data = event.data;
        if (data.length < 4) continue;
        const stealthAddress = data[0];
        const ephemeralPubKey = BigInt(data[2]);
        const viewTag = Number(BigInt(data[3]));
        const metadataLen = Number(BigInt(data[4] || "0"));
        const metadata = [];
        for (let i = 0; i < metadataLen && i + 5 < data.length; i++) {
          metadata.push(BigInt(data[i + 5]));
        }
        announcements.push({
          stealthAddress,
          ephemeralPubKey,
          viewTag,
          metadata,
          blockNumber: event.block_number,
          transactionHash: event.transaction_hash
        });
      } catch (e) {
        console.warn("Failed to parse announcement event:", e);
      }
    }
    return announcements;
  }
  /**
   * Scan for payments addressed to a recipient
   * @param keys - The recipient's stealth keys
   * @param fromBlock - Starting block number
   * @param toBlock - Ending block number (or "latest")
   * @returns Array of matched stealth payments
   */
  async scan(keys, fromBlock, toBlock = "latest") {
    const announcements = await this.fetchAnnouncements(fromBlock, toBlock);
    return scanAnnouncements(
      announcements,
      keys.viewingKey.privateKey,
      keys.spendingKey.publicKey,
      keys.spendingKey.privateKey,
      this.accountClassHash
    );
  }
  /**
   * Deploy a stealth account and withdraw funds
   * @param stealthPrivateKey - The stealth private key
   * @param destinationAddress - Where to send the funds
   * @param tokenAddress - The token to withdraw
   * @param amount - The amount to withdraw (or "all" to withdraw everything)
   * @returns The transaction response
   */
  async deployAndWithdraw(stealthPrivateKey, destinationAddress, tokenAddress, amount) {
    const stealthPubKey = derivePublicKey(stealthPrivateKey);
    const stealthAddress = computeStealthContractAddress(
      stealthPubKey,
      this.accountClassHash
    );
    const stealthAccount = new Account(
      this.provider,
      stealthAddress,
      stealthPrivateKey.toString()
    );
    const isDeployed = await this.isAccountDeployed(stealthAddress);
    if (!isDeployed) {
      await this.deployStealthAccount(stealthPrivateKey, stealthPubKey);
    }
    let withdrawAmount;
    if (amount === "all") {
      const tokenContract = new Contract(
        ERC20_ABI,
        tokenAddress,
        this.provider
      );
      const balance = await tokenContract.call("balanceOf", [stealthAddress]);
      if (Array.isArray(balance)) {
        withdrawAmount = BigInt(balance[0]) + (BigInt(balance[1]) << 128n);
      } else if (typeof balance === "object" && "low" in balance) {
        withdrawAmount = BigInt(balance.low) + (BigInt(balance.high) << 128n);
      } else {
        withdrawAmount = BigInt(balance);
      }
    } else {
      withdrawAmount = amount;
    }
    const transferCall = {
      contractAddress: tokenAddress,
      entrypoint: "transfer",
      calldata: CallData.compile({
        recipient: destinationAddress,
        amount: {
          low: withdrawAmount & (1n << 128n) - 1n,
          high: withdrawAmount >> 128n
        }
      })
    };
    return stealthAccount.execute([transferCall]);
  }
  /**
   * Check if an account is deployed at the given address
   * @param address - The address to check
   * @returns True if deployed
   */
  async isAccountDeployed(address) {
    try {
      const classHash = await this.provider.getClassHashAt(address);
      return classHash !== void 0 && classHash !== "0x0";
    } catch {
      return false;
    }
  }
  /**
   * Deploy a stealth account
   * @param privateKey - The stealth private key
   * @param publicKey - The stealth public key
   * @returns The deploy response
   */
  async deployStealthAccount(privateKey, publicKey) {
    const pubKey = publicKey ?? derivePublicKey(privateKey);
    const stealthAddress = computeStealthContractAddress(
      pubKey,
      this.accountClassHash
    );
    const stealthAccount = new Account(
      this.provider,
      stealthAddress,
      privateKey.toString()
    );
    const payload = {
      classHash: this.accountClassHash,
      constructorCalldata: CallData.compile({
        public_key: pubKey.toString()
      }),
      addressSalt: pubKey.toString()
    };
    return stealthAccount.deployAccount(payload);
  }
  /**
   * Build calls for sending to multiple recipients in a single multicall
   * @param payments - Array of batch payment descriptions
   * @returns The flattened calls and corresponding stealth results
   */
  buildBatchSendCalls(payments) {
    const allCalls = [];
    const stealthResults = [];
    for (const payment of payments) {
      const stealthResult = this.generateStealthAddress(payment.metaAddress);
      stealthResults.push(stealthResult);
      const calls = this.buildSendCalls(
        payment.tokenAddress,
        payment.amount,
        stealthResult,
        payment.metadata
      );
      allCalls.push(...calls);
    }
    return { calls: allCalls, stealthResults };
  }
  /**
   * Send to multiple recipients in a single Starknet multicall
   * @param account - The sender's account
   * @param payments - Array of batch payment descriptions
   * @returns The transaction response and stealth results
   */
  async batchSend(account, payments) {
    const { calls, stealthResults } = this.buildBatchSendCalls(payments);
    const transactionResponse = await account.execute(calls);
    return { transactionResponse, stealthResults };
  }
  /**
   * Get the Amora registry contract address
   */
  get registryAddress() {
    return this.amoraContract.address;
  }
  /**
   * Get the stealth account class hash
   */
  get stealthAccountClassHash() {
    return this.accountClassHash;
  }
};

// src/keys.ts
function generateKeyPair() {
  const privateKey = generatePrivateKey();
  const publicKey = derivePublicKey(privateKey);
  return { privateKey, publicKey };
}
function generateKeys() {
  return {
    spendingKey: generateKeyPair(),
    viewingKey: generateKeyPair()
  };
}
function keyPairFromPrivateKey(privateKey) {
  const publicKey = derivePublicKey(privateKey);
  return { privateKey, publicKey };
}
function keysFromPrivateKeys(spendingPrivateKey, viewingPrivateKey) {
  return {
    spendingKey: keyPairFromPrivateKey(spendingPrivateKey),
    viewingKey: keyPairFromPrivateKey(viewingPrivateKey)
  };
}

// src/memo.ts
var BYTES_PER_FELT = 31;
function encodeMemo(memo) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(memo);
  if (bytes.length === 0) {
    return [0n];
  }
  const felts = [BigInt(bytes.length)];
  for (let i = 0; i < bytes.length; i += BYTES_PER_FELT) {
    const chunk = bytes.slice(i, i + BYTES_PER_FELT);
    let value = 0n;
    for (const byte of chunk) {
      value = value << 8n | BigInt(byte);
    }
    felts.push(value);
  }
  return felts;
}
function decodeMemo(felts) {
  if (felts.length === 0) {
    throw new Error("Cannot decode memo: empty felts array");
  }
  const totalBytes = Number(felts[0]);
  if (totalBytes === 0) {
    return "";
  }
  const bytes = new Uint8Array(totalBytes);
  let bytesWritten = 0;
  for (let i = 1; i < felts.length && bytesWritten < totalBytes; i++) {
    const remaining = totalBytes - bytesWritten;
    const chunkSize = Math.min(BYTES_PER_FELT, remaining);
    const value = felts[i];
    for (let j = chunkSize - 1; j >= 0; j--) {
      bytes[bytesWritten + j] = Number(value >> BigInt((chunkSize - 1 - j) * 8) & 0xffn);
    }
    bytesWritten += chunkSize;
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// src/payment-link.ts
var PAYMENT_LINK_SCHEME = "amora";
var PAYMENT_LINK_HOST = "pay";
function generatePaymentLink(params) {
  if (!isValidMetaAddress(params.metaAddress)) {
    throw new Error("Invalid meta-address");
  }
  const queryParts = [`meta=${encodeURIComponent(params.metaAddress)}`];
  if (params.tokenAddress !== void 0) {
    queryParts.push(`token=${encodeURIComponent(params.tokenAddress)}`);
  }
  if (params.amount !== void 0) {
    queryParts.push(`amount=${params.amount.toString()}`);
  }
  if (params.memo !== void 0) {
    queryParts.push(`memo=${encodeURIComponent(params.memo)}`);
  }
  return `${PAYMENT_LINK_SCHEME}://${PAYMENT_LINK_HOST}?${queryParts.join("&")}`;
}
function parsePaymentLink(link) {
  const schemePrefix = `${PAYMENT_LINK_SCHEME}://${PAYMENT_LINK_HOST}?`;
  if (!link.startsWith(schemePrefix)) {
    throw new Error(`Invalid payment link: must start with "${schemePrefix}"`);
  }
  const queryString = link.slice(schemePrefix.length);
  const params = new URLSearchParams(queryString);
  const metaRaw = params.get("meta");
  if (!metaRaw) {
    throw new Error("Invalid payment link: missing meta-address");
  }
  const metaAddressRaw = decodeURIComponent(metaRaw);
  const metaAddress = parseMetaAddress(metaAddressRaw);
  const result = {
    metaAddress,
    metaAddressRaw
  };
  const token = params.get("token");
  if (token) {
    result.tokenAddress = decodeURIComponent(token);
  }
  const amount = params.get("amount");
  if (amount) {
    result.amount = BigInt(amount);
  }
  const memo = params.get("memo");
  if (memo) {
    result.memo = decodeURIComponent(memo);
  }
  return result;
}
function isValidPaymentLink(link) {
  try {
    parsePaymentLink(link);
    return true;
  } catch {
    return false;
  }
}

// src/viewing-key.ts
var VIEWING_KEY_PREFIX = "vk";
var VIEWING_KEY_CHAIN = "starknet";
function exportViewingKey(keys) {
  const viewingHex = "0x" + keys.viewingKey.privateKey.toString(16);
  const spendingHex = "0x" + keys.spendingKey.publicKey.toString(16);
  return `${VIEWING_KEY_PREFIX}:${VIEWING_KEY_CHAIN}:${viewingHex}:${spendingHex}`;
}
function importViewingKey(viewingKeyStr) {
  const parts = viewingKeyStr.split(":");
  if (parts.length !== 4) {
    throw new Error(
      `Invalid viewing key format: expected 4 parts, got ${parts.length}`
    );
  }
  const [prefix, chain, viewingStr, spendingStr] = parts;
  if (prefix !== VIEWING_KEY_PREFIX) {
    throw new Error(
      `Invalid viewing key prefix: expected "${VIEWING_KEY_PREFIX}", got "${prefix}"`
    );
  }
  if (chain !== VIEWING_KEY_CHAIN) {
    throw new Error(
      `Invalid viewing key chain: expected "${VIEWING_KEY_CHAIN}", got "${chain}"`
    );
  }
  const viewingPrivateKey = BigInt(viewingStr);
  const spendingPubKey = BigInt(spendingStr);
  if (viewingPrivateKey <= 0n) {
    throw new Error("Invalid viewing key: viewing private key must be positive");
  }
  if (spendingPubKey <= 0n) {
    throw new Error("Invalid viewing key: spending public key must be positive");
  }
  return {
    chain,
    viewingPrivateKey,
    spendingPubKey
  };
}
function isValidViewingKey(viewingKeyStr) {
  try {
    importViewingKey(viewingKeyStr);
    return true;
  } catch {
    return false;
  }
}
function scanWithViewingKey(announcements, viewingKey, accountClassHash) {
  const matches = [];
  for (const announcement of announcements) {
    const sharedSecret = ecdh(viewingKey.viewingPrivateKey, announcement.ephemeralPubKey);
    const expectedViewTag = computeViewTag(sharedSecret);
    if (expectedViewTag !== announcement.viewTag) {
      continue;
    }
    const stealthPubKey = computeStealthPublicKey(
      viewingKey.spendingPubKey,
      sharedSecret
    );
    const expectedAddress = computeStealthContractAddress(
      stealthPubKey,
      accountClassHash
    );
    const normalizedExpected = normalizeAddress2(expectedAddress);
    const normalizedActual = normalizeAddress2(announcement.stealthAddress);
    if (normalizedExpected !== normalizedActual) {
      continue;
    }
    matches.push({
      announcement,
      sharedSecret,
      stealthPubKey
    });
  }
  return matches;
}
function normalizeAddress2(address) {
  const hex = address.toLowerCase().replace(/^0x0*/, "");
  return "0x" + hex;
}

// src/index.ts
var MAINNET_ADDRESSES = {
  amoraRegistry: "0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d",
  stealthAccountClassHash: "0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a"
};
var SEPOLIA_ADDRESSES = {
  amoraRegistry: "0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2",
  stealthAccountClassHash: "0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a"
};
export {
  Amora,
  CHAIN_ID,
  CURVE_ORDER,
  MAINNET_ADDRESSES,
  META_ADDRESS_PREFIX,
  SCHEME_ID_STARK,
  SEPOLIA_ADDRESSES,
  checkAnnouncementViewTag,
  computeStealthContractAddress,
  computeStealthPrivateKey2 as computeStealthPrivateKey,
  computeViewTag,
  decodeMemo,
  derivePublicKey,
  ecdh,
  encodeMemo,
  encodeMetaAddress,
  encodeMetaAddressFromPubKeys,
  exportViewingKey,
  generateKeyPair,
  generateKeys,
  generatePaymentLink,
  generatePrivateKey,
  generateStealthAddress,
  generateStealthAddressWithKey,
  importViewingKey,
  isValidMetaAddress,
  isValidPaymentLink,
  isValidViewingKey,
  keyPairFromPrivateKey,
  keysFromPrivateKeys,
  parseMetaAddress,
  parsePaymentLink,
  poseidonHash,
  scanAnnouncements,
  scanWithViewingKey,
  verifyAndComputeStealthKey
};
