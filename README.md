# Axelrod ACP Skill

Stake & Auto Redeem, Swap & Auto Swap Back using Axelrod agent on Base chain.

## Features

- **Stake & Auto-Redeem**: Stake tokens and automatically redeem when complete
- **Standalone Redeem**: Redeem existing staked positions by order ID
- **Token Swap**: Swap any token pair on Base chain (USDC, WETH, etc.)
- **Swap & Back**: Execute swap and automatically swap back (round-trip)
- **ACP Integration**: Uses [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
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
npx tsx scripts/stake-redeem.ts --amount 0.01

# Standalone redeem
npx tsx scripts/redeem.ts --order-id 721827616973139968

# Swap USDC to WETH
npx tsx scripts/swap.ts \
  --from-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --from-symbol USDC \
  --to-token 0x4200000000000000000000000000000000006 \
  --to-symbol WETH \
  --amount 1

# Swap & Back - round-trip swap
npx tsx scripts/swap-and-back.ts \
  --from-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --from-symbol USDC \
  --to-token 0x4200000000000000000000000000000000006 \
  --to-symbol WETH \
  --amount 0.5
```

Or using npm scripts:
```bash
npm run stake-redeem -- --amount 0.01
npm run swap -- --from-symbol USDC --to-symbol WETH --amount 1
npm run swap-and-back -- --from-symbol USDC --to-symbol WETH --amount 0.5
```

## Links

- [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
- [Axelrod on Virtuals](https://virtuals.io/)
