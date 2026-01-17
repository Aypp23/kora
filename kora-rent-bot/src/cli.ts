import { Command } from 'commander';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Monitor } from './monitor.js';
import { Analyzer } from './analyzer.js';
import { Reclaimer } from './reclaim.js';
import { BotService } from './bot.js';
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

    let secretKey: Uint8Array;
    try {
        const parsedContext = JSON.parse(secretKeyString);
        if (Array.isArray(parsedContext)) {
            secretKey = Uint8Array.from(parsedContext);
        } else {
            throw new Error('Not an array');
        }
    } catch (e) {
        // Maybe it's a file path?
        if (fs.existsSync(secretKeyString)) {
            const fileContent = fs.readFileSync(secretKeyString, 'utf-8');
            secretKey = Uint8Array.from(JSON.parse(fileContent));
        } else {
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
        } catch (e: any) {
            console.error(chalk.red('Error:'), e.message);
            process.exit(1);
        }
    });

program.command('analyze')
    .description('Check status of sponsored accounts')
    .action(async () => {
        try {
            const { connection, db, operatorKeypair } = await getContext();
            const analyzer = new Analyzer(connection, db, operatorKeypair.publicKey);
            await analyzer.updateAccountStatuses();
        } catch (e: any) {
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
        } catch (e: any) {
            console.error(chalk.red('Error:'), e.message);
            process.exit(1);
        }
    });

program
    .command('bot')
    .description('Start the Telegram Bot in daemon mode')
    .action(async () => {
        try {
            const { connection, operatorKeypair } = await getContext();
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;

            if (!token || !chatId) {
                console.error(chalk.red('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required in .env'));
                process.exit(1);
            }

            console.log(chalk.blue('Starting Telegram Bot...'));
            const bot = new BotService(
                token,
                chatId,
                connection,
                await initDatabase(), // Initialize DB for the bot
                operatorKeypair
            );
            bot.launch();
        } catch (e: any) {
            console.error(chalk.red('Error:'), e.message);
            process.exit(1);
        }
    });

program
    .command('balance')
    .description('Check operator wallet balance')
    .action(async () => {
        try {
            const { connection, operatorKeypair } = await getContext();
            const balance = await connection.getBalance(operatorKeypair.publicKey);
            console.log(chalk.bold(`Operator: ${operatorKeypair.publicKey.toBase58()}`));
            console.log(chalk.green(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`));
        } catch (e: any) {
            console.error(chalk.red('Failed to check balance:'), e.message);
        }
    });

program
    .command('serve')
    .description('Start the Dashboard API Server')
    .action(async () => {
        try {
            console.log(chalk.blue('Starting API Server...'));
            await import('./server.js');
        } catch (e: any) {
            console.error(chalk.red('Failed to start server:'), e.message);
        }
    });

program.parse(process.argv);
