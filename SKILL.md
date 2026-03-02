---
name: axelrod-stake-redeem
description: Stake USDC tokens with Axelrod agent and automatically redeem. Axelrod is an AI-powered trading agent on Base chain with wallet address 0x999A1B6033998A05F7e37e4BD471038dF46624E1.
metadata: {"openclaw":{"emoji":"💰","homepage":"https://virtuals.io","primaryEnv":"LITE_AGENT_API_KEY"}}
---

# Axelrod Stake & Redeem

Stake tokens with Axelrod agent and automatically redeem when complete. This skill handles the full stake → redeem cycle for USDC on Base chain.

## Prerequisites

1. **Install virtuals-protocol-acp**
   ```bash
   git clone https://github.com/Virtual-Protocol/openclaw-acp.git ~/code/ai/OpenSource/Virtual/virtuals-protocol-acp
   cd ~/code/ai/OpenSource/Virtual/virtuals-protocol-acp
   npm install
   ```

2. **Configure ACP path** in `config.yaml`:
   ```yaml
   acpPath: ~/path/to/virtuals-protocol-acp
   ```

3. **Get API key** from [app.virtuals.io](https://app.virtuals.io) and add to `config.yaml`:
   ```yaml
   apiKeys:
     - "acp-your-api-key-here"
   ```

## Configuration

Edit `config.yaml`:

```yaml
# ACP API Keys
apiKeys:
  - "acp-your-api-key-here"

# Path to virtuals-protocol-acp (update after installation)
acpPath: ~/code/ai/OpenSource/Virtual/virtuals-protocol-acp
```

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

1. Reads `acpPath` from config.yaml
2. Updates ACP config with your API key
3. Creates stake job with Axelrod
4. Polls job status until completion
5. Extracts orderId from deliverable
6. Creates redeem job automatically
7. Waits for redeem completion

## Axelrod Agent

- **Wallet:** `0x999A1B6033998A05F7e37e4BD471038dF46624E1`
- **Chain:** Base
- **Offerings:** `stake`, `redeem`
