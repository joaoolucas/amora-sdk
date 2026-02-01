/**
 * Contract wrappers for interacting with Amora contracts on Starknet
 */

import {
  Contract,
  Account,
  Provider,
  RpcProvider,
  CallData,
  type Call,
  type InvokeFunctionResponse,
} from "starknet";
import type { MetaAddress } from "./meta-address";
import type { StealthKeys } from "./keys";
import type { Announcement, GenerateStealthAddressResult } from "./stealth";
import {
  generateStealthAddress,
  scanAnnouncements,
  type StealthPayment,
} from "./stealth";
import { parseMetaAddress, encodeMetaAddressFromPubKeys } from "./meta-address";

/**
 * ABI for the Amora registry contract
 */
const AMORA_ABI = [
  {
    name: "register_keys",
    type: "function",
    inputs: [
      { name: "spending_pubkey", type: "felt252" },
      { name: "viewing_pubkey", type: "felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "get_meta_address",
    type: "function",
    inputs: [{ name: "registrant", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "(felt252, felt252)" }],
    state_mutability: "view",
  },
  {
    name: "is_registered",
    type: "function",
    inputs: [{ name: "registrant", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "bool" }],
    state_mutability: "view",
  },
  {
    name: "announce",
    type: "function",
    inputs: [
      { name: "stealth_address", type: "core::starknet::contract_address::ContractAddress" },
      { name: "ephemeral_pubkey", type: "felt252" },
      { name: "view_tag", type: "u8" },
      { name: "metadata", type: "core::array::Array::<felt252>" },
    ],
    outputs: [],
    state_mutability: "external",
  },
] as const;

/**
 * Configuration options for the Amora SDK
 */
export interface AmoraConfig {
  /** Starknet provider instance */
  provider: Provider | RpcProvider;
  /** Address of the deployed Amora registry contract */
  amoraAddress: string;
  /** Class hash of the stealth account contract */
  accountClassHash: string;
}

/**
 * Main Amora SDK class for interacting with stealth addresses
 */
export class Amora {
  private readonly provider: Provider | RpcProvider;
  private readonly amoraContract: Contract;
  private readonly accountClassHash: string;

  constructor(config: AmoraConfig) {
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
  async register(
    account: Account,
    keys: StealthKeys
  ): Promise<InvokeFunctionResponse> {
    const contract = new Contract(
      AMORA_ABI,
      this.amoraContract.address,
      account
    );

    return contract.invoke("register_keys", [
      keys.spendingKey.publicKey.toString(),
      keys.viewingKey.publicKey.toString(),
    ]);
  }

  /**
   * Get a registered meta-address for an account
   * @param registrantAddress - The address to look up
   * @returns The parsed MetaAddress or null if not registered
   */
  async getMetaAddress(registrantAddress: string): Promise<MetaAddress | null> {
    const result = await this.amoraContract.call("get_meta_address", [
      registrantAddress,
    ]);

    const [spendingPubKey, viewingPubKey] = result as [bigint, bigint];

    // Check if registered (both keys are non-zero)
    if (spendingPubKey === 0n || viewingPubKey === 0n) {
      return null;
    }

    return {
      chain: "starknet",
      spendingPubKey,
      viewingPubKey,
    };
  }

  /**
   * Check if an address is registered
   * @param registrantAddress - The address to check
   * @returns True if registered
   */
  async isRegistered(registrantAddress: string): Promise<boolean> {
    const result = await this.amoraContract.call("is_registered", [
      registrantAddress,
    ]);
    return result as boolean;
  }

  /**
   * Generate a stealth address for sending to a recipient
   * @param recipientMetaAddress - The recipient's meta-address (string or parsed)
   * @returns The stealth address generation result
   */
  generateStealthAddress(
    recipientMetaAddress: string | MetaAddress
  ): GenerateStealthAddressResult {
    const meta =
      typeof recipientMetaAddress === "string"
        ? parseMetaAddress(recipientMetaAddress)
        : recipientMetaAddress;

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
  buildSendCalls(
    tokenAddress: string,
    amount: bigint,
    stealthResult: GenerateStealthAddressResult,
    metadata: bigint[] = []
  ): Call[] {
    // Transfer call
    const transferCall: Call = {
      contractAddress: tokenAddress,
      entrypoint: "transfer",
      calldata: CallData.compile({
        recipient: stealthResult.stealthAddress,
        amount: { low: amount & ((1n << 128n) - 1n), high: amount >> 128n },
      }),
    };

    // Announcement call with token info in metadata
    const fullMetadata = [BigInt(tokenAddress), amount, ...metadata];
    const announceCall: Call = {
      contractAddress: this.amoraContract.address,
      entrypoint: "announce",
      calldata: CallData.compile({
        stealth_address: stealthResult.stealthAddress,
        ephemeral_pubkey: stealthResult.ephemeralPubKey.toString(),
        view_tag: stealthResult.viewTag,
        metadata: fullMetadata.map((m) => m.toString()),
      }),
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
  async send(
    account: Account,
    tokenAddress: string,
    amount: bigint,
    stealthResult: GenerateStealthAddressResult,
    metadata: bigint[] = []
  ): Promise<InvokeFunctionResponse> {
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
  async fetchAnnouncements(
    fromBlock: number,
    toBlock: number | "latest" = "latest"
  ): Promise<Announcement[]> {
    const provider = this.provider as RpcProvider;

    const eventsResponse = await provider.getEvents({
      from_block: { block_number: fromBlock },
      to_block: toBlock === "latest" ? "latest" : { block_number: toBlock },
      address: this.amoraContract.address,
      keys: [],
      chunk_size: 1000,
    });

    const announcements: Announcement[] = [];

    for (const event of eventsResponse.events) {
      try {
        // Parse the event data
        // Event data format: [stealth_address, caller, ephemeral_pubkey, view_tag, metadata_len, ...metadata]
        const data = event.data;
        if (data.length < 4) continue;

        const stealthAddress = data[0];
        // data[1] is caller (not needed for scanning)
        const ephemeralPubKey = BigInt(data[2]);
        const viewTag = Number(BigInt(data[3]));

        // Parse metadata (remaining data after the fixed fields)
        const metadataLen = Number(BigInt(data[4] || "0"));
        const metadata: bigint[] = [];
        for (let i = 0; i < metadataLen && i + 5 < data.length; i++) {
          metadata.push(BigInt(data[i + 5]));
        }

        announcements.push({
          stealthAddress,
          ephemeralPubKey,
          viewTag,
          metadata,
          blockNumber: event.block_number,
          transactionHash: event.transaction_hash,
        });
      } catch (e) {
        // Skip malformed events
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
  async scan(
    keys: StealthKeys,
    fromBlock: number,
    toBlock: number | "latest" = "latest"
  ): Promise<StealthPayment[]> {
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
  async deployAndWithdraw(
    stealthPrivateKey: bigint,
    destinationAddress: string,
    tokenAddress: string,
    amount: bigint | "all"
  ): Promise<InvokeFunctionResponse> {
    // Create an account instance with the stealth private key
    const stealthAccount = new Account(
      this.provider,
      "0x0", // Address will be computed
      stealthPrivateKey.toString()
    );

    // TODO: Implement full deploy and withdraw logic
    // This requires:
    // 1. Computing the stealth address from the private key
    // 2. Checking if the account is deployed
    // 3. If not deployed, deploying it (using DEPLOY_ACCOUNT transaction)
    // 4. Executing the withdrawal transfer

    throw new Error("deployAndWithdraw not yet implemented");
  }

  /**
   * Get the Amora registry contract address
   */
  get registryAddress(): string {
    return this.amoraContract.address;
  }

  /**
   * Get the stealth account class hash
   */
  get stealthAccountClassHash(): string {
    return this.accountClassHash;
  }
}
