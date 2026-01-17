import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    PublicKey,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
    createInitializeAccountInstruction,
    TOKEN_PROGRAM_ID,
    NATIVE_MINT
} from '@solana/spl-token';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

dotenv.config();

// Helpers
const LOG = (msg: string) => console.log(chalk.blue(`[BULK-SEED] ${msg}`));
const SUCCESS = (msg: string) => console.log(chalk.green(`[BULK-SEED] ${msg}`));
const ERROR = (msg: string) => console.error(chalk.red(`[BULK-SEED] Error: ${msg}`));

async function main() {
    // 1. Setup Connection & Operator
    const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const secretKeyString = process.env.OPERATOR_KEYPAIR;
    if (!secretKeyString) throw new Error('OPERATOR_KEYPAIR not found in env');

    let secretKey: Uint8Array;
    try {
        const parsed = JSON.parse(secretKeyString);
        secretKey = Uint8Array.from(Array.isArray(parsed) ? parsed : JSON.parse(fs.readFileSync(secretKeyString, 'utf-8')));
    } catch {
        throw new Error('Invalid OPERATOR_KEYPAIR format');
    }
    const operator = Keypair.fromSecretKey(secretKey);

    LOG(`Using Operator: ${operator.publicKey.toBase58()}`);

    const balance = await connection.getBalance(operator.publicKey);
    LOG(`Operator Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
        ERROR('Insufficient balance! Please airdrop more Devnet SOL to the operator (need ~0.05 SOL for 20 accounts).');
        return;
    }

    const rentExemptSeed = await connection.getMinimumBalanceForRentExemption(0);
    const rentExemptToken = await connection.getMinimumBalanceForRentExemption(165);

    const createdAccounts: { address: string, type: string, tx: string }[] = [];

    // 2. Loop to create accounts
    const COUNT = 25; // 25 of each type = 50 total

    LOG(`Starting bulk creation of ${COUNT * 2} accounts...`);

    for (let i = 0; i < COUNT; i++) {
        // --- Create Seed Account ---
        const seed = `bulk-test-${Date.now()}-${i}`;
        const derivedPubkey = await PublicKey.createWithSeed(
            operator.publicKey,
            seed,
            SystemProgram.programId
        );

        const createSeedIx = SystemProgram.createAccountWithSeed({
            fromPubkey: operator.publicKey,
            newAccountPubkey: derivedPubkey,
            basePubkey: operator.publicKey,
            seed: seed,
            lamports: rentExemptSeed,
            space: 0,
            programId: SystemProgram.programId
        });

        try {
            const tx = new Transaction().add(createSeedIx);
            const sig = await sendAndConfirmTransaction(connection, tx, [operator], { skipPreflight: true });
            console.log(chalk.gray(`Created Seed Account ${i + 1}/${COUNT}: ${derivedPubkey.toBase58()}`));
            createdAccounts.push({ address: derivedPubkey.toBase58(), type: 'Seed', tx: sig });
        } catch (e: any) {
            ERROR(`Failed to create seed account ${i}: ${e.message}`);
        }

        // --- Create wSOL Account ---
        const wsolAccount = Keypair.generate();
        const createAccountIx = SystemProgram.createAccount({
            fromPubkey: operator.publicKey,
            newAccountPubkey: wsolAccount.publicKey,
            lamports: rentExemptToken,
            space: 165,
            programId: TOKEN_PROGRAM_ID
        });

        const initTokenIx = createInitializeAccountInstruction(
            wsolAccount.publicKey,
            NATIVE_MINT,
            operator.publicKey
        );

        try {
            const tx = new Transaction().add(createAccountIx, initTokenIx);
            const sig = await sendAndConfirmTransaction(connection, tx, [operator, wsolAccount], { skipPreflight: true });
            console.log(chalk.gray(`Created wSOL Account ${i + 1}/${COUNT}: ${wsolAccount.publicKey.toBase58()}`));
            createdAccounts.push({ address: wsolAccount.publicKey.toBase58(), type: 'wSOL', tx: sig });
        } catch (e: any) {
            ERROR(`Failed to create wSOL account ${i}: ${e.message}`);
        }
    }

    SUCCESS('Bulk seeding complete!');
    console.log('\n--- Summary of Created Accounts ---');
    console.table(createdAccounts);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
