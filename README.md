# Axelrod ACP Trading Skill

[Virtuals Protocol](https://github.com/Virtual-Protocol/openclaw-acp) ACP trading interface for [Axelrod](https://virtuals.io/) agent on Base chain.

## Overview

This skill enables OpenClaw agents to trade with Axelrod through the Agent Commerce Protocol (ACP). Axelrod is an AI-powered trading agent on Base chain with wallet address `0x999A1B6033998A05F7e37e4BD471038dF46624E1`.

**Supported Operations:**
- `swap_token` - Swap tokens on Base chain
- `stake` - Stake AXR tokens
- `redeem` - Redeem staked tokens

## Installation

1. Clone this repository:

```bash
git clone https://github.com/your-org/openclaw-axr-acp.git
cd openclaw-axr-acp
```

2. **Add to OpenClaw config** (`~/.openclaw/openclaw.json`):

```json
{
  "skills": {
    "load": {
      "extraDirs": ["/path/to/openclaw-axr-acp"]
    }
  }
}
```

3. **Install dependencies**:

```bash
pip install -r requirements.txt
```

## Configuration

Edit `config.yaml` and add your API keys:

```yaml
apiKeys:
  - "your-first-lite-agent-api-key"
  - "your-second-api-key"  # Optional: for rotation/load balancing
```

To obtain API keys:
1. Visit [app.virtuals.io](https://app.virtuals.io)
2. Create an agent or use existing one
3. Copy your LITE_AGENT_API_KEY

## Usage

### Single Trade

```bash
# Swap tokens
python scripts/axelrod_acp.py trade \
  --offering swap_token \
  --requirements '{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}'

# Stake tokens
python scripts/axelrod_acp.py trade \
  --offering stake \
  --requirements '{"contractAddress":"0x...","symbol":"AXR","chain":"base","amount":100}'

# Redeem by order ID
python scripts/axelrod_acp.py trade \
  --offering redeem \
  --requirements '{"orderId":"1002369697"}'
```

### Check Job Status

```bash
python scripts/axelrod_acp.py job-status 12345
```

### Automated Trading

The `auto` command creates a loop that executes trades at a specified interval:

```bash
python scripts/axelrod_acp.py auto \
  --interval 60 \
  --iterations 10 \
  --trades '[{"offering":"swap_token","requirements":{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}}]'
```

**Parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `--interval` | Seconds between trades (min: 10) | `60` |
| `--iterations` | Number of trades (0 = infinite) | `10` or `0` |
| `--trades` | JSON array of trades | `'[...]'` |
| `--task-id` | Custom task ID (optional) | `my-dca-bot` |

### View Automation Status

```bash
# All tasks
python scripts/axelrod_acp.py status

# Specific task
python scripts/axelrod_acp.py status --task-id auto_1234567890
```

### Stop Automation

```bash
python scripts/axelrod_acp.py stop auto_1234567890
```

## Automation Examples

### DCA (Dollar Cost Average)

Buy $50 worth of ETH every hour for 24 hours:

```bash
python scripts/axelrod_acp.py auto \
  --interval 3600 \
  --iterations 24 \
  --trades '[{"offering":"swap_token","requirements":{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}}]'
```

### Auto-Staking Loop

Swap USDC to AXR and stake immediately every 6 hours:

```bash
python scripts/axelrod_acp.py auto \
  --interval 21600 \
  --iterations 100 \
  --trades '[
    {"offering":"swap_token","requirements":{"amount":100,"fromSymbol":"USDC","toSymbol":"AXR"}},
    {"offering":"stake","requirements":{"contractAddress":"0x...","symbol":"AXR","chain":"base","amount":100}}
  ]'
```

### Infinite Monitoring Bot

Run continuously until manually stopped:

```bash
python scripts/axelrod_acp.py auto \
  --interval 300 \
  --iterations 0 \
  --trades '[{"offering":"swap_token","requirements":{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}}]'
```

## Trade Data Format

Each trade in the array follows this structure:

```json
[
  {
    "offering": "swap_token|stake|redeem",
    "requirements": {
      "key": "value"
    }
  }
]
```

**Offering-specific requirements:**

| Offering | Required Fields | Example |
|----------|----------------|---------|
| `swap_token` | `fromSymbol`, `toSymbol`, `amount` | `{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}` |
| `stake` | `contractAddress`, `symbol`, `chain`, `amount` | `{"contractAddress":"0x...","symbol":"AXR","chain":"base","amount":100}` |
| `redeem` | `orderId` | `{"orderId":"1002369697"}` |

## File Structure

```
openclaw-axr-acp/
├── SKILL.md              # Agent instructions (frontmatter + docs)
├── README.md             # This file
├── config.yaml           # API configuration
├── requirements.txt      # Python dependencies
├── scripts/
│   └── axelrod_acp.py    # Main CLI script
└── references/
    └── acp-api.md        # ACP API reference
```

## How It Works

1. The agent reads `SKILL.md` to understand available commands
2. Commands are executed via `scripts/axelrod_acp.py`
3. The script:
   - Reads API keys from `config.yaml`
   - Updates the ACP config.json with the selected key
   - Makes HTTP requests to Virtuals Protocol ACP API
   - Returns results to stdout

## Dependencies

- Python 3.7+
- requests >= 2.31.0
- pyyaml >= 6.0.1

## Security

- Never commit `config.yaml` with real API keys
- Use environment variables for production deployments
- Start with small test amounts
- Monitor automation status regularly

## Troubleshooting

### "API key not found"

Edit `config.yaml` and add your LITE_AGENT_API_KEY.

### "Invalid offering"

Use only: `swap_token`, `stake`, or `redeem`

### "ACP config update failed"

Ensure the ACP config path is correct:
```
~/code/ai/OpenSource/Virtual/virtuals-protocol-acp/config.json
```

## License

MIT

## Links

- [Virtuals Protocol ACP](https://github.com/Virtual-Protocol/openclaw-acp)
- [Axelrod Agent](https://virtuals.io/)
- [ACP API Reference](references/acp-api.md)
