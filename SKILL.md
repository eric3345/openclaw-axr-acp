---
name: openclaw-axr-acp
description: ACP trading skill for Axelrod agent via Virtuals Protocol. Use when the user wants to trade with Axelrod (swap_token, stake, redeem), check job status, or set up automated trading loops. Always run scripts/axelrod_acp.py for real-time execution.
---

# Axelrod ACP Trading Skill

Virtuals Protocol ACP trading interface for Axelrod agent on Base chain.

## Quick Start

### First-Time Setup

1. **Configure API keys** in `config.yaml`:

```yaml
apiKeys:
  - "your-first-api-key-here"
  - "your-second-api-key-here"  # Optional: for rotation
```

2. **Install dependencies**:

```bash
pip install -r requirements.txt
```

3. **Verify setup**:

```bash
python scripts/axelrod_acp.py trade --help
```

## Core Usage

### Single Trade

Execute a one-time trade with Axelrod:

```bash
python scripts/axelrod_acp.py trade --offering swap_token --requirements '{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}'
```

**Supported Offerings:**

| Offering | Description | Example Requirements |
|----------|-------------|---------------------|
| `swap_token` | Swap tokens on Base chain | `{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}` |
| `stake` | Stake tokens | `{"contractAddress":"0x...","symbol":"AXR","chain":"base","amount":100}` |
| `redeem` | Redeem by order ID | `{"orderId":"1002369697"}` |

### Check Job Status

```bash
python scripts/axelrod_acp.py job-status 12345
```

### Automated Trading

Run a trading loop with specified interval and iterations:

```bash
python scripts/axelrod_acp.py auto \
  --interval 60 \
  --iterations 10 \
  --trades '[{"offering":"swap_token","requirements":{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}}]'
```

**Parameters:**
- `--interval`: Seconds between trades (minimum 10)
- `--iterations`: Number of trades to execute (0 = infinite)
- `--trades`: JSON array of trade configurations
- `--task-id`: (Optional) Custom task identifier

### View Automation Status

```bash
# View all running automations
python scripts/axelrod_acp.py status

# View specific task
python scripts/axelrod_acp.py status --task-id auto_1234567890
```

### Stop Automation

```bash
python scripts/axelrod_acp.py stop auto_1234567890
```

## Automation Examples

### DCA Strategy (Dollar Cost Average)

Buy ETH every hour:

```bash
python scripts/axelrod_acp.py auto \
  --interval 3600 \
  --iterations 24 \
  --trades '[{"offering":"swap_token","requirements":{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}}]'
```

### Multi-Strategy Loop

Combine swap and stake operations:

```bash
python scripts/axelrod_acp.py auto \
  --interval 300 \
  --iterations 100 \
  --trades '[
    {"offering":"swap_token","requirements":{"amount":100,"fromSymbol":"USDC","toSymbol":"AXR"}},
    {"offering":"stake","requirements":{"contractAddress":"0x...","symbol":"AXR","chain":"base","amount":100}}
  ]'
```

### Infinite Monitoring Loop

Run until manually stopped:

```bash
python scripts/axelrod_acp.py auto \
  --interval 600 \
  --iterations 0 \
  --trades '[{"offering":"swap_token","requirements":{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}}]'

# Stop with:
python scripts/axelrod_acp.py stop <task-id>
```

## Trade Data Format

Each trade in the `--trades` array follows this structure:

```json
{
  "offering": "swap_token | stake | redeem",
  "requirements": {
    // Key-value pairs specific to the offering
  }
}
```

**Examples by Offering:**

```json
// swap_token
{"offering": "swap_token", "requirements": {"amount": 0.01, "fromSymbol": "USDC", "toSymbol": "WETH"}}

// stake
{"offering": "stake", "requirements": {"contractAddress": "0x...", "symbol": "AXR", "chain": "base", "amount": 100}}

// redeem (by order ID)
{"offering": "redeem", "requirements": {"orderId": "1002369697"}}
```

## Workflow

1. **Prepare config.yaml** with your API keys
2. **Choose offering type** (swap_token, stake, or redeem)
3. **Define requirements** based on the offering
4. **Execute trade** or **start automation**
5. **Monitor status** using status command
6. **Stop automation** when done

## Current Limitations

- **Agent**: Only Axelrod (0x999A1B6033998A05F7e37e4BD471038dF46624E1)
- **Chain**: Base chain only
- **Offerings**: swap_token, stake, redeem only

## File Structure

```
openclaw-axr-acp/
├── SKILL.md              # This file - agent instructions
├── README.md             # Human documentation
├── config.yaml           # API keys configuration
├── requirements.txt      # Python dependencies
├── scripts/
│   └── axelrod_acp.py    # Main CLI
└── references/
    └── acp-api.md        # ACP API reference
```

## API Reference

For detailed ACP API documentation, see: [references/acp-api.md](references/acp-api.md)

## Best Practices

1. Start with small test amounts
2. Use `--iterations` for production (avoid infinite loops)
3. Monitor automation status regularly
4. Keep API keys secure (never commit to version control)
5. Use shorter intervals for testing, longer for production
