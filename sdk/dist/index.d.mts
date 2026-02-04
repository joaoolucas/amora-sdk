import { Provider, RpcProvider, Account, InvokeFunctionResponse, Call, DeployContractResponse } from 'starknet';

/**
 * Key generation and management for stealth addresses
 */
/**
 * A keypair consisting of a private key and its corresponding public key
 */
interface KeyPair {
    privateKey: bigint;
    publicKey: bigint;
}
/**
 * Full stealth address keys containing both spending and viewing keypairs
 */
interface StealthKeys {
    spendingKey: KeyPair;
    viewingKey: KeyPair;
}
/**
 * Generate a new random keypair
 * @returns A KeyPair with private and public keys
 */
declare function generateKeyPair(): KeyPair;
/**
 * Generate complete stealth address keys (spending + viewing)
 * @returns StealthKeys containing both keypairs
 */
declare function generateKeys(): StealthKeys;
/**
 * Derive a keypair from an existing private key
 * @param privateKey - The private key to derive from
 * @returns A KeyPair with the given private key and derived public key
 */
declare function keyPairFromPrivateKey(privateKey: bigint): KeyPair;
/**
 * Create StealthKeys from existing private keys
 * @param spendingPrivateKey - The spending private key
 * @param viewingPrivateKey - The viewing private key
 * @returns Complete StealthKeys
 */
declare function keysFromPrivateKeys(spendingPrivateKey: bigint, viewingPrivateKey: bigint): StealthKeys;

/**
 * Meta-address encoding and parsing
 * Format: "st:starknet:<spending_pubkey>:<viewing_pubkey>"
 *
 * The meta-address is a string that encodes the recipient's public keys
 * and can be shared publicly for anyone to send stealth payments.
 */

/**
 * Prefix for stealth addresses
 */
declare const META_ADDRESS_PREFIX = "st";
/**
 * Chain identifier for Starknet
 */
declare const CHAIN_ID = "starknet";
/**
 * A parsed meta-address containing the spending and viewing public keys
 */
interface MetaAddress {
    chain: string;
    spendingPubKey: bigint;
    viewingPubKey: bigint;
}
/**
 * Encode a meta-address from StealthKeys
 * @param keys - The stealth keys containing spending and viewing keypairs
 * @returns The encoded meta-address string
 */
declare function encodeMetaAddress(keys: StealthKeys): string;
/**
 * Encode a meta-address from public keys
 * @param spendingPubKey - The spending public key
 * @param viewingPubKey - The viewing public key
 * @returns The encoded meta-address string
 */
declare function encodeMetaAddressFromPubKeys(spendingPubKey: bigint, viewingPubKey: bigint): string;
/**
 * Parse a meta-address string
 * @param metaAddress - The encoded meta-address string
 * @returns The parsed MetaAddress
 * @throws If the meta-address format is invalid
 */
declare function parseMetaAddress(metaAddress: string): MetaAddress;
/**
 * Validate a meta-address string
 * @param metaAddress - The meta-address to validate
 * @returns true if valid, false otherwise
 */
declare function isValidMetaAddress(metaAddress: string): boolean;

/**
 * Stealth address generation and scanning
 *
 * This module implements the core stealth address protocol:
 * 1. Sender generates ephemeral keypair and computes stealth address
 * 2. Recipient scans announcements to find payments
 * 3. Recipient computes stealth private key to spend funds
 */

/**
 * Result of generating a stealth address for a recipient
 */
interface GenerateStealthAddressResult {
    /** The stealth address (contract address) */
    stealthAddress: string;
    /** The stealth public key (for verification) */
    stealthPubKey: bigint;
    /** The ephemeral public key to be published in announcement */
    ephemeralPubKey: bigint;
    /** The view tag for efficient scanning */
    viewTag: number;
}
/**
 * An announcement event parsed from the blockchain
 */
interface Announcement {
    /** The stealth address that received the payment */
    stealthAddress: string;
    /** The ephemeral public key from the sender */
    ephemeralPubKey: bigint;
    /** The view tag for quick filtering */
    viewTag: number;
    /** Optional metadata (e.g., token address, amount) */
    metadata: bigint[];
    /** Block number of the event */
    blockNumber?: number;
    /** Transaction hash of the announcement */
    transactionHash?: string;
}
/**
 * A detected stealth payment (announcement that matches the recipient)
 */
interface StealthPayment {
    /** The original announcement */
    announcement: Announcement;
    /** The shared secret used to derive the stealth address */
    sharedSecret: bigint;
    /** The stealth private key to spend the funds */
    stealthPrivateKey: bigint;
    /** The stealth public key (for verification) */
    stealthPubKey: bigint;
}
/**
 * Generate a stealth address for a recipient
 * @param metaAddress - The recipient's meta-address (parsed)
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns The stealth address data to be used for payment and announcement
 */
declare function generateStealthAddress(metaAddress: MetaAddress, accountClassHash: string): GenerateStealthAddressResult;
/**
 * Generate a stealth address using a specific ephemeral key (for testing)
 * @param metaAddress - The recipient's meta-address
 * @param ephemeralPrivateKey - The ephemeral private key to use
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns The stealth address data
 */
declare function generateStealthAddressWithKey(metaAddress: MetaAddress, ephemeralPrivateKey: bigint, accountClassHash: string): GenerateStealthAddressResult;
/**
 * Compute the contract address for a stealth account
 * Uses Starknet's standard contract address computation
 * @param publicKey - The stealth public key (constructor arg)
 * @param classHash - The class hash of the stealth account contract
 * @param salt - Optional salt (defaults to the public key)
 * @returns The contract address as a hex string
 */
declare function computeStealthContractAddress(publicKey: bigint, classHash: string, salt?: bigint): string;
/**
 * Check if an announcement matches the recipient's viewing key
 * Uses the view tag for quick filtering
 * @param announcement - The announcement to check
 * @param viewingPrivateKey - The recipient's viewing private key
 * @returns The shared secret if it matches, null otherwise
 */
declare function checkAnnouncementViewTag(announcement: Announcement, viewingPrivateKey: bigint): bigint | null;
/**
 * Verify an announcement matches a recipient and compute the stealth private key
 * @param announcement - The announcement to verify
 * @param viewingPrivateKey - The recipient's viewing private key
 * @param spendingPublicKey - The recipient's spending public key
 * @param spendingPrivateKey - The recipient's spending private key
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns StealthPayment if the announcement matches, null otherwise
 */
declare function verifyAndComputeStealthKey(announcement: Announcement, viewingPrivateKey: bigint, spendingPublicKey: bigint, spendingPrivateKey: bigint, accountClassHash: string): StealthPayment | null;
/**
 * Scan multiple announcements to find payments for a recipient
 * @param announcements - Array of announcements to scan
 * @param viewingPrivateKey - The recipient's viewing private key
 * @param spendingPublicKey - The recipient's spending public key
 * @param spendingPrivateKey - The recipient's spending private key
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns Array of matched stealth payments
 */
declare function scanAnnouncements(announcements: Announcement[], viewingPrivateKey: bigint, spendingPublicKey: bigint, spendingPrivateKey: bigint, accountClassHash: string): StealthPayment[];
/**
 * Compute the stealth private key from spending private key and shared secret
 * This is the key needed to sign transactions from the stealth address
 * @param spendingPrivateKey - The recipient's spending private key
 * @param sharedSecret - The shared secret from the payment
 * @returns The stealth private key
 */
declare function computeStealthPrivateKey(spendingPrivateKey: bigint, sharedSecret: bigint): bigint;

/**
 * Contract wrappers for interacting with Amora contracts on Starknet
 */

/**
 * Configuration options for the Amora SDK
 */
interface AmoraConfig {
    /** Starknet provider instance */
    provider: Provider | RpcProvider;
    /** Address of the deployed Amora registry contract */
    amoraAddress: string;
    /** Class hash of the stealth account contract */
    accountClassHash: string;
}
/**
 * A single payment in a batch send operation
 */
interface BatchPayment {
    /** Recipient's meta-address (string or parsed) */
    metaAddress: string | MetaAddress;
    /** Token contract address to send */
    tokenAddress: string;
    /** Amount to send */
    amount: bigint;
    /** Optional additional metadata */
    metadata?: bigint[];
}
/**
 * Result of a batch send operation
 */
interface BatchSendResult {
    /** The transaction response from the multicall */
    transactionResponse: InvokeFunctionResponse;
    /** The stealth address results for each payment */
    stealthResults: GenerateStealthAddressResult[];
}
/**
 * Main Amora SDK class for interacting with stealth addresses
 */
declare class Amora {
    private readonly provider;
    private readonly amoraContract;
    private readonly accountClassHash;
    constructor(config: AmoraConfig);
    /**
     * Register a meta-address (spending + viewing public keys)
     * @param account - The account to register from
     * @param keys - The stealth keys to register
     * @returns The transaction response
     */
    register(account: Account, keys: StealthKeys): Promise<InvokeFunctionResponse>;
    /**
     * Get a registered meta-address for an account
     * @param registrantAddress - The address to look up
     * @returns The parsed MetaAddress or null if not registered
     */
    getMetaAddress(registrantAddress: string): Promise<MetaAddress | null>;
    /**
     * Check if an address is registered
     * @param registrantAddress - The address to check
     * @returns True if registered
     */
    isRegistered(registrantAddress: string): Promise<boolean>;
    /**
     * Generate a stealth address for sending to a recipient
     * @param recipientMetaAddress - The recipient's meta-address (string or parsed)
     * @returns The stealth address generation result
     */
    generateStealthAddress(recipientMetaAddress: string | MetaAddress): GenerateStealthAddressResult;
    /**
     * Build calls for sending tokens to a stealth address
     * @param tokenAddress - The token contract address (ETH or ERC20)
     * @param amount - The amount to send (as bigint)
     * @param stealthResult - The result from generateStealthAddress
     * @param metadata - Optional metadata to include in announcement
     * @returns Array of calls to execute
     */
    buildSendCalls(tokenAddress: string, amount: bigint, stealthResult: GenerateStealthAddressResult, metadata?: bigint[]): Call[];
    /**
     * Send tokens to a stealth address (transfer + announce)
     * @param account - The sender's account
     * @param tokenAddress - The token contract address
     * @param amount - The amount to send
     * @param stealthResult - The result from generateStealthAddress
     * @param metadata - Optional additional metadata
     * @returns The transaction response
     */
    send(account: Account, tokenAddress: string, amount: bigint, stealthResult: GenerateStealthAddressResult, metadata?: bigint[]): Promise<InvokeFunctionResponse>;
    /**
     * Fetch announcements from the blockchain
     * @param fromBlock - Starting block number
     * @param toBlock - Ending block number (or "latest")
     * @returns Array of parsed announcements
     */
    fetchAnnouncements(fromBlock: number, toBlock?: number | "latest"): Promise<Announcement[]>;
    /**
     * Scan for payments addressed to a recipient
     * @param keys - The recipient's stealth keys
     * @param fromBlock - Starting block number
     * @param toBlock - Ending block number (or "latest")
     * @returns Array of matched stealth payments
     */
    scan(keys: StealthKeys, fromBlock: number, toBlock?: number | "latest"): Promise<StealthPayment[]>;
    /**
     * Deploy a stealth account and withdraw funds
     * @param stealthPrivateKey - The stealth private key
     * @param destinationAddress - Where to send the funds
     * @param tokenAddress - The token to withdraw
     * @param amount - The amount to withdraw (or "all" to withdraw everything)
     * @returns The transaction response
     */
    deployAndWithdraw(stealthPrivateKey: bigint, destinationAddress: string, tokenAddress: string, amount: bigint | "all"): Promise<InvokeFunctionResponse>;
    /**
     * Check if an account is deployed at the given address
     * @param address - The address to check
     * @returns True if deployed
     */
    private isAccountDeployed;
    /**
     * Deploy a stealth account
     * @param privateKey - The stealth private key
     * @param publicKey - The stealth public key
     * @returns The deploy response
     */
    deployStealthAccount(privateKey: bigint, publicKey?: bigint): Promise<DeployContractResponse>;
    /**
     * Build calls for sending to multiple recipients in a single multicall
     * @param payments - Array of batch payment descriptions
     * @returns The flattened calls and corresponding stealth results
     */
    buildBatchSendCalls(payments: BatchPayment[]): {
        calls: Call[];
        stealthResults: GenerateStealthAddressResult[];
    };
    /**
     * Send to multiple recipients in a single Starknet multicall
     * @param account - The sender's account
     * @param payments - Array of batch payment descriptions
     * @returns The transaction response and stealth results
     */
    batchSend(account: Account, payments: BatchPayment[]): Promise<BatchSendResult>;
    /**
     * Get the Amora registry contract address
     */
    get registryAddress(): string;
    /**
     * Get the stealth account class hash
     */
    get stealthAccountClassHash(): string;
}

/**
 * Cryptographic primitives for stealth addresses on STARK curve
 * Uses @scure/starknet for STARK curve operations and Poseidon hash
 */
declare const CURVE_ORDER: bigint;
/**
 * Scheme ID for STARK curve stealth addresses
 * "STARK" in ASCII bytes as a felt252
 */
declare const SCHEME_ID_STARK = 357895852619;
/**
 * Generate a random private key on the STARK curve.
 * The key is normalized so that its public key has an even y-coordinate.
 */
declare function generatePrivateKey(): bigint;
/**
 * Derive the public key from a private key
 * Returns the x-coordinate of the point (Starknet's standard public key format)
 * @param privateKey - The private key as bigint
 * @returns The public key (x-coordinate) as bigint
 */
declare function derivePublicKey(privateKey: bigint): bigint;
/**
 * Compute Poseidon hash of multiple field elements
 * @param inputs - Array of field elements as bigints
 * @returns The hash as bigint
 */
declare function poseidonHash(...inputs: bigint[]): bigint;
/**
 * Compute the view tag from a shared secret
 * The view tag is the first byte of hash(shared_secret)
 * @param sharedSecret - The shared secret (x-coordinate)
 * @returns The view tag as a number (0-255)
 */
declare function computeViewTag(sharedSecret: bigint): number;
/**
 * Perform ECDH to compute shared secret
 * shared_secret = private_key * public_key_point
 * @param privateKey - One party's private key
 * @param publicKey - Other party's public key (x-coordinate)
 * @returns The shared secret (x-coordinate of resulting point)
 */
declare function ecdh(privateKey: bigint, publicKey: bigint): bigint;

/**
 * Memo encoding/decoding for stealth payment metadata
 *
 * Encodes UTF-8 text into felt252 array for the existing metadata field.
 * Each felt252 holds 31 bytes. The first felt is the byte length prefix.
 */
/**
 * Encode a UTF-8 string into an array of felt252 values
 *
 * Encoding scheme:
 * 1. Convert string to UTF-8 bytes
 * 2. First felt252 = total byte length
 * 3. Subsequent felts = 31-byte chunks packed big-endian into bigints
 *
 * @param memo - The text to encode
 * @returns Array of bigints representing the memo as felt252 values
 */
declare function encodeMemo(memo: string): bigint[];
/**
 * Decode an array of felt252 values back into a UTF-8 string
 *
 * @param felts - Array of bigints where felts[0] is byte length and
 *                subsequent felts are 31-byte big-endian chunks
 * @returns The decoded string
 * @throws If the felts array is empty
 */
declare function decodeMemo(felts: bigint[]): string;

/**
 * Payment link generation and parsing
 *
 * Generates shareable URIs encoding recipient meta-address + optional payment params.
 * URI format: amora://pay?meta=st:starknet:0x...:0x...&token=0x...&amount=1000000&memo=hello
 */

/**
 * Parameters for generating a payment link
 */
interface PaymentLinkParams {
    /** The recipient's meta-address string */
    metaAddress: string;
    /** Optional token contract address */
    tokenAddress?: string;
    /** Optional payment amount */
    amount?: bigint;
    /** Optional memo text */
    memo?: string;
}
/**
 * A parsed payment link
 */
interface ParsedPaymentLink {
    /** The parsed meta-address */
    metaAddress: MetaAddress;
    /** The raw meta-address string */
    metaAddressRaw: string;
    /** Optional token contract address */
    tokenAddress?: string;
    /** Optional payment amount */
    amount?: bigint;
    /** Optional memo text */
    memo?: string;
}
/**
 * Generate a shareable payment link URI
 *
 * @param params - Payment link parameters
 * @returns The encoded payment link URI
 * @throws If the meta-address is invalid
 */
declare function generatePaymentLink(params: PaymentLinkParams): string;
/**
 * Parse a payment link URI
 *
 * @param link - The payment link URI to parse
 * @returns The parsed payment link data
 * @throws If the link format is invalid or contains an invalid meta-address
 */
declare function parsePaymentLink(link: string): ParsedPaymentLink;
/**
 * Check if a string is a valid payment link
 *
 * @param link - The string to validate
 * @returns true if the string is a valid payment link
 */
declare function isValidPaymentLink(link: string): boolean;

/**
 * Viewing key export/import for watch-only scanning
 *
 * Exports the viewing private key + spending public key so a watch-only
 * client can detect incoming payments without being able to spend them.
 *
 * Format: vk:starknet:0x<viewing_private_key>:0x<spending_public_key>
 */

/**
 * An exported viewing key containing the minimal info for watch-only scanning
 */
interface ExportedViewingKey {
    /** Chain identifier */
    chain: string;
    /** The viewing private key (enables scanning) */
    viewingPrivateKey: bigint;
    /** The spending public key (enables address verification, but not spending) */
    spendingPubKey: bigint;
}
/**
 * A match found during viewing key scanning
 */
interface ViewingKeyMatch {
    /** The matched announcement */
    announcement: Announcement;
    /** The shared secret derived from the ephemeral key */
    sharedSecret: bigint;
    /** The stealth public key for this payment */
    stealthPubKey: bigint;
}
/**
 * Export a viewing key from stealth keys
 *
 * @param keys - The full stealth keys
 * @returns The viewing key string in format "vk:starknet:0x<viewing_priv>:0x<spending_pub>"
 */
declare function exportViewingKey(keys: StealthKeys): string;
/**
 * Import a viewing key from its string representation
 *
 * @param viewingKeyStr - The viewing key string
 * @returns The parsed viewing key
 * @throws If the format is invalid
 */
declare function importViewingKey(viewingKeyStr: string): ExportedViewingKey;
/**
 * Check if a string is a valid viewing key
 *
 * @param viewingKeyStr - The string to validate
 * @returns true if valid
 */
declare function isValidViewingKey(viewingKeyStr: string): boolean;
/**
 * Scan announcements using a viewing key (watch-only, cannot derive spending keys)
 *
 * Uses the same ECDH + view tag + stealth address verification as full scanning,
 * but omits stealth private key derivation since the spending private key is not available.
 *
 * @param announcements - Array of announcements to scan
 * @param viewingKey - The exported viewing key
 * @param accountClassHash - The class hash of the stealth account contract
 * @returns Array of matched announcements with shared secrets
 */
declare function scanWithViewingKey(announcements: Announcement[], viewingKey: ExportedViewingKey, accountClassHash: string): ViewingKeyMatch[];

/**
 * Amora SDK - Stealth Addresses for Starknet
 *
 * This SDK implements ERC-5564/ERC-6538-style stealth addresses
 * adapted for Starknet's STARK curve and native account abstraction.
 *
 * @example
 * ```typescript
 * import { Amora, generateKeys, encodeMetaAddress, parseMetaAddress } from 'amora-sdk';
 *
 * // Initialize SDK
 * const amora = new Amora({ provider, amoraAddress, accountClassHash });
 *
 * // Generate keys for a recipient
 * const keys = generateKeys();
 * const metaAddress = encodeMetaAddress(keys);
 * // Share metaAddress: "st:starknet:0x123...abc:0x456...def"
 *
 * // Register keys on-chain
 * await amora.register(account, keys);
 *
 * // Send to a stealth address
 * const meta = await amora.getMetaAddress(recipientAddress);
 * const stealth = amora.generateStealthAddress(meta);
 * await amora.send(account, ETH_ADDRESS, amount, stealth);
 *
 * // Scan for incoming payments
 * const payments = await amora.scan(keys, fromBlock);
 * ```
 *
 * @packageDocumentation
 */

declare const MAINNET_ADDRESSES: {
    readonly amoraRegistry: "0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d";
    readonly stealthAccountClassHash: "0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a";
};
declare const SEPOLIA_ADDRESSES: {
    readonly amoraRegistry: "0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2";
    readonly stealthAccountClassHash: "0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a";
};

export { Amora, type AmoraConfig, type Announcement, type BatchPayment, type BatchSendResult, CHAIN_ID, CURVE_ORDER, type ExportedViewingKey, type GenerateStealthAddressResult, type KeyPair, MAINNET_ADDRESSES, META_ADDRESS_PREFIX, type MetaAddress, type ParsedPaymentLink, type PaymentLinkParams, SCHEME_ID_STARK, SEPOLIA_ADDRESSES, type StealthKeys, type StealthPayment, type ViewingKeyMatch, checkAnnouncementViewTag, computeStealthContractAddress, computeStealthPrivateKey, computeViewTag, decodeMemo, derivePublicKey, ecdh, encodeMemo, encodeMetaAddress, encodeMetaAddressFromPubKeys, exportViewingKey, generateKeyPair, generateKeys, generatePaymentLink, generatePrivateKey, generateStealthAddress, generateStealthAddressWithKey, importViewingKey, isValidMetaAddress, isValidPaymentLink, isValidViewingKey, keyPairFromPrivateKey, keysFromPrivateKeys, parseMetaAddress, parsePaymentLink, poseidonHash, scanAnnouncements, scanWithViewingKey, verifyAndComputeStealthKey };
