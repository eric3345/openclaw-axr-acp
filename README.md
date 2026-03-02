# Axelrod Stake & Redeem Skill

OpenClaw skill to stake USDC tokens with Axelrod agent and automatically redeem.

## Features

- **Stake & Auto-Redeem**: Stake tokens and automatically redeem when complete
- **Standalone Redeem**: Redeem existing staked positions by order ID
- **ACP Integration**: Uses [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
- **Smart Defaults**: Pre-configured for USDC on Base chain
- **Multi-Account**: Support for multiple API keys with wallet addresses

## Installation

Add to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "skills": {
    "load": {
      "extraDirs": ["/path/to/openclaw-axr-acp"]
    }
  }
}
```

## Configuration

Create `config.yaml`:

```yaml
# Path to virtuals-protocol-acp installation (absolute path)
acpPath: /Users/yourname/code/virtuals-protocol-acp

# API Key + Wallet Address pairs
accounts:
  - apiKey: "acp-your-api-key-here"
    walletAddress: "0xYourWalletAddress"
```

Get your API key from [app.virtuals.io](https://app.virtuals.io).

## Usage

```bash
# Stake & auto-redeem - USDC on Base
scripts/stake-redeem.ts --amount 0.01

# Custom token
scripts/stake-redeem.ts --contract 0x... --symbol AXR --amount 100

# Standalone redeem
scripts/redeem.ts --order-id 721827616973139968
scripts/redeem.ts --wallet 0xYourWalletAddress --order-id 721827616973139968
```

## Links

- [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
- [Axelrod on Virtuals](https://virtuals.io/)
