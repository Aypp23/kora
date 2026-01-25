# 🌀 Kora Rent Reclaim Bot

> **Automated, safe, and efficient rent recovery system for Kora Node Operators on Solana.**


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet%20%7C%20Mainnet-blueviolet)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-green)]()

### Dashboard Preview
<img width="1710" height="998" alt="Screenshot 2026-01-17 at 01 06 13" src="https://github.com/user-attachments/assets/c929fb24-f4aa-4087-a791-f47c8c839666" />

**🏆 Built for Superteam Nigeria Kora Bounty Hackathon**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [The Problem: Rent Leaks](#-the-problem-rent-leaks)
- [The Solution](#-the-solution)
- [Deep Dive: Supported Scenarios](#-deep-dive-supported-scenarios)
- [Features](#-features)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage Guide (CLI)](#-usage-guide-cli)
- [Telegram Ops](#-telegram-ops)
- [Web Dashboard](#-web-dashboard)
- [Production Deployment (Daemon/PM2)](#-production-deployment-daemonpm2)
- [Safety & Security](#-safety--security)
- [Architecture & Data Flow](#-architecture--data-flow)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

The **Kora Rent Reclaim Bot** is a specialized infrastructure tool designed specifically for **Kora Operators**.

In the Solana ecosystem, "Rent" is the storage cost paid to keep data accounts alive on the blockchain. As a Kora Operator, you sponsor transactions for thousands of users, often paying for the creation of temporary or permanent accounts. When these users churn or abandon their sessions, the SOL you paid for rent typically remains locked in these accounts forever.

This bot acts as an **automated garbage collector**, scanning your transaction history to identify, analyze, and recover this locked capital, returning it directly to your treasury.

---

## 💸 The Problem: Rent Leaks

When a Kora Operator functions as a Fee Payer, they effectively subsidize the network storage costs for their users. This creates three primary "Leakage Vectors":

1.  **Orphaned Token Accounts:**
    *   A user interacts with a new token.
    *   The Operator pays **~0.002039 SOL** to create an Associated Token Account (ATA).
    *   The user swaps the token and leaves. The ATA remains open, empty, and funded by you.

2.  **Failed Pipelines (Transient Accounts):**
    *   Complex apps often use temporary "Wrapper" accounts (e.g., wSOL) for bridging or swapping.
    *   If a transaction pipeline fails mid-way, these accounts can be left open, holding **~0.002 SOL** each.

3.  **Stale Internal State:**
    *   Operators often derive "Seed Accounts" for rate-limiting or session tracking.
    *   Once the session expires, the account is useless, but the **~0.00089 SOL** rent remains locked.

For a busy operator, these small leaks accumulate rapidly. **1,000 abandoned accounts = ~2 SOL locked.**

---

## 🛠 The Solution

The **Kora Rent Reclaim Bot** automates the entire lifecycle of rent recovery:

1.  **🔍 Monitor:** continuously scans the Operator's on-chain transaction history to build a database of every account ever funded.
2.  **🧠 Analyze:** Periodically checks the on-chain state of these accounts.
    *   *Is it empty?*
    *   *Is it still active?*
    *   *Is it protected by the grace period?*
3.  **♻️ Reclaim:** Constructs and signs generic `CloseAccount` transactions for eligible accounts, sweeping the rent lamports back to the Operator's wallet.
4.  **📉 Report:** Provides real-time ROI tracking via a Web Dashboard and Telegram alerts.

<<<<<<< HEAD
### 🎯 Supported Reclamation Scenarios
The bot currently supports 3 distinct strategies for identifying and reclaiming rent.
=======
---

## 🧠 Deep Dive: Supported Scenarios
>>>>>>> e0d290e (feat: complete roadmap implementation and overhaul documentation)

The bot currently supports three sophisticated identification strategies:

### 1. Transient wSOL Accounts
Temporary accounts used to wrap native SOL into SPL Token format.
*   **Detection:** We look for `initializeAccount` instructions where:
    *   `Owner` == Operator
    *   `Mint` == `So11111111111111111111111111111111111111112` (Wrapped SOL)
*   **Reclaim Logic:** Since the Operator owns the account, we simply sign a `CloseAccount` instruction.

### 2. Kora Seed Accounts
Accounts derived from the Operator's pubkey using a string seed (e.g., `rate-limit-user-123`).
*   **Detection:** We scan for `SystemProgram.createAccountWithSeed` instructions.
*   **Reclaim Logic:** We verify the account has no data and sign a transfer instruction to sweep the balance (SOL) back to the base key.

### 3. "Right to Reclaim" ATAs (Atomic Delegation)
This is a novel feature for Kora-integrated apps.
*   **Concept:** When an app creates a User ATA, it can atomically add a `SetAuthority` instruction, designating the Operator as the `CloseAuthority`.
*   **Why?** This gives the user full ownership of the tokens, but grants the Operator the *right* to close the account **if and only if it is empty**.
*   **Detection:** We scan transaction logs for `SetAuthority` (Close) instructions targeting accounts we funded.
*   **Safety:** The bot strictly checks `amount == 0` before attempting closure.

---

## ✨ Features

### Core Capabilities
*   **Automated Discovery:** No manual input needed; just provide your address.
*   **State Tracking:** Uses a persistent SQLite database (`kora_bot.db`) to track account lifecycles.
*   **Multi-Strategy:** Handles Token Accounts, System Accounts, and Delegated ATAs.
*   **Dry Run Mode:** `npm run reclaim -- --dry-run` simulates the entire process without sending transactions.

### Interfaces
*   **CLI Tool:** Full control for DevOps and manual runs.
*   **Telegram Bot:** Remote monitoring, alerts, and commands.
*   **Web Dashboard:** A React-based UI to visualize your ROI.

### Reporting
*   **Audit Logging:** Every reclaimed lamport is logged to `audit.log` with Tx IDs.
*   **On-Chain Audit Trail:** Every transaction includes a `Memo` instruction with the specific reason for reclamation (e.g., "Kora Rent Reclaim...").
*   **Daily Digest:** The Telegram bot sends a midnight summary of recovered funds.
*   **High Rent Alert:** Automatically notifies Telegram if total locked rent exceeds **1.0 SOL** (Hardcoded safety threshold).

---

## 🚀 Installation

### Prerequisites
*   **Node.js**: v18 or higher.
*   **Solana Keypair**: The private key of the Kora Operator (Fee Payer).
*   **RPC URL**: A consistent RPC connection (Helius, QuickNode, or specialized).

### Setup Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/superteam-ng/kora-rent-bot
    cd kora-rent-bot/kora-rent-bot
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Initialize Environment**
    ```bash
    cp .env.example .env
    ```

---

## ⚙️ Configuration

Open `.env` and configure your operator settings.

### 1. RPC Connection
```env
RPC_URL=https://api.mainnet-beta.solana.com
```

### 2. Operator Identity
We support **two formats** for private keys to make life easier:
*   **Option A: JSON Array (Developers)** - Standard `id.json` format.
    ```env
    OPERATOR_KEYPAIR=[111, 222, 33, ...]
    ```
*   **Option B: Base58 String (Wallets)** - Exported from Phantom/Solflare.
    ```env
    OPERATOR_KEYPAIR=5MMw9Ge...
    ```

### 3. Safety Settings
```env
# Minimum age (in days) before an account is touched.
MIN_AGE_DAYS=30

# Telegram Alerts (Optional)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=987654321
```

### 4. Scheduler (Cron)
```env
# How often to check for new accounts? (Default: Hourly)
CRON_SCHEDULE_MONITOR="0 * * * *"

# How often to execute reclamation? (Default: Daily at Midnight)
CRON_SCHEDULE_RECLAIM="0 0 * * *"
```

---

## 📖 Usage Guide (CLI)

The bot exposes granular commands via `npm run`.

### 1. Monitoring
Scans the blockchain for new accounts created by your Operator.
```bash
npm run monitor
# Output: Found 12 new Sponsored Accounts. Added to DB.
```

### 2. Analysis
Checks the on-chain state (Balance, Age) of all tracked accounts.
```bash
npm run analyze
# Output: Account ABC... is now Empty and > 30 days old. Marked Reclaimable.
```

### 3. Reclamation
**Simulate (Safe Mode):**
```bash
npm run reclaim -- --dry-run
# Output: [DRY RUN] Would simulate reclaim for ABC... (Amount: 0.002 SOL)
```

**Execute (Real Money):**
```bash
npm run reclaim
# Output: Successfully reclaimed 0.002 SOL from ABC... Tx: 5Kf...
```

### 4. Wallet Check
```bash
npm run balance
# Output: Operator Balance: 145.20 SOL
```

---

## 🤖 Telegram Ops

The Telegram bot runs as a **Daemon Process**, handling the scheduling automatically.

### Starting the Daemon
```bash
npm run bot
```

### Commands
| Command | Description |
| :--- | :--- |
| `/start` | Verifies bot is active and listening. |
| `/status` | Shows live stats: **Total Tracked**, **Active**, **Reclaimed**. |
| `/scan` | Triggers an immediate customized history scan. |
| `/reclaim` | Manually triggers the reclamation batch process. |

> **Note:** The bot protects itself by only responding to the `TELEGRAM_CHAT_ID` defined in your configuration.

---

## 📊 Web Dashboard

A visual interface for your treasury manager.

### Launching the Server
```bash
npm run serve
# Server listening on port 3000...
```

### Endpoints
*   `GET /api/stats` - High-level metrics (ROI, Total Counts).
*   `GET /api/accounts` - List of currently tracked accounts and their status.
*   `GET /api/logs` - Full audit history of reclamation events.

---

## 🏭 Production Deployment (Daemon/PM2)

For a 24/7 server environment, we recommend using **PM2** to manage the process.

### 1. Install PM2
```bash
npm install -g pm2
```

### 2. Start the Bot Daemon
```bash
# Compile TypeScript first
npm run build

# Start the bot process
pm2 start dist/cli.js --name "kora-bot" -- bot
```

### 3. Start the API Server (Optional)
```bash
pm2 start dist/server.js --name "kora-api"
```
*   **Custom Port:** Set `PORT=4000` in `.env` if 3000 is occupied.

### 4. Save Configuration
```bash
pm2 save
pm2 startup
```

---

## 🔒 Safety & Security

We prioritize fund safety above all else.

### 1. The 30-Day "Grace Period"
Hardcoded logic prevents the bot from touching any account created less than **30 Days** ago (configurable via `MIN_AGE_DAYS`). This ensures active user sessions are never disrupted.

### 2. The "Zero Balance" Invariant
Before signing any close transaction, the bot performs an on-chain Atomic Check:
*   **Token Accounts:** Must have `amount == 0`.
*   **Seed Accounts:** Must have no data and `lamports <= rent_exemption + 10000` (Safety buffer for dust).

### 3. The Whitelist (VIPs)
You can permanently protect critical infrastructure accounts by adding them to `whitelist.json` in the project root:
```json
[
  "VtxTzyhrhAaBvJftTrcWjYWoU7Ps9reTxHSXYksnZq7",
  "YourColdWalletAddress..."
]
```
The `analyze` process will automatically mark these as `WHITELISTED` in the database.

---

## 🏗 Architecture & Data Flow

```mermaid
graph TD
    RPC[Solana RPC]
    Op[Operator Keypair]
    
    subgraph Kora Bot Core
        Mon[Monitor Service]
        An[Analyzer Service]
        Rec[Reclaimer Service]
        DB[(SQLite DB)]
    end
    
    RPC -->|Fetch History| Mon
    Mon -->|New Accounts| DB
    
    DB -->|Active Accounts| An
    RPC -->|GetAccountInfo| An
    An -->|Update Status (Active/Empty)| DB
    
    DB -->|Reclaimable Accounts| Rec
    Rec -->|1. Safety Check| RPC
    Rec -->|2. Sign Tx| Op
    Rec -->|3. Submit Close| RPC
    
    RPC -->|Rent Refund| Op
    Rec -->|Log Event| DB
```

**Components:**
1.  **Monitor (`monitor.ts`):** The "Eyes". Scans history.
2.  **Analyzer (`analyzer.ts`):** The "Brain". Decides eligibility based on logic.
3.  **Reclaimer (`reclaim.ts`):** The "Hands". Executes the closure.

---

## 📚 API Reference

**Local Database (`kora_bot.db`) Schema:**

| Column | Type | Description |
| :--- | :--- | :--- |
| `address` | TEXT | The on-chain address of the sponsored account. |
| `type` | TEXT | `wSOL`, `Seed`, or `ATA`. |
| `status` | TEXT | `Active`, `Reclaimable`, `Reclaimed`. |
| `rent_amount`| INTEGER| Lamports held in the account. |
| `last_activity`| INTEGER| Timestamp of last balance change. |
| `created_at` | INTEGER| Timestamp of discovery. |
| `whitelisted`| BOOLEAN| 1 if protected, 0 otherwise. |

---

## 🤝 Contributing

We welcome contributions from the Kora community!

1.  **Fork** the repository.
2.  **Create** your feature branch (`git checkout -b feature/AmazingFeature`).
3.  **Commit** your changes (`git commit -m 'Add some AmazingFeature'`).
4.  **Push** to the branch (`git push origin feature/AmazingFeature`).
5.  **Open** a Pull Request.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with ❤️ by Superteam Nigeria.*
