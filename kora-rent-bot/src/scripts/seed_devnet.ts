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
const LOG = (msg: string) => console.log(chalk.blue(`[SEED] ${msg}`));
const SUCCESS = (msg: string) => console.log(chalk.green(`[SEED] ${msg}`));
const ERROR = (msg: string) => console.error(chalk.red(`[SEED] Error: ${msg}`));

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

    if (balance < 0.01 * LAMPORTS_PER_SOL) {
        ERROR('Insufficient balance! Please airdrop some Devnet SOL to the operator.');
        return;
    }

    // 2. Create Operator-Derived Seed Account
    const seed = `test-seed-${Math.floor(Math.random() * 10000)}`;
    const derivedPubkey = await PublicKey.createWithSeed(
        operator.publicKey,
        seed,
        SystemProgram.programId
    );

    LOG(`Creating Seed Account: ${derivedPubkey.toBase58()} (Seed: ${seed})`);

    const rentExempt = await connection.getMinimumBalanceForRentExemption(0);

    const createSeedIx = SystemProgram.createAccountWithSeed({
        fromPubkey: operator.publicKey,
        newAccountPubkey: derivedPubkey,
        basePubkey: operator.publicKey,
        seed: seed,
        lamports: rentExempt,
        space: 0,
        programId: SystemProgram.programId
    });

    try {
        const tx = new Transaction().add(createSeedIx);
        const sig = await sendAndConfirmTransaction(connection, tx, [operator]);
        SUCCESS(`Created Seed Account! Tx: ${sig}`);
    } catch (e: any) {
        ERROR(`Failed to create seed account: ${e.message}`);
    }

    // 3. Create Transient wSOL Account (Empty wrapper)
    // We create a new random keypair for the account address (standard pattern for new accounts)
    // But we make the Operator the Owner/CloseAuth.
    // Actually, usually wSOL accounts are ATAs or separate keypairs.
    // Let's make a separate keypair account that is initialized as Mint=Native, Owner=Operator.

    const wsolAccount = Keypair.generate();
    LOG(`Creating wSOL Account: ${wsolAccount.publicKey.toBase58()}`);

    const space = 165; // Token Account size
    const rentExemptToken = await connection.getMinimumBalanceForRentExemption(space);

    const createAccountIx = SystemProgram.createAccount({
        fromPubkey: operator.publicKey,
        newAccountPubkey: wsolAccount.publicKey,
        lamports: rentExemptToken,
        space: space,
        programId: TOKEN_PROGRAM_ID
    });

    const initTokenIx = createInitializeAccountInstruction(
        wsolAccount.publicKey,
        NATIVE_MINT,
        operator.publicKey
    );

    try {
        const tx = new Transaction().add(createAccountIx, initTokenIx);
        const sig = await sendAndConfirmTransaction(connection, tx, [operator, wsolAccount]);
        SUCCESS(`Created Transient wSOL Account! Tx: ${sig}`);
    } catch (e: any) {
        ERROR(`Failed to create wSOL account: ${e.message}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
