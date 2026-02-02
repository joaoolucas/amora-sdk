# Amora Documentation

Welcome to the Amora SDK documentation. Amora provides stealth addresses for private payments on Starknet.

## What is Amora?

Amora implements ERC-5564/ERC-6538-style stealth addresses adapted for Starknet's STARK curve and native account abstraction. It enables:

- **Private payments**: Send tokens without revealing the recipient's address on-chain
- **One-time addresses**: Each payment goes to a unique stealth address
- **Efficient scanning**: View tags enable 256x faster detection of incoming payments
- **Account abstraction**: SNIP-6 compliant smart contract wallets

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./getting-started.md) | Installation and basic usage |
| [SDK Reference](./sdk-reference.md) | Complete API documentation |
| [Protocol](./protocol.md) | How stealth addresses work |
| [Contracts](./contracts.md) | Cairo smart contract reference |

## Quick Example

```typescript
import { Amora, generateKeys, encodeMetaAddress } from '@amora/sdk';
import { RpcProvider } from 'starknet';

// Initialize
const provider = new RpcProvider({ nodeUrl: 'YOUR_RPC_URL' });
const amora = new Amora({
  provider,
  amoraAddress: '0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d',
  accountClassHash: '0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a',
});

// Generate keys (recipient)
const keys = generateKeys();
const metaAddress = encodeMetaAddress(keys);
// Share: "st:starknet:0x123...abc:0x456...def"

// Send privately (sender)
const stealth = amora.generateStealthAddress(metaAddress);
await amora.send(account, ETH_ADDRESS, amount, stealth);

// Receive (recipient)
const payments = await amora.scan(keys, fromBlock);
```

## Deployed Contracts

### Mainnet

| Contract | Address |
|----------|---------|
| Amora Registry | `0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d` |
| StealthAccount Class | `0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a` |

### Sepolia Testnet

| Contract | Address |
|----------|---------|
| Amora Registry | `0x0388dfa21daf46e8d230f02df0bee78e42f93b33920db171d0f96d9d30f7a7b2` |
| StealthAccount Class | `0x0155bf2341cbc5a8e612ece29cc87476d7a0e102ea197a4583833a5b8a2fa76a` |

## Resources

- [GitHub Repository](https://github.com/joaoolucas/amora-sdk)
- [npm Package](https://www.npmjs.com/package/@amora/sdk)
- [Starkscan (Mainnet)](https://starkscan.co/contract/0x067e3fae136321be23894cc3a181c92171a7b991d853fa5e3432ec7dddeb955d)
