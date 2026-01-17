import { Command } from 'commander';
import { Connection, Keypair } from '@solana/web3.js';
import { Monitor } from './monitor.js';
import { Analyzer } from './analyzer.js';
import { Reclaimer } from './reclaim.js';
import { initDatabase } from './db/schema.js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
dotenv.config();
const program = new Command();
program
    .name('kora-bot')
    .description('Kora Rent Reclaim Bot')
    .version('1.0.0');
// Shared helpers
async function getContext() {
    const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const db = await initDatabase();
    // Load Operator Keypair
    const secretKeyString = process.env.OPERATOR_KEYPAIR;
    if (!secretKeyString) {
        // Fallback or error
        // For CLI testing without keypair validation (e.g. analyze/monitor might not need secret key strictly? Monitor needs pubkey)
        // But Monitor constructor takes string pubkey.
        // We throw here for safety.
        throw new Error('OPERATOR_KEYPAIR not found in env (expecting JSON array of secret key)');
    }
    let secretKey;
    try {
        const parsedContext = JSON.parse(secretKeyString);
        if (Array.isArray(parsedContext)) {
            secretKey = Uint8Array.from(parsedContext);
        }
        else {
            throw new Error('Not an array');
        }
    }
    catch (e) {
        // Maybe it's a file path?
        if (fs.existsSync(secretKeyString)) {
            const fileContent = fs.readFileSync(secretKeyString, 'utf-8');
            secretKey = Uint8Array.from(JSON.parse(fileContent));
        }
        else {
            throw new Error('Invalid OPERATOR_KEYPAIR format');
        }
    }
    const operatorKeypair = Keypair.fromSecretKey(secretKey);
    return { connection, db, operatorKeypair };
}
program.command('monitor')
    .description('Scan Fee Payer history and identify sponsored accounts')
    .option('-l, --limit <number>', 'Number of transactions to scan', '100')
    .action(async (options) => {
    try {
        const { connection, db, operatorKeypair } = await getContext();
        const monitor = new Monitor(connection, db, operatorKeypair.publicKey.toBase58());
        await monitor.scanHistory(parseInt(options.limit));
    }
    catch (e) {
        console.error(chalk.red('Error:'), e.message);
        process.exit(1);
    }
});
program.command('analyze')
    .description('Check status of sponsored accounts')
    .action(async () => {
    try {
        const { connection, db } = await getContext();
        const analyzer = new Analyzer(connection, db);
        await analyzer.updateAccountStatuses();
    }
    catch (e) {
        console.error(chalk.red('Error:'), e.message);
        process.exit(1);
    }
});
program.command('reclaim')
    .description('Reclaim rent from eligible accounts')
    .action(async () => {
    try {
        const { connection, db, operatorKeypair } = await getContext();
        const reclaimer = new Reclaimer(connection, db, operatorKeypair);
        await reclaimer.reclaimAccounts();
    }
    catch (e) {
        console.error(chalk.red('Error:'), e.message);
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map