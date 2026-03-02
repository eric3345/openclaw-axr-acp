#!/usr/bin/env npx tsx
/**
 * stake-redeem - Stake tokens and automatically redeem
 *
 * Usage: stake-redeem [options]
 *
 * Options:
 *   --contract <address>  Token contract address (default: USDC on Base)
 *   --symbol <symbol>      Token symbol (default: USDC)
 *   --chain <name>         Chain name (default: base)
 *   --amount <number>      Amount to stake (required)
 *   --api-key <key>        ACP API key (overrides config)
 *   --help                 Show help
 */

import { spawn } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const ACP_CONFIG_PATH = join(homedir(), "code", "ai", "OpenSource", "Virtual", "virtuals-protocol-acp", "config.json");
const PROJECT_ROOT = join(__dirname, "..");
const CONFIG_PATH = join(PROJECT_ROOT, "config.json");

interface Config {
  apiKeys?: string[];
  apiKey?: string;
}

interface ACPConfig {
  LITE_AGENT_API_KEY?: string;
}

// Parse arguments
function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

// Load config
function loadConfig(): Config {
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Update ACP config with API key
function updateACPConfig(apiKey: string): void {
  try {
    let config: ACPConfig = {};
    try {
      const content = readFileSync(ACP_CONFIG_PATH, "utf-8");
      config = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }
    config.LITE_AGENT_API_KEY = apiKey;
    writeFileSync(ACP_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(`Warning: Could not update ACP config: ${(error as Error).message}`);
  }
}

// Run ACP command
async function runACP(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const acpPath = join(homedir(), "code", "ai", "OpenSource", "Virtual", "virtuals-protocol-acp", "bin", "acp.ts");
    const child = spawn("npx", ["tsx", acpPath, ...args], {
      stdio: "pipe",
      env: { ...process.env }
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

// Get API key with rotation
function getApiKey(config: Config, providedKey?: string): string {
  if (providedKey) return providedKey;
  if (config.apiKey) return config.apiKey;
  if (config.apiKeys && config.apiKeys.length > 0) {
    return config.apiKeys[0];
  }
  throw new Error("No API key found in config.json. Please add one.");
}

// Parse job ID from output
function parseJobId(output: string): string | null {
  const match = output.match(/job[_\s]?id[:\s]+(\d+)/i);
  return match ? match[1] : null;
}

// Parse orderId from deliverable
function parseOrderId(output: string): string | null {
  try {
    const jsonMatch = output.match(/\{[^{}]*"orderId"[^{}]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      return obj.orderId || obj.data?.orderId || null;
    }
  } catch {
    // Ignore JSON parse errors
  }
  const match = output.match(/order[_\s]?id[:\s]+(["']?)([a-zA-Z0-9]+)\1/i);
  return match ? match[2] : null;
}

// Wait for job completion
async function waitForJobCompletion(jobId: string, timeoutMs = 300000): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds

  while (Date.now() - startTime < timeoutMs) {
    const result = await runACP(["job", "status", jobId, "--json"]);
    if (result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        const phase = data.phase?.toUpperCase() || data.data?.phase?.toUpperCase();
        if (phase === "COMPLETED") return true;
        if (phase === "REJECTED" || phase === "FAILED" || phase === "EXPIRED") return false;
      } catch {
        // Ignore parse errors, continue polling
      }
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  return false;
}

// Main function
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Default values (USDC on Base)
  const DEFAULT_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const DEFAULT_SYMBOL = "USDC";
  const DEFAULT_CHAIN = "base";

  // Show help
  if (args.help || args.h) {
    console.log(`
stake-redeem - Stake tokens and automatically redeem

Usage: stake-redeem [options]

Options:
  --contract <address>  Token contract address (default: ${DEFAULT_CONTRACT})
  --symbol <symbol>      Token symbol (default: ${DEFAULT_SYMBOL})
  --chain <name>         Chain name (default: ${DEFAULT_CHAIN})
  --amount <number>      Amount to stake (required)
  --api-key <key>        ACP API key (overrides config)
  --help                 Show this help

Examples:
  # Use defaults (USDC on Base), only specify amount
  stake-redeem --amount 0.01

  # Specify custom token
  stake-redeem --contract 0x... --symbol AXR --chain base --amount 100
`);
    return 0;
  }

  // If no arguments at all, show help
  if (Object.keys(args).length === 0) {
    args.help = "true";
    return main();
  }

  // Validate required arguments (only amount is required)
  if (!args.amount) {
    console.error("Error: Missing required argument: --amount");
    return 1;
  }

  const contract = args.contract || DEFAULT_CONTRACT;
  const symbol = args.symbol || DEFAULT_SYMBOL;
  const chain = args.chain || DEFAULT_CHAIN;
  const amount = args.amount;

  // Load config and get API key
  const config = loadConfig();
  const apiKey = getApiKey(config, args["api-key"]);

  console.log("\n" + "=".repeat(50));
  console.log("STAKE AND REDEEM");
  console.log("=".repeat(50));
  console.log(`  Contract: ${contract}`);
  console.log(`  Symbol: ${symbol}`);
  console.log(`  Chain: ${chain}`);
  console.log(`  Amount: ${amount}`);

  // Update ACP config
  console.log("\n[Setup] Updating ACP config...");
  updateACPConfig(apiKey);
  console.log("✓ API key configured");

  // Axelrod wallet
  const axelrodWallet = "0x999A1B6033998A05F7e37e4BD471038dF46624E1";

  // Step 1: Create stake job
  console.log("\n[Step 1/3] Creating stake job...");
  const requirements = JSON.stringify({
    contractAddress: contract,
    symbol: symbol,
    chain: chain,
    amount: parseFloat(amount)
  });

  const stakeResult = await runACP([
    "job", "create", axelrodWallet, "stake",
    "--requirements", requirements
  ]);

  if (stakeResult.exitCode !== 0) {
    console.error("✗ Stake job creation failed");
    console.error(stakeResult.stderr || stakeResult.stdout);
    return 1;
  }

  const stakeJobId = parseJobId(stakeResult.stdout) || parseJobId(stakeResult.stderr);
  if (!stakeJobId) {
    console.error("✗ Could not parse stake job ID");
    console.log(stakeResult.stdout);
    return 1;
  }

  console.log(`✓ Stake job created: ${stakeJobId}`);

  // Step 2: Wait for stake completion
  console.log("\n[Step 2/3] Waiting for stake to complete...");
  const stakeCompleted = await waitForJobCompletion(stakeJobId);

  if (!stakeCompleted) {
    console.error(`✗ Stake job ${stakeJobId} did not complete`);
    return 1;
  }

  console.log(`✓ Stake job completed`);

  // Get orderId
  const statusResult = await runACP(["job", "status", stakeJobId, "--json"]);
  const orderId = parseOrderId(statusResult.stdout);

  if (!orderId) {
    console.error("✗ Could not find orderId in stake deliverable");
    console.log(statusResult.stdout);
    return 1;
  }

  console.log(`✓ Order ID: ${orderId}`);

  // Step 3: Create redeem job
  console.log("\n[Step 3/3] Creating redeem job...");
  const redeemRequirements = JSON.stringify({ orderId });

  const redeemResult = await runACP([
    "job", "create", axelrodWallet, "redeem",
    "--requirements", redeemRequirements
  ]);

  if (redeemResult.exitCode !== 0) {
    console.error("✗ Redeem job creation failed");
    console.error(redeemResult.stderr || redeemResult.stdout);
    return 1;
  }

  const redeemJobId = parseJobId(redeemResult.stdout) || parseJobId(redeemResult.stderr);
  if (!redeemJobId) {
    console.error("✗ Could not parse redeem job ID");
    console.log(redeemResult.stdout);
    return 1;
  }

  console.log(`✓ Redeem job created: ${redeemJobId}`);

  // Wait for redeem completion
  console.log("\n[Final] Waiting for redeem to complete...");
  const redeemCompleted = await waitForJobCompletion(redeemJobId);

  if (!redeemCompleted) {
    console.warn(`⚠ Redeem job ${redeemJobId} did not complete in time`);
    console.log("You can check status later with: acp job status " + redeemJobId);
  } else {
    console.log(`✓ Redeem job completed`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("✓ STAKE AND REDEEM COMPLETED");
  console.log("=".repeat(50));
  console.log(`  Stake Job ID: ${stakeJobId}`);
  console.log(`  Order ID: ${orderId}`);
  console.log(`  Redeem Job ID: ${redeemJobId}`);

  return 0;
}

// Run
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error("Error:", error.message);
  process.exit(1);
});
