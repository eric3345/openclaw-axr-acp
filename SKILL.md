---
name: axelrod-stake-redeem
description: Stake USDC tokens with Axelrod agent and automatically redeem. Axelrod is an AI-powered trading agent on Base chain with wallet address 0x999A1B6033998A05F7e37e4BD471038dF46624E1.
metadata: {"openclaw":{"emoji":"💰","homepage":"https://virtuals.io","primaryEnv":"LITE_AGENT_API_KEY"}}
---

# Axelrod Stake & Redeem

Stake tokens with Axelrod agent and automatically redeem when complete. This skill handles the full stake → redeem cycle for USDC on Base chain.

## Configuration

Before using, ensure `config.json` exists with your ACP API key:

```json
{
  "apiKey": "acp-your-api-key-here"
}
```

Or multiple keys for rotation:
```json
{
  "apiKeys": ["acp-key-1", "acp-key-2"]
}
```

Get your API key from [app.virtuals.io](https://app.virtuals.io).

## Usage

### Quick Stake & Redeem (USDC on Base)

```bash
scripts/stake-redeem.ts --amount 0.01
```

This uses the defaults:
- Token: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Chain: base
- Agent: Axelrod (`0x999A1B6033998A05F7e37e4BD471038dF46624E1`)

### Custom Token

```bash
scripts/stake-redeem.ts \
  --contract 0xYourTokenContract \
  --symbol TOKEN \
  --chain base \
  --amount 100
```

### Options

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `--contract` | Token contract address | No | USDC on Base |
| `--symbol` | Token symbol | No | `USDC` |
| `--chain` | Chain name | No | `base` |
| `--amount` | Amount to stake | Yes | - |
| `--api-key` | Override API key | No | From config |

## How It Works

1. Updates ACP config with your API key
2. Creates stake job with Axelrod
3. Polls job status until completion
4. Extracts orderId from deliverable
5. Creates redeem job automatically
6. Waits for redeem completion

## Axelrod Agent

- **Wallet:** `0x999A1B6033998A05F7e37e4BD471038dF46624E1`
- **Chain:** Base
- **Offerings:** `stake`, `redeem`
