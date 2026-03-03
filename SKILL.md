---
name: openclaw-axr-acp
description: Stake & Auto Redeem, Swap & Auto Swap Back using Axelrod agent on Base chain.
metadata: {"openclaw":{"emoji":"💰"}}
---

# Axelrod ACP Operations

Stake USDC, swap tokens, and automatically redeem using Axelrod agent on Base chain. Supports stake → redeem cycle, token swap, and swap & back operations.

## Prerequisites

1. **Install virtuals-protocol-acp**
   ```bash
   git clone https://github.com/Virtual-Protocol/openclaw-acp.git /path/to/virtuals-protocol-acp
   cd /path/to/virtuals-protocol-acp
   npm install
   ```

2. **Configure ACP path** in `config.yaml` (use absolute path):
   ```yaml
   acpPath: /Users/yourname/code/virtuals-protocol-acp
   ```

3. **Get API key** from [app.virtuals.io](https://app.virtuals.io) and add to `config.yaml`

## Configuration

Edit `config.yaml`:

```yaml
# Path to virtuals-protocol-acp installation (absolute path)
acpPath: /Users/yourname/code/virtuals-protocol-acp

# API Key + Wallet Address pairs
accounts:
  - apiKey: "acp-your-api-key"
    walletAddress: "0xYourWalletAddress"
  - apiKey: "acp-another-key"
    walletAddress: "0xAnotherWalletAddress"
```

## Usage

### Stake & Auto-Redeem

```bash
npx tsx scripts/stake-redeem.ts --amount 0.01
```

This uses the defaults:
- Token: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Chain: base

### Standalone Redeem

```bash
# Redeem using first account in config
npx tsx scripts/redeem.ts --order-id 721827616973139968

# Redeem using specific wallet
npx tsx scripts/redeem.ts --wallet 0xYourWalletAddress --order-id 721827616973139968
```

### Token Swap

```bash
# Swap USDC to WETH
npx tsx scripts/swap.ts \
  --from-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --from-symbol USDC \
  --to-token 0x4200000000000000000000000000000000006 \
  --to-symbol WETH \
  --amount 1

# Swap WETH back to USDC
npx tsx scripts/swap.ts \
  --from-token 0x4200000000000000000000000000000000006 \
  --from-symbol WETH \
  --to-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --to-symbol USDC \
  --amount 0.01
```

### Swap & Back (Round-trip)

Execute two swaps automatically - swap tokens then swap back:

```bash
npx tsx scripts/swap-and-back.ts \
  --from-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --from-symbol USDC \
  --to-token 0x4200000000000000000000000000000000006 \
  --to-symbol WETH \
  --amount 0.5
```

This executes: `USDC → WETH → USDC` using the actual received amount.

## Options

### stake-redeem.ts

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--contract` | Token contract address | No | USDC on Base |
| `--symbol` | Token symbol | No | `USDC` |
| `--chain` | Chain name | No | `base` |
| `--amount` | Amount to stake | Yes | - |
| `--api-key` | Override API key | No | From config |

### redeem.ts

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--wallet` | Wallet address | No | First account |
| `--order-id` | Order ID from stake | Yes | - |

### swap.ts

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--from-token` | Source token contract address | Yes | - |
| `--from-symbol` | Source token symbol (e.g., USDC) | Yes | - |
| `--to-token` | Target token contract address | Yes | - |
| `--to-symbol` | Target token symbol (e.g., WETH) | Yes | - |
| `--amount` | Amount to swap | Yes | - |
| `--api-key` | Override API key | No | From config |

### swap-and-back.ts

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--from-token` | Source token contract address | Yes | - |
| `--from-symbol` | Source token symbol (e.g., USDC) | Yes | - |
| `--to-token` | Target token contract address | Yes | - |
| `--to-symbol` | Target token symbol (e.g., WETH) | Yes | - |
| `--amount` | Amount to swap | Yes | - |
| `--api-key` | Override API key | No | From config |

## How It Works

### Stake & Redeem Cycle
1. Reads accounts from config.yaml
2. For each account (serial execution):
   - Updates ACP config with API key
   - Creates stake job
   - Polls job status until completion
   - Extracts orderId from deliverable
   - Creates redeem job automatically
   - Waits for redeem completion

### Standalone Redeem
1. Finds account by wallet address (uses first if not specified)
2. Updates ACP config with API key
3. Creates redeem job with orderId
4. Waits for redeem completion

### Token Swap
1. Reads accounts from config.yaml
2. For each account (serial execution):
   - Updates ACP config with API key
   - Creates swap_token job
   - Polls job status until completion
   - Returns received amount

### Swap & Back
1. Reads accounts from config.yaml
2. For each account (serial execution):
   - Executes first swap (from → to)
   - Gets received amount from job deliverable
   - Executes second swap (to → from) with received amount
