#!/usr/bin/env npx tsx
/**
 * swap-and-back - Execute swap and swap back via virtual-acp
 *
 * This performs two swaps:
 * 1. Swap from source token to target token (e.g., USDC -> WETH)
 * 2. Swap the received tokens back (e.g., WETH -> USDC)
 *
 * Usage: swap-and-back [options]
 *
 * Options:
 *   --from-token <address>   Source token contract address (required)
 *   --from-symbol <symbol>   Source token symbol (e.g., USDC)
 *   --to-token <address>     Target token contract address (required)
 *   --to-symbol <symbol>     Target token symbol (e.g., WETH)
 *   --amount <number>        Amount to swap (required)
 *   --chain <name>           Chain name (default: base)
 *   --api-key <key>          ACP API key (overrides config)
 *   --help                   Show help
 */

import { spawn } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project paths
const PROJECT_ROOT = join(__dirname, "..");
const CONFIG_PATH = join(PROJECT_ROOT, "config.yaml");

interface Account {
  apiKey: string;
  walletAddress: string;
}

interface Config {
  acpPath?: string;
  accounts?: Account[];
}

interface ACPConfig {
  LITE_AGENT_API_KEY?: string;
}

// Simple YAML parser for our config format
function parseYaml(content: string): Config {
  const result: any = {};
  const lines = content.split('\n');
  let currentArray: any[] | null = null;
  const arrayKey = "accounts";
  let currentAccount: any = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (key === arrayKey) {
        currentArray = [];
        result[key] = currentArray;
        currentAccount = null;
      } else if (currentArray !== null && currentAccount) {
        // Property of current account
        if (key === 'apiKey' || key === 'walletAddress') {
          currentAccount[key] = value.replace(/^["']|["']$/g, '');
        }
      } else {
        result[key] = value;
        currentArray = null;
        currentAccount = null;
      }
    } else if (trimmed.startsWith('- ') && currentArray !== null) {
      // Start of new account item
      currentAccount = {};
      currentArray.push(currentAccount);
      // Check if apiKey is on same line
      if (trimmed.includes('apiKey:')) {
        const apiKeyMatch = trimmed.match(/apiKey:\s*(.+)/);
        if (apiKeyMatch) {
          currentAccount.apiKey = apiKeyMatch[1].replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return result as Config;
}

// Load config from YAML
function loadConfig(): Config {
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return parseYaml(content);
  } catch {
    return {};
  }
}

// Get ACP path from config
function getACPPath(): string {
  const config = loadConfig();
  return config.acpPath || "/path/to/virtuals-protocol-acp";
}

// Get ACP config file path
function getACPConfigPath(): string {
  return join(getACPPath(), "config.json");
}

// Get ACP CLI path
function getACPCLIPath(): string {
  return join(getACPPath(), "bin", "acp.ts");
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

// Get all accounts
function getAccounts(providedKey?: string): Account[] {
  const config = loadConfig();
  if (providedKey) {
    return [{ apiKey: providedKey, walletAddress: "" }];
  }
  if (!config.accounts || config.accounts.length === 0) {
    throw new Error("No accounts found in config.yaml. Please add accounts with apiKey and walletAddress.");
  }
  return config.accounts;
}

// Update ACP config with API key
function updateACPConfig(apiKey: string): void {
  try {
    const acpConfigPath = getACPConfigPath();
    let config: ACPConfig = {};
    try {
      const content = readFileSync(acpConfigPath, "utf-8");
      config = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }
    config.LITE_AGENT_API_KEY = apiKey;
    writeFileSync(acpConfigPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(`Warning: Could not update ACP config: ${(error as Error).message}`);
  }
}

// Run ACP command
async function runACP(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const acpCLIPath = getACPCLIPath();
    const child = spawn("npx", ["tsx", acpCLIPath, ...args], {
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

// Parse job ID from output
function parseJobId(output: string): string | null {
  const match = output.match(/job[_\s]?id[:\s]+(\d+)/i);
  return match ? match[1] : null;
}

// Wait for job completion and return received amount
async function waitForJobCompletion(jobId: string, timeoutMs = 300000): Promise<{ completed: boolean; receivedAmount?: string }> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds

  while (Date.now() - startTime < timeoutMs) {
    const result = await runACP(["job", "status", jobId, "--json"]);
    if (result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        const phase = data.phase?.toUpperCase() || data.data?.phase?.toUpperCase();
        if (phase === "COMPLETED") {
          // Try to get received amount from deliverable
          const deliverable = data.deliverable || data.data?.deliverable;
          if (deliverable?.data) {
            // Check if there's toAmount in the deliverable
            const toAmount = deliverable.data.toAmount || deliverable.data.amount;
            if (toAmount) {
              return { completed: true, receivedAmount: String(toAmount) };
            }
          }
          return { completed: true };
        }
        if (phase === "REJECTED" || phase === "FAILED" || phase === "EXPIRED") return { completed: false };
      } catch {
        // Ignore parse errors, continue polling
      }
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  return { completed: false };
}

// Execute a single swap
async function executeSingleSwap(
  account: Account,
  fromToken: string,
  fromSymbol: string,
  toToken: string,
  toSymbol: string,
  amount: string,
  stepName: string
): Promise<{ success: boolean; jobId?: string; receivedAmount?: string; error?: string }> {
  const { apiKey } = account;
  const axelrodWallet = "0x999A1B6033998A05F7e37e4BD471038dF46624E1";

  console.log(`\n[${stepName}]`);
  console.log(`  Swapping ${amount} ${fromSymbol} -> ${toSymbol}`);

  try {
    const requirements = JSON.stringify({
      fromContractAddress: fromToken,
      fromSymbol,
      toContractAddress: toToken,
      toSymbol,
      amount: parseFloat(amount)
    });

    const swapResult = await runACP([
      "job", "create", axelrodWallet, "swap_token",
      "--requirements", requirements
    ]);

    if (swapResult.exitCode !== 0) {
      console.error(`✗ ${stepName} job creation failed`);
      console.error(swapResult.stderr || swapResult.stdout);
      return { success: false, error: "Swap job creation failed" };
    }

    const jobId = parseJobId(swapResult.stdout) || parseJobId(swapResult.stderr);
    if (!jobId) {
      console.error(`✗ Could not parse ${stepName} job ID`);
      console.log(swapResult.stdout);
      return { success: false, error: "Could not parse swap job ID" };
    }

    console.log(`✓ ${stepName} job created: ${jobId}`);

    console.log(`  Waiting for ${stepName} to complete...`);
    const completionResult = await waitForJobCompletion(jobId);

    if (!completionResult.completed) {
      console.warn(`⚠ ${stepName} job ${jobId} did not complete in time`);
      console.log("  You can check status later with: acp job status " + jobId);
      return {
        success: true,
        jobId
      };
    }

    console.log(`✓ ${stepName} completed`);
    const receivedAmount = completionResult.receivedAmount;
    if (receivedAmount) {
      console.log(`  Received: ${receivedAmount} ${toSymbol}`);
    }
    return {
      success: true,
      jobId,
      receivedAmount
    };
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`✗ ${stepName} FAILED: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// Execute swap and back for a single account
async function executeSwapAndBack(
  account: Account,
  fromToken: string,
  fromSymbol: string,
  toToken: string,
  toSymbol: string,
  amount: string,
  index: number,
  total: number
): Promise<{ success: boolean; firstJobId?: string; secondJobId?: string; error?: string }> {
  const { apiKey, walletAddress } = account;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`[${index + 1}/${total}] SWAP AND BACK`);
  console.log(`${"=".repeat(50)}`);
  console.log(`  Account: ${walletAddress}`);
  console.log(`  API Key: ${apiKey.slice(0, 12)}...`);
  console.log(`  Path: ${amount} ${fromSymbol} -> ${toSymbol} -> ${fromSymbol}`);

  try {
    // Update ACP config
    console.log("\n[Setup] Updating ACP config...");
    updateACPConfig(apiKey);
    console.log("✓ API key configured");

    // Step 1: First swap (from -> to)
    console.log(`\n[Step 1/2] First Swap: ${fromSymbol} -> ${toSymbol}`);
    const firstResult = await executeSingleSwap(
      account,
      fromToken,
      fromSymbol,
      toToken,
      toSymbol,
      amount,
      "First Swap"
    );

    if (!firstResult.success) {
      return {
        success: false,
        error: "First swap failed"
      };
    }

    // Step 2: Second swap (to -> from)
    // Use the actual received amount from first swap
    const secondAmount = firstResult.receivedAmount || amount;
    console.log(`\n[Step 2/2] Second Swap: ${toSymbol} -> ${fromSymbol} (${secondAmount})`);
    const secondResult = await executeSingleSwap(
      account,
      toToken,
      toSymbol,
      fromToken,
      fromSymbol,
      secondAmount,
      "Second Swap"
    );

    if (!secondResult.success) {
      return {
        success: false,
        firstJobId: firstResult.jobId,
        error: "Second swap failed"
      };
    }

    console.log(`\n✓ [${index + 1}/${total}] COMPLETED`);
    console.log(`  First Swap Job ID: ${firstResult.jobId}`);
    console.log(`  Second Swap Job ID: ${secondResult.jobId}`);

    return {
      success: true,
      firstJobId: firstResult.jobId,
      secondJobId: secondResult.jobId
    };
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`✗ [${index + 1}/${total}] FAILED: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// Main function
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Default values
  const DEFAULT_CHAIN = "base";

  // Show help
  if (args.help || args.h) {
    console.log(`
swap-and-back - Execute swap and swap back via virtual-acp

This performs two swaps:
  1. Swap from source token to target token (e.g., USDC -> WETH)
  2. Swap the received tokens back (e.g., WETH -> USDC)

Usage: swap-and-back [options]

Options:
  --from-token <address>   Source token contract address (required)
  --from-symbol <symbol>   Source token symbol (e.g., USDC)
  --to-token <address>     Target token contract address (required)
  --to-symbol <symbol>     Target token symbol (e.g., WETH)
  --amount <number>        Amount to swap (required)
  --chain <name>           Chain name (default: ${DEFAULT_CHAIN})
  --api-key <key>          ACP API key (overrides config)
  --help                   Show this help

Examples:
  # Swap 10 USDC to WETH and back to USDC on Base
  swap-and-back --from-token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \\
      --from-symbol USDC \\
      --to-token 0x4200000000000000000000000000000000000006 \\
      --to-symbol WETH \\
      --amount 10

Config format (config.yaml):
  accounts:
    - apiKey: "acp-your-api-key"
      walletAddress: "0xYourWalletAddress"

Note: If multiple accounts are configured in config.yaml,
this will execute swap-and-back for each account in serial order.
`);
    return 0;
  }

  // If no arguments at all, show help
  if (Object.keys(args).length === 0) {
    args.help = "true";
    return main();
  }

  // Validate required arguments
  const requiredArgs = ["from-token", "from-symbol", "to-token", "to-symbol", "amount"];
  for (const arg of requiredArgs) {
    if (!args[arg]) {
      console.error(`Error: Missing required argument: --${arg}`);
      return 1;
    }
  }

  const fromToken = args["from-token"];
  const fromSymbol = args["from-symbol"];
  const toToken = args["to-token"];
  const toSymbol = args["to-symbol"];
  const amount = args.amount;

  // Load config and get accounts
  const accounts = getAccounts(args["api-key"]);

  console.log(`\nFound ${accounts.length} account(s), will execute swap-and-back for each account in serial order.\n`);

  const results = [];
  let successCount = 0;

  // Execute swap-and-back for each account in serial
  for (let i = 0; i < accounts.length; i++) {
    const result = await executeSwapAndBack(accounts[i], fromToken, fromSymbol, toToken, toSymbol, amount, i, accounts.length);
    results.push(result);
    if (result.success) {
      successCount++;
    }
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(50)}`);
  console.log(`  Total: ${accounts.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${accounts.length - successCount}`);

  return accounts.length === successCount ? 0 : 1;
}

// Run
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error("Error:", error.message);
  process.exit(1);
});
