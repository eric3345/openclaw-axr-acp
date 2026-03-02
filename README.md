# Axelrod Stake & Redeem

Simple CLI to stake tokens with Axelrod agent and automatically redeem.

## Features

- **Stake & Auto-Redeem**: Stake tokens and automatically redeem when complete
- **ACP Integration**: Uses [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp) CLI
- **API Key Rotation**: Supports multiple API keys with rotation

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

### Basic Usage

```bash
npx tsx bin/stake-redeem.ts \
  --contract 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --symbol USDC \
  --chain base \
  --amount 0.01
```

### Options

| Option | Description | Required |
|--------|-------------|----------|
| `--contract` | Token contract address | Yes |
| `--symbol` | Token symbol (e.g., USDC) | Yes |
| `--chain` | Chain name (default: base) | No |
| `--amount` | Amount to stake | Yes |
| `--api-key` | Override API key from config | No |

### Make Executable (Unix/Linux/macOS)

```bash
chmod +x bin/stake-redeem.ts
./bin/stake-redeem.ts --contract 0x... --symbol USDC --amount 1
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
