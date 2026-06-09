<div align="center">

# Molpha

### Any API. One threshold signature. Every chain.

**Pull-native threshold oracle protocol** — turn any HTTP/API into threshold-signed, chain-agnostic verified on-chain data. No feed listings. No approvals. No governance token.

[![npm](https://img.shields.io/npm/v/@molpha-oracle/sdk?label=%40molpha-oracle%2Fsdk&color=000000)](https://www.npmjs.com/package/@molpha-oracle/sdk)
[![Testnet](https://img.shields.io/badge/network-Albyn%20testnet-22c55e)](#status)
[![Follow on X](https://img.shields.io/badge/follow-%40molpha__oracle-1DA1F2?logo=x&logoColor=white)](https://x.com/molpha_oracle)

</div>

---

## What it is

Most oracle networks are built around a small number of high-volume price feeds. That leaves a large gap for **application-specific data** — RWA reference values, proof-of-reserve checks, prediction-market outcomes, DePIN telemetry, payment and invoice status, game events, and the rest of the long tail.

Molpha is built for that gap. Instead of continuously pushing data on-chain, applications request verified data **only when they need it**. Selected verifier nodes independently fetch and compute the value, then return it as a single chain-agnostic aggregate signature — verifiable on any supported chain in one stateless call.

## Why it's different

- **Any API, not just prices** — define a job over arbitrary HTTP/API data, parse and normalize the response with a deterministic value policy, and verify the result on-chain.
- **One signature, every chain** — a single signing round produces a payload verifiable across **three heterogeneous VM families** at once: SVM, EVM, and Cairo/STARK.
- **Stateless verification** — consumer contracts verify a signed payload directly inside their transaction. No advance state write, no feed to maintain, no per-read billing.
- **USDC-native, no token** — subscriptions and node rewards are in USDC. No governance token, no native-token gas exposure to reason about.
- **SDK-first** — browser-first ESM, tree-shakeable, framework-agnostic. No `ethers` / `viem` / `starknet.js` runtime dependency.

## How it works

```
        ┌──────────────────────────────────────────────┐
        │  Solana — canonical protocol state            │
        │  node registry · jobs · subscriptions ·       │
        │  staking · rewards · round receipts           │
        └───────────────────────┬──────────────────────┘
                                │  node set mirrored by registryVersion
        ┌───────────────────────▼──────────────────────┐
        │  Off-chain node network                       │
        │  selected nodes: fetch → compute → sign       │
        │  Molpha PoP-Schnorr threshold aggregation     │
        └───────────────────────┬──────────────────────┘
                                │  DataUpdate + AggregatedSig
        ┌───────────────────────▼──────────────────────┐
        │  EVM · Starknet — verification only           │
        │  stateless, purely cryptographic              │
        │  no jobs · no rounds · no feeds · no rewards  │
        └───────────────────────────────────────────────┘
```

Solana is the authoritative chain for all protocol state. EVM and Starknet deployments are lightweight, stateless verifiers — they hold mirrored node key sets and expose a single verify path. Signing uses **Molpha PoP-Schnorr plain-sum aggregation**, with Proof of Possession at registration as the rogue-key mitigation.

## SDK

```bash
npm install @molpha-oracle/sdk
```

The full flow works end-to-end today: `subscribe → createJob → gateway execute → submit/verify → read feed`, with verification across SVM, EVM, and Cairo/STARK.

## Status

**Albyn testnet is live.** The MVP is publicly available, with the SDK published and the signing/verification flow working across all three VM families.

| Component | State |
|---|---|
| SDK (`@molpha-oracle/sdk`) | ✅ Published |
| Signing / verification flow | ✅ End-to-end on testnet |
| EVM verifiers | ✅ Sepolia · Arbitrum Sepolia · Avalanche Fuji · BSC testnet |
| Starknet verifier | ✅ Starknet Sepolia |
| Economics · subscription enforcement · slashing | 🛠 In design / next work block |
| Mainnet | ⛰ Gated on audit, deposit mechanics, and node onboarding |

> Release naming follows the Carpathian peaks, A→Z. **Albyn** is the first release; the summit is reserved for mainnet.

## Built with

Rust / Anchor on Solana · Solidity / Foundry on EVM · Cairo on Starknet · LibP2P (QUIC) for the node network · USDC for all protocol economics.

## Links

- 📦 npm — [`@molpha-oracle/sdk`](https://www.npmjs.com/package/@molpha-oracle/sdk)
- 🐦 X — [@molpha_oracle](https://x.com/molpha_oracle)

<div align="center">
<sub><em>Any API. One threshold signature. Every chain.</em></sub>
</div>
