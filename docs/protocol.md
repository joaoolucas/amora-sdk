# Protocol

This document explains how Amora's stealth address protocol works.

## Overview

Stealth addresses allow senders to create unique, one-time addresses for recipients without any interaction. Only the intended recipient can detect and spend funds sent to these addresses.

## Key Concepts

### Meta-Address

A meta-address is a public identifier that recipients share. It contains two public keys:

- **Spending Public Key (K_spend)**: Used to derive stealth addresses
- **Viewing Public Key (K_view)**: Used to compute shared secrets

Format: `st:starknet:<spending_pubkey>:<viewing_pubkey>`

Example: `st:starknet:0x1234...abcd:0x5678...efgh`

### Stealth Address

A stealth address is a one-time address derived from the recipient's meta-address. Each payment creates a unique address that:

- Can only be identified by the recipient (using their viewing key)
- Can only be spent by the recipient (using their spending key)
- Is unlinkable to other stealth addresses of the same recipient

### Announcement

When sending to a stealth address, the sender publishes an announcement containing:

- **Ephemeral Public Key (R)**: Used by recipient to compute shared secret
- **View Tag**: First byte of shared secret hash for efficient filtering
- **Metadata**: Optional data (token address, amount, etc.)

## Protocol Flow

### 1. Registration (One-Time)

The recipient generates keys and registers on-chain:

```
1. Generate random spending keypair: (k_spend, K_spend)
2. Generate random viewing keypair: (k_view, K_view)
3. Register (K_spend, K_view) to Amora Registry
4. Share meta-address: "st:starknet:K_spend:K_view"
```

### 2. Sending

The sender creates a stealth address and sends funds:

```
1. Fetch recipient's meta-address: (K_spend, K_view)
2. Generate ephemeral keypair: (r, R) where R = r × G
3. Compute shared secret: s = r × K_view
4. Compute stealth public key: P = K_spend + hash(s) × G
5. Derive stealth address from P
6. Transfer tokens to stealth address
7. Publish announcement: (R, view_tag, metadata)
```

### 3. Scanning

The recipient scans announcements to find payments:

```
For each announcement with ephemeral key R:
1. Compute shared secret: s = k_view × R
2. Check view tag: if hash(s)[0] != view_tag, skip
3. Compute expected stealth key: P' = K_spend + hash(s) × G
4. Derive expected address from P'
5. If address matches announcement, payment found!
```

### 4. Withdrawal

The recipient claims funds:

```
1. Compute stealth private key: p = k_spend + hash(s)
2. Deploy stealth account (counterfactual)
3. Sign withdrawal transaction with p
4. Transfer funds to destination
```

## Cryptographic Details

### Curve

Amora uses the STARK curve, native to Starknet:

- Field: Prime field with p = 2^251 + 17 × 2^192 + 1
- Order: n = 0x800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2f
- Generator: Standard STARK curve generator point

### ECDH

Shared secret computation uses ECDH with x-coordinate output:

```
shared_secret = (private_key × public_key_point).x
```

### Hash Function

Poseidon hash is used throughout for ZK-friendliness:

```
view_tag = poseidon(shared_secret) & 0xFF
stealth_factor = poseidon(shared_secret)
stealth_pubkey = spending_pubkey + stealth_factor × G
```

### Address Derivation

Stealth addresses are derived using Starknet's contract address formula:

```
address = pedersen(
  "STARKNET_CONTRACT_ADDRESS",
  0,  // deployer (zero for CREATE)
  salt,  // stealth_pubkey
  class_hash,
  pedersen(constructor_calldata)
)
```

## View Tags

View tags enable efficient scanning by allowing quick rejection of non-matching announcements:

- **Without view tags**: Must compute full ECDH + address derivation for every announcement
- **With view tags**: Quick byte comparison filters 255/256 (99.6%) of announcements

```
view_tag = poseidon(shared_secret) mod 256
```

## Security Properties

### Unlinkability

- Stealth addresses are computationally unlinkable to the recipient's meta-address
- Multiple payments to the same recipient produce unrelated addresses
- An observer cannot determine if two stealth addresses belong to the same recipient

### Unforgeability

- Only the spending key holder can spend funds
- Viewing key provides detection without spending capability
- Stealth private key is derived from both keys and announcement data

### Privacy Levels

| Actor | Can Detect Payments | Can Spend |
|-------|-------------------|-----------|
| Public | No | No |
| Viewing Key Holder | Yes | No |
| Spending Key Holder | Yes | Yes |

## Comparison with ERC-5564

Amora adapts ERC-5564 for Starknet with these modifications:

| Feature | ERC-5564 (Ethereum) | Amora (Starknet) |
|---------|-------------------|------------------|
| Curve | secp256k1 | STARK curve |
| Hash | keccak256 | Poseidon |
| Accounts | EOAs | SNIP-6 smart contracts |
| Deployment | CREATE2 | Account abstraction |

## References

- [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [SNIP-6: Standard Account Interface](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-6.md)
- [Poseidon Hash](https://www.poseidon-hash.info/)
