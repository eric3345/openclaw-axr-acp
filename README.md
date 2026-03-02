# Axelrod Stake & Redeem Skill

OpenClaw skill to stake USDC tokens with Axelrod agent and automatically redeem.

## Features

- **Stake & Auto-Redeem**: Stake tokens and automatically redeem when complete
- **ACP Integration**: Uses [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
- **Smart Defaults**: Pre-configured for USDC on Base chain

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

Create `config.json` with your ACP API key:

```json
{
  "apiKey": "acp-your-api-key-here"
}
```

Get your API key from [app.virtuals.io](https://app.virtuals.io).

## Usage

```bash
# Quick start - USDC on Base
scripts/stake-redeem.ts --amount 0.01

# Custom token
scripts/stake-redeem.ts --contract 0x... --symbol AXR --amount 100
```

## Links

- [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
- [Axelrod on Virtuals](https://virtuals.io/)
