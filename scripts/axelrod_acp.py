#!/usr/bin/env python3
"""
Axelrod ACP Trading Script
Trading with Axelrod agent via Virtuals Protocol ACP

Axelrod Wallet: 0x999A1B6033998A05F7e37e4BD471038dF46624E1
"""

import argparse
import json
import os
import signal
import sys
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except ModuleNotFoundError:
    print("Error: requests module not found. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    import yaml
except ModuleNotFoundError:
    print("Error: pyyaml module not found. Install with: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


# =============================================================================
# Constants
# =============================================================================

AXELROD_WALLET = "0x999A1B6033998A05F7e37e4BD471038dF46624E1"
ACP_API_URL = "https://claw-api.virtuals.io"

# Path to ACP config (for updating LITE_AGENT_API_KEY)
ACP_CONFIG_PATH = Path("~/code/ai/OpenSource/Virtual/virtuals-protocol-acp/config.json").expanduser()

# Project paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CONFIG_PATH = PROJECT_ROOT / "config.yaml"
STATE_PATH = PROJECT_ROOT / ".automation_state.json"

# Valid offerings
VALID_OFFERINGS = {"swap_token", "stake", "redeem", "stake_redeem"}

# Offering requirements validation
OFFERING_REQUIREMENTS = {
    "swap_token": ["fromSymbol", "toSymbol", "amount"],
    "stake": ["contractAddress", "symbol", "chain", "amount"],
    "redeem": ["orderId"],
    "stake_redeem": ["contractAddress", "symbol", "chain", "amount"],
}


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class TradeRequest:
    """Single trade request"""
    offering: str
    requirements: Dict[str, Any]


@dataclass
class AutomationTask:
    """Automation task state"""
    task_id: str
    interval: int
    max_iterations: int
    trade_data: List[TradeRequest]
    current_iteration: int = 0
    is_running: bool = False
    start_time: Optional[str] = None


# =============================================================================
# Configuration
# =============================================================================

class Config:
    """Configuration manager"""

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or CONFIG_PATH
        self._config: Dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        """Load configuration from YAML file"""
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"Config file not found: {self.config_path}\n"
                "Please create config.yaml with your apiKeys."
            )

        with open(self.config_path, 'r') as f:
            self._config = yaml.safe_load(f) or {}

    @property
    def api_keys(self) -> List[str]:
        """Get list of API keys"""
        keys = self._config.get('apiKeys', [])
        if isinstance(keys, str):
            keys = [keys]
        return [k for k in keys if k and isinstance(k, str) and k.strip()]

    def get_api_key(self, index: int = 0) -> str:
        """Get API key by index (with rotation)"""
        keys = self.api_keys
        if not keys:
            raise ValueError("No API keys found in config.yaml")
        if index >= len(keys):
            index = 0  # Wrap around
        return keys[index].strip()

    def validate_offering(self, offering: str) -> None:
        """Validate offering name"""
        if offering not in VALID_OFFERINGS:
            raise ValueError(
                f"Invalid offering: '{offering}'. "
                f"Valid offerings: {', '.join(sorted(VALID_OFFERINGS))}"
            )

    def validate_requirements(self, offering: str, requirements: Dict[str, Any]) -> None:
        """Validate requirements for an offering"""
        required = OFFERING_REQUIREMENTS.get(offering, [])
        missing = [r for r in required if r not in requirements]
        if missing:
            raise ValueError(
                f"Missing required fields for '{offering}': {', '.join(missing)}. "
                f"Required: {', '.join(required)}"
            )


# =============================================================================
# ACP Client
# =============================================================================

class ACPClient:
    """HTTP client for ACP API"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "x-api-key": api_key,
            "Content-Type": "application/json"
        })

    def create_job(
        self,
        provider_wallet: str,
        offering: str,
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a new job via ACP"""
        url = f"{ACP_API_URL}/acp/jobs"
        payload = {
            "providerWalletAddress": provider_wallet,
            "jobOfferingName": offering,
            "serviceRequirements": requirements
        }

        response = self.session.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

    def get_job(self, job_id: str) -> Dict[str, Any]:
        """Get job status"""
        url = f"{ACP_API_URL}/acp/jobs/{job_id}"
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        return response.json()


# =============================================================================
# Automation Manager
# =============================================================================

class AutomationManager:
    """Manage automation tasks"""

    def __init__(self, state_path: Optional[Path] = None):
        self.state_path = state_path or STATE_PATH
        self.tasks: Dict[str, AutomationTask] = {}
        self._load_state()

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print("\nReceived shutdown signal, stopping automations...")
        self.stop_all()
        sys.exit(0)

    def _load_state(self) -> None:
        """Load automation state from file"""
        if not self.state_path.exists():
            return

        try:
            with open(self.state_path, 'r') as f:
                state = json.load(f)

            for task_id, task_data in state.items():
                trade_data = [
                    TradeRequest(**t) for t in task_data.pop('trade_data', [])
                ]
                self.tasks[task_id] = AutomationTask(
                    **task_data,
                    trade_data=trade_data
                )
        except (json.JSONDecodeError, TypeError):
            pass

    def _save_state(self) -> None:
        """Save automation state to file"""
        state = {}
        for task_id, task in self.tasks.items():
            task_dict = asdict(task)
            task_dict['trade_data'] = [asdict(t) for t in task.trade_data]
            state[task_id] = task_dict

        with open(self.state_path, 'w') as f:
            json.dump(state, f, indent=2)

    def add_task(
        self,
        task_id: str,
        interval: int,
        max_iterations: int,
        trade_data: List[TradeRequest]
    ) -> AutomationTask:
        """Add a new automation task"""
        task = AutomationTask(
            task_id=task_id,
            interval=interval,
            max_iterations=max_iterations,
            trade_data=trade_data,
            current_iteration=0,
            is_running=True,
            start_time=datetime.now().isoformat()
        )
        self.tasks[task_id] = task
        self._save_state()
        return task

    def get_task(self, task_id: str) -> Optional[AutomationTask]:
        """Get a task by ID"""
        return self.tasks.get(task_id)

    def get_all_tasks(self) -> Dict[str, AutomationTask]:
        """Get all tasks"""
        return self.tasks.copy()

    def stop_task(self, task_id: str) -> bool:
        """Stop a running task"""
        task = self.tasks.get(task_id)
        if task and task.is_running:
            task.is_running = False
            self._save_state()
            return True
        return False

    def stop_all(self) -> None:
        """Stop all running tasks"""
        for task in self.tasks.values():
            task.is_running = False
        self._save_state()

    def cleanup_completed(self) -> int:
        """Remove completed tasks"""
        to_remove = [
            tid for tid, task in self.tasks.items()
            if not task.is_running and (
                task.max_iterations > 0 and
                task.current_iteration >= task.max_iterations
            )
        ]
        for tid in to_remove:
            del self.tasks[tid]
        if to_remove:
            self._save_state()
        return len(to_remove)


# =============================================================================
# Axelrod Trader
# =============================================================================

class AxelrodTrader:
    """Main trader class"""

    def __init__(self, config_path: Optional[Path] = None):
        self.config = Config(config_path)
        self.automation = AutomationManager()
        self._key_index = 0

    def _get_next_key(self) -> str:
        """Get next API key with rotation"""
        key = self.config.get_api_key(self._key_index)
        self._key_index = (self._key_index + 1) % len(self.config.api_keys)
        return key

    def _update_acp_config(self, api_key: str) -> None:
        """Update ACP config.json with the API key"""
        try:
            if ACP_CONFIG_PATH.exists():
                with open(ACP_CONFIG_PATH, 'r') as f:
                    acp_config = json.load(f)
            else:
                acp_config = {}

            acp_config['LITE_AGENT_API_KEY'] = api_key

            with open(ACP_CONFIG_PATH, 'w') as f:
                json.dump(acp_config, f, indent=2)

        except Exception as e:
            print(f"Warning: Could not update ACP config: {e}", file=sys.stderr)

    def create_trade(
        self,
        offering: str,
        requirements: Dict[str, Any],
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a single trade"""
        # Validate
        self.config.validate_offering(offering)
        self.config.validate_requirements(offering, requirements)

        # Get API key
        api_key = api_key or self._get_next_key()

        # Update ACP config
        self._update_acp_config(api_key)

        # Create job
        client = ACPClient(api_key)
        result = client.create_job(AXELROD_WALLET, offering, requirements)

        # Extract job ID
        job_id = result.get('data', {}).get('jobId') or result.get('jobId')

        print(f"Trade created successfully!")
        print(f"  Job ID: {job_id}")
        print(f"  Offering: {offering}")
        print(f"  Requirements: {json.dumps(requirements, indent=4)}")

        return result

    def stake_and_redeem(
        self,
        requirements: Dict[str, Any],
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Stake tokens and automatically redeem after completion.

        Args:
            requirements: Stake requirements (contractAddress, symbol, chain, amount)
            api_key: Optional API key

        Returns:
            Dict with stake and redeem job IDs and results
        """
        print("\n" + "="*50, flush=True)
        print("STAKE AND REDEEM", flush=True)
        print("="*50, flush=True)

        # Step 1: Stake
        print("\n[Step 1/2] Creating stake job...", flush=True)
        stake_result = self.create_trade("stake", requirements, api_key)
        stake_job_id = stake_result.get('data', {}).get('jobId') or stake_result.get('jobId')

        if not stake_job_id:
            print("✗ Stake failed: No job ID returned", file=sys.stderr, flush=True)
            return {"success": False, "stake": stake_result}

        # Step 2: Wait for stake to complete
        print(f"\n[Step 2/2] Waiting for stake to complete...", flush=True)
        completed = self._wait_for_job_completion(stake_job_id, timeout_seconds=7200)

        if not completed:
            print(f"✗ Stake job {stake_job_id} did not complete in time", file=sys.stderr, flush=True)
            return {"success": False, "stake_job_id": stake_job_id}

        # Step 3: Get orderId from deliverable
        job_data = self._get_job_status_internal(stake_job_id)
        deliverable = job_data.get('deliverable') if isinstance(job_data, dict) else None

        if not deliverable or 'orderId' not in deliverable:
            print(f"✗ No orderId found in deliverable", file=sys.stderr, flush=True)
            return {"success": False, "stake_job_id": stake_job_id}

        order_id = deliverable['orderId']
        print(f"\n✓ Stake completed! Order ID: {order_id}", flush=True)

        # Step 4: Redeem
        print(f"\n[Auto-redeem] Redeeming order {order_id}...", flush=True)
        redeem_result = self.create_trade("redeem", {"orderId": order_id}, api_key)
        redeem_job_id = redeem_result.get('data', {}).get('jobId') or redeem_result.get('jobId')

        if not redeem_job_id:
            print("✗ Redeem failed: No job ID returned", file=sys.stderr, flush=True)
            return {"success": False, "stake_job_id": stake_job_id, "order_id": order_id}

        # Wait for redeem to complete
        print(f"\n[Auto-redeem] Waiting for redeem to complete...", flush=True)
        self._wait_for_job_completion(redeem_job_id, timeout_seconds=7200)

        print("\n" + "="*50, flush=True)
        print("✓ STAKE AND REDEEM COMPLETED", flush=True)
        print("="*50, flush=True)
        print(f"  Stake Job ID: {stake_job_id}", flush=True)
        print(f"  Order ID: {order_id}", flush=True)
        print(f"  Redeem Job ID: {redeem_job_id}", flush=True)

        return {
            "success": True,
            "stake_job_id": stake_job_id,
            "order_id": order_id,
            "redeem_job_id": redeem_job_id
        }

    def _get_job_status_internal(self, job_id: str, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Get job status without printing (for internal use)"""
        api_key = api_key or self.config.get_api_key()
        client = ACPClient(api_key)
        result = client.get_job(job_id)

        if result.get('data', {}).get('data'):
            return result['data']['data']

        return result

    def get_job_status(self, job_id: str, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Get job status"""
        job_data = self._get_job_status_internal(job_id, api_key)

        if isinstance(job_data, dict) and job_data.get('phase'):
            print(f"\nJob {job_id} Status:")
            print(f"  Phase: {job_data.get('phase', 'unknown')}")
            print(f"  Provider: {job_data.get('providerName', 'N/A')}")
            print(f"  Client: {job_data.get('clientName', 'N/A')}")

            if job_data.get('deliverable'):
                print(f"  Deliverable: {json.dumps(job_data['deliverable'], indent=4)}")

        return job_data

    def start_automation(
        self,
        interval: int,
        iterations: int,
        trade_data: List[Dict[str, Any]],
        task_id: Optional[str] = None
    ) -> threading.Thread:
        """Start automated trading"""
        if task_id is None:
            task_id = f"auto_{int(time.time())}"

        # Validate and convert trades
        trades = []
        for trade in trade_data:
            offering = trade['offering']
            requirements = trade['requirements']

            self.config.validate_offering(offering)
            self.config.validate_requirements(offering, requirements)

            trades.append(TradeRequest(
                offering=offering,
                requirements=requirements
            ))

        # Create and store task
        self.automation.add_task(task_id, interval, iterations, trades)

        print(f"Starting automation: {task_id}")
        print(f"  Interval: {interval}s")
        print(f"  Iterations: {iterations if iterations > 0 else 'infinite'}")
        print(f"  Trades: {len(trades)}")

        # Start in background (non-daemon so main thread waits)
        thread = threading.Thread(
            target=self._run_automation,
            args=(task_id,),
            daemon=False
        )
        thread.start()

        return thread

    def _wait_for_job_completion(self, job_id: str, timeout_seconds: int = 7200) -> bool:
        """
        Wait for job to complete, with polling every 10 seconds

        Args:
            job_id: The job ID to wait for
            timeout_seconds: Maximum time to wait (default: 2 hours)

        Returns:
            True if job completed successfully, False otherwise
        """
        print(f"  Job ID: {job_id}, waiting for completion...")

        # Poll every 10 seconds, up to 2 hours
        max_polls = timeout_seconds // 10
        for poll in range(1, max_polls + 1):
            time.sleep(10)

            try:
                result = self._get_job_status_internal(job_id)
                phase = result.get('phase', '').upper() if isinstance(result, dict) else ''

                if phase == 'COMPLETED':
                    print(f"  Job {job_id} COMPLETED")
                    return True
                elif phase in ('REJECTED', 'EXPIRED', 'FAILED'):
                    print(f"  Job {job_id} {phase}")
                    return False

                # Still processing, continue waiting
                if poll % 6 == 0:  # Every minute
                    print(f"  Still waiting... ({poll * 10}s elapsed)")

            except Exception as e:
                print(f"  Error checking job status: {e}", file=sys.stderr)
                # Continue waiting anyway

        print(f"  Job {job_id} TIMEOUT after {timeout_seconds}s")
        return False

    def _run_automation(self, task_id: str) -> None:
        """Run automation loop (called in thread)"""
        # Keep getting fresh reference from automation manager
        while True:
            task = self.automation.get_task(task_id)
            if not task or not task.is_running:
                break

            # Check iteration limit
            if task.max_iterations > 0 and task.current_iteration >= task.max_iterations:
                print(f"\nAutomation {task_id} completed {task.max_iterations} iterations")
                task.is_running = False
                self.automation._save_state()
                break

            # Execute each trade in sequence (serial execution)
            for i, trade in enumerate(task.trade_data):
                # Re-check task status (may have been stopped)
                task = self.automation.get_task(task_id)
                if not task or not task.is_running:
                    break

                task.current_iteration += 1
                self.automation._save_state()  # Save immediately after increment

                trade_name = f"{task_id}-iter{task.current_iteration}-trade{i+1}"

                print(f"\n[{datetime.now().isoformat()}] {trade_name}")

                try:
                    # Create job and get job ID
                    api_key = self._get_next_key()
                    self._update_acp_config(api_key)

                    client = ACPClient(api_key)
                    result = client.create_job(AXELROD_WALLET, trade.offering, trade.requirements)

                    job_id = result.get('data', {}).get('jobId') or result.get('jobId')

                    if job_id:
                        print(f"  Job ID: {job_id}")
                        print(f"  Offering: {trade.offering}")
                        print(f"  Requirements: {json.dumps(trade.requirements, indent=4)}")

                        # Wait for job to complete (serial execution)
                        self._wait_for_job_completion(job_id, timeout_seconds=7200)
                        print(f"✓ {trade_name} finished")
                    else:
                        print(f"✗ {trade_name} failed: No job ID returned", file=sys.stderr)

                except Exception as e:
                    print(f"✗ {trade_name} failed: {e}", file=sys.stderr)

            # Wait for next iteration
            task = self.automation.get_task(task_id)
            if not task or not task.is_running:
                break
            if task.max_iterations == 0 or task.current_iteration < task.max_iterations:
                print(f"\nWaiting {task.interval}s until next iteration...")
                time.sleep(task.interval)

    def get_status(self, task_id: Optional[str] = None) -> None:
        """Show automation status"""
        if task_id:
            tasks = {task_id: self.automation.get_task(task_id)} if self.automation.get_task(task_id) else {}
        else:
            tasks = self.automation.get_all_tasks()

        if not tasks:
            print("No automation tasks found")
            return

        print("\nAutomation Status:")
        print("=" * 60)

        for tid, task in tasks.items():
            status_icon = "🟢 Running" if task.is_running else "🔴 Stopped"
            print(f"\nTask: {tid}")
            print(f"  Status: {status_icon}")
            print(f"  Iterations: {task.current_iteration}/{task.max_iterations if task.max_iterations > 0 else '∞'}")
            print(f"  Interval: {task.interval}s")
            print(f"  Trades: {len(task.trade_data)}")
            if task.start_time:
                print(f"  Started: {task.start_time}")

        print("=" * 60)

    def stop_automation(self, task_id: str) -> bool:
        """Stop an automation"""
        return self.automation.stop_task(task_id)

    def cleanup(self) -> None:
        """Cleanup completed tasks"""
        count = self.automation.cleanup_completed()
        if count > 0:
            print(f"Cleaned up {count} completed tasks")


# =============================================================================
# CLI
# =============================================================================

def main() -> int:
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Axelrod ACP Trading - Trade with Axelrod via Virtuals Protocol",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Swap tokens
  python scripts/axelrod_acp.py trade --offering swap_token \\
    --requirements '{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}'

  # Stake tokens
  python scripts/axelrod_acp.py trade --offering stake \\
    --requirements '{"contractAddress":"0x...","symbol":"USDC","chain":"base","amount":100}'

  # Stake and auto-redeem (stake completes then automatically redeems)
  python scripts/axelrod_acp.py trade --offering stake_redeem \\
    --requirements '{"contractAddress":"0x...","symbol":"USDC","chain":"base","amount":100}'

  # Redeem by order ID
  python scripts/axelrod_acp.py trade --offering redeem \\
    --requirements '{"orderId":"1002369697"}'

  # Start automation
  python scripts/axelrod_acp.py auto --interval 60 --iterations 10 \\
    --trades '[{"offering":"swap_token","requirements":{"amount":0.01,"fromSymbol":"USDC","toSymbol":"WETH"}}]'

  # Check status
  python scripts/axelrod_acp.py status

  # Stop automation
  python scripts/axelrod_acp.py stop auto_1234567890
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Trade command
    trade_parser = subparsers.add_parser('trade', help='Create a single trade')
    trade_parser.add_argument('--offering', required=True,
                               choices=list(VALID_OFFERINGS),
                               help='Type of trade')
    trade_parser.add_argument('--requirements', required=True,
                               help='Requirements as JSON string')
    trade_parser.add_argument('--api-key', help='API key (overrides config)')

    # Job status command
    status_job_parser = subparsers.add_parser('job-status', help='Check job status')
    status_job_parser.add_argument('job_id', help='Job ID to check')

    # Automation command
    auto_parser = subparsers.add_parser('auto', help='Start automated trading')
    auto_parser.add_argument('--interval', type=int, required=True,
                             help='Seconds between trades (min: 10)')
    auto_parser.add_argument('--iterations', type=int, required=True,
                             help='Number of trades (0 for infinite)')
    auto_parser.add_argument('--trades', required=True,
                             help='Trade data JSON array')
    auto_parser.add_argument('--task-id', help='Custom task ID')

    # Status command
    status_cmd_parser = subparsers.add_parser('status', help='Show automation status')
    status_cmd_parser.add_argument('--task-id', help='Specific task ID')

    # Stop command
    stop_parser = subparsers.add_parser('stop', help='Stop automation')
    stop_parser.add_argument('task_id', help='Task ID to stop')

    # Cleanup command
    subparsers.add_parser('cleanup', help='Clean up completed tasks')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    try:
        trader = AxelrodTrader()

        if args.command == 'trade':
            requirements = json.loads(args.requirements)
            if args.offering == 'stake_redeem':
                trader.stake_and_redeem(
                    requirements=requirements,
                    api_key=getattr(args, 'api_key', None)
                )
            else:
                trader.create_trade(
                    offering=args.offering,
                    requirements=requirements,
                    api_key=getattr(args, 'api_key', None)
                )

        elif args.command == 'job-status':
            trader.get_job_status(args.job_id)

        elif args.command == 'auto':
            if args.interval < 10:
                print("Error: interval must be at least 10 seconds", file=sys.stderr)
                return 1

            trade_data = json.loads(args.trades)
            thread = trader.start_automation(
                interval=args.interval,
                iterations=args.iterations,
                trade_data=trade_data,
                task_id=args.task_id
            )
            # Wait for automation to complete (keeps main thread alive)
            thread.join()

        elif args.command == 'status':
            trader.get_status(getattr(args, 'task_id', None))

        elif args.command == 'stop':
            if trader.stop_automation(args.task_id):
                print(f"Stopped: {args.task_id}")
            else:
                print(f"Task not found or not running: {args.task_id}", file=sys.stderr)
                return 1

        elif args.command == 'cleanup':
            trader.cleanup()

        return 0

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        return 1
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
