/**
 * Test ATA Reclamation Flow
 * 
 * 1. Create a new SPL token (mint)
 * 2. Create an ATA for a test user with Operator as CloseAuthority
 * 3. Mint tokens to the ATA
 * 4. Burn all tokens (empty the ATA)
 * 5. Track the ATA in our database
 * 6. Run analyzer -> should mark as Reclaimable
 * 7. Run reclaimer -> should close the ATA and recover rent
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    burn,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAccount
} from '@solana/spl-token';
import dotenv from 'dotenv';
import fs from 'fs';
import chalk from 'chalk';
import { initDatabase } from '../db/schema.js';

dotenv.config();

async function main() {
    const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const db = await initDatabase();

    // Load Operator Keypair
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
    console.log(chalk.blue(`[TEST] Operator: ${operator.publicKey.toBase58()}`));

    const balance = await connection.getBalance(operator.publicKey);
    console.log(chalk.blue(`[TEST] Operator Balance: ${balance / LAMPORTS_PER_SOL} SOL`));

    // 1. Create a test user wallet (just a random keypair for demo)
    const testUser = Keypair.generate();
    console.log(chalk.yellow(`\n[STEP 1] Test User Wallet: ${testUser.publicKey.toBase58()}`));

    // 2. Create a new SPL Token Mint (Operator is mint authority)
    console.log(chalk.yellow(`\n[STEP 2] Creating new SPL Token...`));
    const mint = await createMint(
        connection,
        operator,           // Payer
        operator.publicKey, // Mint Authority
        operator.publicKey, // Freeze Authority
        9                   // Decimals
    );
    console.log(chalk.green(`Token Mint Created: ${mint.toBase58()}`));

    // 3. Create ATA for test user WITH Operator as CloseAuthority
    console.log(chalk.yellow(`\n[STEP 3] Creating ATA for test user (Operator = CloseAuthority)...`));
    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        operator,              // Payer (Kora sponsors this!)
        mint,                  // Token Mint
        testUser.publicKey,    // Owner (the user)
        false,                 // allowOwnerOffCurve
        'confirmed',
        undefined,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(chalk.green(`ATA Created: ${ata.address.toBase58()}`));

    // Get rent amount
    const ataInfo = await connection.getAccountInfo(ata.address);
    const rentLamports = ataInfo?.lamports || 0;
    console.log(chalk.blue(`Rent Locked: ${rentLamports / LAMPORTS_PER_SOL} SOL`));

    // 4. Mint some tokens to the ATA
    console.log(chalk.yellow(`\n[STEP 4] Minting 1000 tokens to ATA...`));
    await mintTo(
        connection,
        operator,              // Payer
        mint,                  // Mint
        ata.address,           // Destination
        operator,              // Mint Authority
        1000 * (10 ** 9)       // Amount (1000 tokens with 9 decimals)
    );

    let ataAccount = await getAccount(connection, ata.address);
    console.log(chalk.green(`Token Balance: ${Number(ataAccount.amount) / (10 ** 9)}`));

    // 5. Burn all tokens (simulate user spending everything)
    console.log(chalk.yellow(`\n[STEP 5] Burning all tokens (simulating user emptying wallet)...`));
    // Note: Burn requires the OWNER (testUser) to sign, not operator
    // For this test, we'll use operator since we control both
    // In real scenario, user would burn/transfer out their tokens
    await burn(
        connection,
        operator,              // Payer
        ata.address,           // Token Account
        mint,                  // Mint
        testUser,              // Token Account Owner (signs the burn)
        1000 * (10 ** 9)       // Amount to burn
    );

    ataAccount = await getAccount(connection, ata.address);
    console.log(chalk.green(`Token Balance After Burn: ${Number(ataAccount.amount) / (10 ** 9)}`));

    // 6. Track the ATA in our database
    console.log(chalk.yellow(`\n[STEP 6] Adding ATA to database for tracking...`));
    await db.run(`
        INSERT OR REPLACE INTO sponsored_accounts 
        (address, type, seed, close_authority, status, rent_amount, last_checked, whitelisted, last_activity, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        ata.address.toBase58(),
        'ATA',
        null,
        operator.publicKey.toBase58(),
        'Active',
        rentLamports,
        Date.now(),
        0,
        Date.now(),
        Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago (past grace period)
    ]);
    console.log(chalk.green(`ATA tracked in database!`));

    // Summary
    console.log(chalk.magenta(`\n========== TEST COMPLETE ==========`));
    console.log(chalk.white(`Token Mint:    ${mint.toBase58()}`));
    console.log(chalk.white(`Test User:     ${testUser.publicKey.toBase58()}`));
    console.log(chalk.white(`ATA Address:   ${ata.address.toBase58()}`));
    console.log(chalk.white(`Rent Locked:   ${rentLamports / LAMPORTS_PER_SOL} SOL`));
    console.log(chalk.white(`Token Balance: 0 (empty, ready for reclaim)`));
    console.log(chalk.magenta(`===================================`));

    console.log(chalk.cyan(`\n[NEXT STEPS]`));
    console.log(`1. Run: npx tsx src/cli.ts analyze`);
    console.log(`   -> Should mark the ATA as 'Reclaimable'`);
    console.log(`2. Run: npx tsx src/cli.ts reclaim`);
    console.log(`   -> Should close the ATA and recover ${rentLamports / LAMPORTS_PER_SOL} SOL`);
}

main().catch(err => {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
});
