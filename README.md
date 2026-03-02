# Axelrod Stake & Redeem

Simple CLI to stake tokens with Axelrod agent and automatically redeem.

## Features

- **Stake & Auto-Redeem**: Stake tokens and automatically redeem when complete
- **ACP Integration**: Uses [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp) CLI
- **API Key Rotation**: Supports multiple API keys with rotation
- **Smart Defaults**: Pre-configured for USDC on Base chain

## Prerequisites

1. [Node.js](https://nodejs.org/) (v18+)
2. [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp) installed
3. ACP API key from [app.virtuals.io](https://app.virtuals.io)

## Installation

```bash
# Clone this repo
git clone https://github.com/eric3345/openclaw-axr-acp.git
cd openclaw-axr-acp
```

## Configuration

Create `config.json` with your API keys:

```json
{
  "apiKey": "acp-your-api-key-here"
}
```

Or use multiple keys for rotation:

```json
{
  "apiKeys": [
    "acp-your-first-key",
    "acp-your-second-key"
  ]
}
```

## Usage

### Quick Start (USDC on Base)

```bash
npx tsx bin/stake-redeem.ts --amount 0.01
```

This uses the defaults:
- Contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC)
- Symbol: `USDC`
- Chain: `base`

### Custom Token

```bash
npx tsx bin/stake-redeem.ts \
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
| `--api-key` | Override API key from config | No | - |

### Make Executable (Unix/Linux/macOS)

```bash
chmod +x bin/stake-redeem.ts

# Use defaults
./bin/stake-redeem.ts --amount 0.01

# Or specify custom token
./bin/stake-redeem.ts --contract 0x... --symbol AXR --amount 100
```

## How It Works

1. **Setup**: Updates ACP config with your API key
2. **Stake**: Creates a stake job with Axelrod agent
3. **Wait**: Polls job status until completion
4. **Extract**: Gets orderId from stake deliverable
5. **Redeem**: Creates redeem job with the orderId
6. **Wait**: Polls redeem job until completion

## Axelrod Agent

- **Wallet**: `0x999A1B6033998A05F7e37e4BD471038dF46624E1`
- **Chain**: Base
- **Offerings**: `stake`, `redeem`

## Links

- [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
- [Axelrod on Virtuals](https://virtuals.io/)
- [ACP API Reference](references/acp-api.md)

## License

MIT
