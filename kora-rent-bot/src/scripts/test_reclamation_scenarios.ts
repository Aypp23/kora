import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    PublicKey,
    LAMPORTS_PER_SOL,
    TransactionInstruction
} from '@solana/web3.js';
import {
    createInitializeAccountInstruction,
    createSetAuthorityInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    AuthorityType,
    TOKEN_PROGRAM_ID,
    NATIVE_MINT
} from '@solana/spl-token';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

dotenv.config();

// Helpers
const LOG = (msg: string) => console.log(chalk.blue(`[TEST] ${msg}`));
const SUCCESS = (msg: string) => console.log(chalk.green(`[TEST] ${msg}`));
const ERROR = (msg: string) => console.error(chalk.red(`[TEST] Error: ${msg}`));

async function main() {
    // ---------------------------------------------------------
    // 1. Setup
    // ---------------------------------------------------------
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

    LOG(`Operator: ${operator.publicKey.toBase58()}`);
    const balance = await connection.getBalance(operator.publicKey);
    LOG(`Operator Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.05 * LAMPORTS_PER_SOL) {
        ERROR('Insufficient balance! Need ~0.05 SOL for tests.');
        return;
    }

    // ---------------------------------------------------------
    // 2. Scenario A: Seed Account (Kora Native) - "Reclaimable"
    // ---------------------------------------------------------
    LOG('--- Scenario A: Seed Account ---');
    const seed = `test-seed-${Math.floor(Math.random() * 100000)}`;
    const derivedPubkey = await PublicKey.createWithSeed(operator.publicKey, seed, SystemProgram.programId);

    // Check if exists first
    const existingSeed = await connection.getAccountInfo(derivedPubkey);
    if (!existingSeed) {
        const createSeedIx = SystemProgram.createAccountWithSeed({
            fromPubkey: operator.publicKey,
            newAccountPubkey: derivedPubkey,
            basePubkey: operator.publicKey,
            seed: seed,
            lamports: await connection.getMinimumBalanceForRentExemption(0),
            space: 0,
            programId: SystemProgram.programId
        });
        await sendAndConfirmTransaction(connection, new Transaction().add(createSeedIx), [operator]);
        SUCCESS(`Created Seed Account: ${derivedPubkey.toBase58()}`);
    } else {
        LOG(`Seed Account already exists: ${derivedPubkey.toBase58()}`);
    }


    // ---------------------------------------------------------
    // 3. Scenario B: Transient wSOL Account - "Reclaimable"
    // ---------------------------------------------------------
    LOG('--- Scenario B: Transient wSOL ---');
    const wsolAccount = Keypair.generate();
    const wsolSpace = 165;
    const wsolRent = await connection.getMinimumBalanceForRentExemption(wsolSpace);

    const createWsolIx = SystemProgram.createAccount({
        fromPubkey: operator.publicKey,
        newAccountPubkey: wsolAccount.publicKey,
        lamports: wsolRent,
        space: wsolSpace,
        programId: TOKEN_PROGRAM_ID
    });
    const initWsolIx = createInitializeAccountInstruction(
        wsolAccount.publicKey,
        NATIVE_MINT,
        operator.publicKey
    );
    await sendAndConfirmTransaction(connection, new Transaction().add(createWsolIx, initWsolIx), [operator, wsolAccount]);
    SUCCESS(`Created wSOL Account: ${wsolAccount.publicKey.toBase58()}`);


    // ---------------------------------------------------------
    // 4. Scenario C: "Right to Reclaim" ATA (Atomic Delegation)
    // ---------------------------------------------------------
    LOG('--- Scenario C: Right to Reclaim ATA ---');
    // We need a dummy "User" wallet for this
    const userWallet = Keypair.generate();
    LOG(`Dummy User: ${userWallet.publicKey.toBase58()}`);

    // Create ATA for USDC Devnet (or just Native Mint to keep it simple? Let's use NATIVE_MINT for ease)
    // Actually, usually this is for SPL tokens. Let's use a random Mint or NATIVE_MINT (wSOL ATA).
    // Let's use NATIVE_MINT so we don't need a custom Mint address on devnet.
    const mint = NATIVE_MINT;

    const userAta = getAssociatedTokenAddressSync(mint, userWallet.publicKey);

    // Instruction 1: Create ATA (Operator pays)
    const createAtaIx = createAssociatedTokenAccountInstruction(
        operator.publicKey, // Payer
        userAta,            // ATA Address
        userWallet.publicKey, // Owner
        mint
    );

    // Instruction 2: Atomic Delegation (SetAuthority)
    // User must sign this change.
    const setAuthIx = createSetAuthorityInstruction(
        userAta,
        userWallet.publicKey,    // Current Authority
        AuthorityType.CloseAccount, // Authority to change
        operator.publicKey       // New Authority (Kora)
    );

    // We bundle them. User and Operator sign.
    const tx = new Transaction().add(createAtaIx, setAuthIx);
    await sendAndConfirmTransaction(connection, tx, [operator, userWallet]);

    SUCCESS(`Created 'Right to Reclaim' ATA: ${userAta.toBase58()}`);
    LOG(`(Owner: User, CloseAuthority: Operator)`);

    LOG('--- Setup Complete ---');
    LOG('Now run: npm run monitor -> npm run analyze -> npm run reclaim');
}

main().catch(err => {
    console.error(chalk.red(err));
    process.exit(1);
});
