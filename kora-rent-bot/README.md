# Kora Rent Reclaim Bot

An automated tool to monitor and safely reclaim rent from Kora-sponsored accounts.

## Features
- **Monitor:** Scans the Kora Fee Payer's transaction history to identify "Operator-Controlled" accounts (Seed-derived and transient wSOL).
- **Analyze:** Tracks the status of these accounts to detect when they become inactive or empty.
- **Reclaim:** Safely executes reclamation transactions to return locked rent SOL to the Operator *only* when authorized.

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your details.
   ```bash
   cp .env.example .env
   ```
   - `RPC_URL`: Your Solana RPC endpoint.
   - `OPERATOR_KEYPAIR`: The JSON array of your Kora Operator's fee payer secret key.

3. **Build:**
   ```bash
   npm run build # Or npx tsc
   ```

## Usage

The bot provides three main commands:

### 1. Monitor
Scans the blockchain for new sponsored accounts.
```bash
npx ts-node src/cli.ts monitor --limit 1000
```

### 2. Analyze
Checks the current status of known sponsored accounts in the local database.
```bash
npx ts-node src/cli.ts analyze
```

### 3. Reclaim
Attempts to reclaim rent from accounts marked as 'Reclaimable'.
```bash
npx ts-node src/cli.ts reclaim
```

## Structure
- `src/monitor.ts`: Scans history for `CreateAccountWithSeed` and Token creations.
- `src/analyzer.ts`: Verifies account balances and data.
- `src/reclaim.ts`: Constructs and signs termination transactions.
- `kora_bot.db`: SQLite database storing account state.

## Safety Mechanisms
- **Strict Authority Check:** Only attempts to close accounts where the Operator is the explicitly defined `close_authority` or `base` signer.
- **Balance Verification:** Checks that accounts are empty (or effectively empty) before reclamation.
