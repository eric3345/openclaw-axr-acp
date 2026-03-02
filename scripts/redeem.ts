#!/usr/bin/env npx tsx
/**
 * redeem - Redeem staked tokens by orderId
 *
 * Usage: redeem [options]
 *
 * Options:
 *   --wallet <address>   Wallet address (required if multiple accounts)
 *   --order-id <id>       Order ID from stake (required)
 *   --help                Show help
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

// Get accounts from config
function getAccounts(): Account[] {
  const config = loadConfig();
  if (!config.accounts || config.accounts.length === 0) {
    throw new Error("No accounts found in config.yaml. Please add accounts with apiKey and walletAddress.");
  }
  return config.accounts;
}

// Get account by wallet address
function getAccountByWallet(walletAddress: string): Account {
  const accounts = getAccounts();
  const account = accounts.find(a => a.walletAddress.toLowerCase() === walletAddress.toLowerCase());
  if (!account) {
    throw new Error(`No account found with wallet address: ${walletAddress}`);
  }
  return account;
}

// Get first account
function getFirstAccount(): Account {
  const accounts = getAccounts();
  return accounts[0];
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

// Execute redeem for a single account
async function executeRedeem(
  account: Account,
  orderId: string,
  index?: number,
  total?: number
): Promise<{ success: boolean; redeemJobId?: string; error?: string }> {
  const { apiKey, walletAddress } = account;
  const axelrodWallet = "0x999A1B6033998A05F7e37e4BD471038dF46624E1";

  console.log(`\n${"=".repeat(50)}`);
  console.log(`REDEEM ORDER`);
  console.log(`${"=".repeat(50)}`);
  console.log(`  Account: ${walletAddress}`);
  console.log(`  Agent: ${axelrodWallet}`);
  console.log(`  Order ID: ${orderId}`);

  try {
    // Update ACP config
    console.log("\n[Setup] Updating ACP config...");
    updateACPConfig(apiKey);
    console.log("✓ API key configured");

    // Create redeem job
    console.log("\n[Step 1/1] Creating redeem job...");
    const requirements = JSON.stringify({ orderId });

    const redeemResult = await runACP([
      "job", "create", axelrodWallet, "redeem",
      "--requirements", requirements
    ]);

    if (redeemResult.exitCode !== 0) {
      console.error("✗ Redeem job creation failed");
      console.error(redeemResult.stderr || redeemResult.stdout);
      return { success: false, error: "Redeem job creation failed" };
    }

    const redeemJobId = parseJobId(redeemResult.stdout) || parseJobId(redeemResult.stderr);
    if (!redeemJobId) {
      console.error("✗ Could not parse redeem job ID");
      console.log(redeemResult.stdout);
      return { success: false, error: "Could not parse redeem job ID" };
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

    console.log(`\n✓ COMPLETED`);
    console.log(`  Redeem Job ID: ${redeemJobId}`);

    return {
      success: true,
      redeemJobId
    };
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`✗ FAILED: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// Main function
async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Show help
  if (args.help || args.h) {
    console.log(`
redeem - Redeem staked tokens by orderId

Usage: redeem [options]

Options:
  --wallet <address>   Wallet address to use (optional, uses first account if not specified)
  --order-id <id>       Order ID from stake (required)
  --help                Show this help

Examples:
  # Redeem using first account in config
  redeem --order-id 721827616973139968

  # Redeem using specific wallet
  redeem --wallet 0x6fCc85effd01e847Ea9D59ee50a82dd44C0823DE --order-id 721827616973139968

Config format (config.yaml):
  accounts:
    - apiKey: "acp-your-api-key"
      walletAddress: "0xYourWalletAddress"
    - apiKey: "acp-another-key"
      walletAddress: "0xAnotherWalletAddress"
`);
    return 0;
  }

  // If no arguments at all, show help
  if (Object.keys(args).length === 0) {
    args.help = "true";
    return main();
  }

  // Validate required arguments
  if (!args["order-id"]) {
    console.error("Error: Missing required argument: --order-id");
    return 1;
  }

  const orderId = args["order-id"];
  const walletAddress = args.wallet;

  // Get account
  let account: Account;
  if (walletAddress) {
    account = getAccountByWallet(walletAddress);
  } else {
    account = getFirstAccount();
    console.log(`No wallet specified, using first account: ${account.walletAddress}`);
  }

  // Execute redeem
  const result = await executeRedeem(account, orderId);

  return result.success ? 0 : 1;
}

// Run
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error("Error:", error.message);
  process.exit(1);
});
