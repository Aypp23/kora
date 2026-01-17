
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { Database } from 'sqlite';
import { initDatabase } from '../db/schema.js';
import { Monitor } from '../monitor.js';
import { Analyzer } from '../analyzer.js';
import { Reclaimer } from '../reclaim.js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

dotenv.config();

// Helpers
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log(chalk.bold.white('🧪 Starting Comprehensive Safety Test...'));

    // 1. Setup Connection & Operator
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const secretKeyString = process.env.OPERATOR_KEYPAIR;
    if (!secretKeyString) throw new Error('OPERATOR_KEYPAIR not found in .env');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const operator = Keypair.fromSecretKey(secretKey);
    console.log(`Operator: ${operator.publicKey.toBase58()}`);

    // 2. Setup DB (Fresh Start for Test)
    const dbPath = 'kora_test.db';
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const db = await initDatabase(dbPath);

    // 3. Instantiate Modules
    const monitor = new Monitor(connection, db, operator.publicKey.toBase58());
    const analyzer = new Analyzer(connection, db);
    const reclaimer = new Reclaimer(connection, db, operator);

    // 4. Create Test Scenarios (Real On-Chain Accounts)
    console.log(chalk.blue('\n--- Creating Test Accounts on Devnet ---'));

    // Case A: "New Account" (Should be saved by Grace Period)
    // We create a Seed Account.
    const seedA = 'safe_new_' + Math.floor(Math.random() * 10000);
    const pubkeyA = await createSeedAccount(connection, operator, seedA, 0.001); // minimal rent
    console.log(`CASE A (Grace Period): ${pubkeyA.toBase58()} (Created Now)`);

    // Case B: "Rick's Account" (Whitelisted)
    // We create a Seed Account, but will whitelist it manually.
    const seedB = 'safe_vip_' + Math.floor(Math.random() * 10000);
    const pubkeyB = await createSeedAccount(connection, operator, seedB, 0.001);
    console.log(`CASE B (Whitelisted): ${pubkeyB.toBase58()}`);

    // Case C: "Forgotten Account" (Target for Reclaim)
    // Should be Old + Empty (Exact Rent).
    const seedC = 'reclaim_me_' + Math.floor(Math.random() * 10000);
    const exactRent = await connection.getMinimumBalanceForRentExemption(0);
    const pubkeyC = await createSeedAccount(connection, operator, seedC, exactRent / LAMPORTS_PER_SOL);
    console.log(`CASE C (To Reclaim): ${pubkeyC.toBase58()}`);

    // Case D: "Rich Account" (Balance Safety)
    // Should be Old + High Balance (> 0).
    const seedD = 'safe_rich_' + Math.floor(Math.random() * 10000);
    const pubkeyD = await createSeedAccount(connection, operator, seedD, 0.05); // 0.05 SOL > 0 rent
    console.log(`CASE D (Balance Safe): ${pubkeyD.toBase58()}`);

    console.log(chalk.yellow('Waiting for confirmation...'));
    await sleep(5000); // Wait for confirmation

    // 5. Ingest into DB
    console.log(chalk.blue('\n--- Running Monitor (Ingestion) ---'));
    await monitor.scanHistory(50); // Scan recently created

    // 6. Manipulate DB State ( Time Travel ⚡️ )
    console.log(chalk.blue('\n--- Manipulating DB State (Simulating Time) ---'));
    const THIRTY_FIVE_DAYS_MS = 35 * 24 * 60 * 60 * 1000;
    const oldTimestamp = Date.now() - THIRTY_FIVE_DAYS_MS;

    // A stays NEW (Default timestamp is correct)

    // B becomes OLD but WHITELISTED
    await db.run('UPDATE sponsored_accounts SET created_at = ?, whitelisted = 1 WHERE address = ?', [oldTimestamp, pubkeyB.toBase58()]);
    console.log(`-> Aged Case B and marked WHITELISTED.`);

    // C becomes OLD (Target)
    await db.run('UPDATE sponsored_accounts SET created_at = ? WHERE address = ?', [oldTimestamp, pubkeyC.toBase58()]);
    console.log(`-> Aged Case C (Should be reclaimable).`);

    // D becomes OLD but RICH
    await db.run('UPDATE sponsored_accounts SET created_at = ? WHERE address = ?', [oldTimestamp, pubkeyD.toBase58()]);
    console.log(`-> Aged Case D (Should be saved by Balance > 0).`);


    // 7. Run Logic
    console.log(chalk.blue('\n--- Running Analyzer ---'));
    await analyzer.updateAccountStatuses();

    console.log(chalk.blue('\n--- Running Reclaimer ---'));
    await reclaimer.reclaimAccounts();

    // 8. Final Verification
    console.log(chalk.blue('\n--- Final Verdict ---'));
    const finalA = await db.get('SELECT status FROM sponsored_accounts WHERE address = ?', [pubkeyA.toBase58()]);
    const finalB = await db.get('SELECT status FROM sponsored_accounts WHERE address = ?', [pubkeyB.toBase58()]);
    const finalC = await db.get('SELECT status FROM sponsored_accounts WHERE address = ?', [pubkeyC.toBase58()]);
    const finalD = await db.get('SELECT status FROM sponsored_accounts WHERE address = ?', [pubkeyD.toBase58()]);

    const logs = await db.all('SELECT * FROM reclamation_logs');

    console.log(`Case A (Grace Period): ${getStatusEmoji(finalA?.status, 'Active')} (${finalA?.status || 'Not Found'})`);
    console.log(`Case B (Whitelisted):  ${getStatusEmoji(finalB?.status, 'Active')} (${finalB?.status || 'Not Found'})`);
    console.log(`Case C (Reclaimed):    ${getStatusEmoji(finalC?.status, 'Reclaimed')} (${finalC?.status || 'Not Found'})`);
    console.log(`Case D (Balance Safe): ${getStatusEmoji(finalD?.status, 'Active')} (${finalD?.status || 'Not Found'})`);

    console.log(`\nAudit Logs Generated: ${logs.length}`);
    if (logs.length > 0) {
        console.log(`Last Log Reason: ${logs[0].reason}`);
        console.log(`Last Log Tx: ${logs[0].tx_signature}`);
    }

}

function getStatusEmoji(status: string, expected: string) {
    return status === expected ? '✅ PASS' : '❌ FAIL';
}

async function createSeedAccount(connection: Connection, payer: Keypair, seed: string, amountSol: number): Promise<PublicKey> {
    const newPubkey = await PublicKey.createWithSeed(payer.publicKey, seed, SystemProgram.programId);
    const lamports = amountSol * LAMPORTS_PER_SOL;

    // Check if exists
    const info = await connection.getAccountInfo(newPubkey);
    if (info) return newPubkey;

    const tx = new Transaction().add(
        SystemProgram.createAccountWithSeed({
            fromPubkey: payer.publicKey,
            basePubkey: payer.publicKey,
            seed: seed,
            newAccountPubkey: newPubkey,
            lamports: lamports,
            space: 0,
            programId: SystemProgram.programId,
        })
    );

    await connection.sendTransaction(tx, [payer], { skipPreflight: false });
    return newPubkey;
}

main().catch(console.error);
