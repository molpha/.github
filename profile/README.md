# Molpha

### Any API. One threshold signature. Every chain.

Oracle infrastructure for **smart contracts** and **AI agents**.
No feed approvals. No protocol token. One SDK.

[![npm](https://img.shields.io/npm/v/@molpha/sdk?label=%40molpha%2Fsdk&color=d42c2c)](https://www.npmjs.com/package/@molpha/sdk) [![crate](https://img.shields.io/crates/v/molpha-verifier?label=molpha-verifier&color=ffc933)](https://crates.io/crates/molpha-verifier) [![MCP](https://img.shields.io/badge/MCP-available-22c55e)](https://github.com/molpha/mcp) [![docs](https://img.shields.io/badge/docs-docs.molpha.io-080e05)](https://docs.molpha.io) [![Follow on X](https://img.shields.io/badge/follow-%40molpha__oracle-1DA1F2?logo=x&logoColor=white)](https://x.com/molpha_oracle)

---

## What is Molpha?

Molpha turns any HTTP API into cryptographically verifiable data.

Applications and AI agents request data when they need it. Independent verifier nodes fetch it, converge on a canonical value, and produce a single aggregate threshold signature (PoP-Schnorr over secp256k1). That one signed payload verifies on Solana, any EVM chain, and Starknet — three VM families, one signing ceremony.

There is nothing to create or register. Feed identity is derived deterministically from the request itself.

## Why Molpha?

- **Any API** — no predefined feeds, no provider onboarding.
- **Built for AI agents** — MCP-native, with pay-per-request USDC access via x402. No account, no subscription.
- **One SDK** — configure APIs, request data, verify signatures, and submit updates across supported chains.
- **Cross-chain by design** — one payload verifies on SVM, EVM, and Cairo/STARK. No re-signing per chain.
- **USDC-native** — subscriptions, pay-per-request, bonding and rewards without a protocol token.

## Start here

| I want to… | Go to |
| --- | --- |
| Give an AI agent verifiable data | [AI agent quickstart](https://docs.molpha.io/quickstarts/ai-agents) |
| Verify a payload in a smart contract | [Smart contract quickstart](https://docs.molpha.io/quickstarts/smart-contracts) |
| Fetch signed data from a backend | [Backend quickstart](https://docs.molpha.io/quickstarts/backend) |
| See deployed contracts and live status | [Deployments & testnet status](https://docs.molpha.io/verifiers/deployments) |

## Repositories

| Repository | Description |
| --- | --- |
| [`sdk`](https://github.com/molpha/sdk) | TypeScript consumer SDK — [`@molpha/sdk`](https://www.npmjs.com/package/@molpha/sdk) on npm |
| [`mcp`](https://github.com/molpha/mcp) | MCP server for AI agents |
| [`molpha-verifier`](https://github.com/molpha/molpha-verifier) | Rust verification library — [`molpha-verifier`](https://crates.io/crates/molpha-verifier) on crates.io |
| [`evm-verifier`](https://github.com/molpha/evm-verifier) | Solidity verifier contract |
| [`starknet-verifier`](https://github.com/molpha/starknet-verifier) | Cairo verifier contract |
| [`docs`](https://github.com/molpha/docs) | Documentation source for [docs.molpha.io](https://docs.molpha.io) |

More components open as milestones ship — releases are codenamed after Carpathian peaks, A → Z. See [Releases & Roadmap](https://docs.molpha.io/resources/releases).

## Current status

**Brebeneskul** is the current public testnet release.

- ✅ SDK published — full flow: subscribe → derive feed → execute round → submit → read
- ✅ MCP server available
- ✅ Cross-chain verification live on Solana Devnet, four EVM testnets, and Starknet Sepolia
- ✅ USDC subscriptions and delegate access, enforced on-chain
- ✅ Pay-per-request agent access — x402 payment loop with on-chain escrow settlement
- 🚧 Mainnet-grade slashing economics — dispute path live; proof-based operator slashing ships in a later milestone
- 🚧 Mainnet — gated on a full protocol audit; testnet node set is permissioned

All deployments are pre-audit testnet contracts. Full trust assumptions in the [Security Model](https://docs.molpha.io/protocol/security-model).

---

**Turn any API into verifiable data.** · [docs.molpha.io](https://docs.molpha.io) · [contact@molpha.io](mailto:contact@molpha.io)
