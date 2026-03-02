---
name: openclaw-axr-acp
description: Stake USDC tokens and automatically redeem. Supports Axelrod agent and other AI trading agents on Base chain.
metadata: {"openclaw":{"emoji":"💰","homepage":"https://virtuals.io","primaryEnv":"LITE_AGENT_API_KEY"}}
---

# Axelrod Stake & Redeem

Stake tokens and automatically redeem when complete. This skill handles both stake → redeem cycle and standalone redeem operations.

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

### Stake & Auto-Redeem (USDC on Base)

```bash
scripts/stake-redeem.ts --amount 0.01
```

This uses the defaults:
- Token: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Chain: base

### Standalone Redeem

```bash
# Redeem using first account in config
scripts/redeem.ts --order-id 721827616973139968

# Redeem using specific wallet
scripts/redeem.ts --wallet 0xYourWalletAddress --order-id 721827616973139968
```

### Custom Token

```bash
scripts/stake-redeem.ts \
  --contract 0xYourTokenContract \
  --symbol TOKEN \
  --chain base \
  --amount 100
```

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
