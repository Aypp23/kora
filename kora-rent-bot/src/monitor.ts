import { Connection, PublicKey, type ParsedTransactionWithMeta, SystemProgram } from '@solana/web3.js';
import { Database } from 'sqlite';
import type { SponsoredAccount } from './db/schema.js';
import chalk from 'chalk';

export class Monitor {
    connection: Connection;
    db: Database;
    feePayer: PublicKey;

    constructor(connection: Connection, db: Database, feePayerArg: string) {
        this.connection = connection;
        this.db = db;
        this.feePayer = new PublicKey(feePayerArg);
    }

    async scanHistory(limit: number = 100) {
        console.log(chalk.blue(`Scanning history for ${this.feePayer.toBase58()}...`));
        const signatures = await this.connection.getSignaturesForAddress(this.feePayer, { limit });

        console.log(chalk.green(`Found ${signatures.length} transactions.`));

        for (const sigInfo of signatures) {
            if (sigInfo.err) continue;

            const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
                maxSupportedTransactionVersion: 0
            });

            if (!tx) continue;

            await this.processTransaction(tx, sigInfo.signature);
        }
    }

    async processTransaction(tx: ParsedTransactionWithMeta, signature: string) {
        if (!tx.transaction.message.instructions) return;

        for (const ix of tx.transaction.message.instructions as any[]) {
            // 1. Check for System Program instructions (Seed / Standard Creation)
            if (ix.program === 'system') {
                if (ix.parsed.type === 'createAccountWithSeed') {
                    await this.handleSeedAccount(ix.parsed.info, signature, tx.blockTime);
                } else if (ix.parsed.type === 'createAccount') {
                    await this.handleStandardAccount(ix.parsed.info, signature, tx);
                }
            }

            // 2. Check for "Right to Reclaim" directly (SetAuthority)
            // This catches cases where account creation is internal (CPI) or separate, 
            // but the SetAuthority is top-level (Atomic Delegation).
            else if ((ix.program === 'spl-token' || ix.program === 'spl-token-2022') && ix.parsed.type === 'setAuthority') {
                await this.handleSetAuthority(ix.parsed.info, signature, tx);
            }
        }
    }

    async handleSeedAccount(info: any, signature: string, timestamp?: number | null) {
        // info: { base, seed, newAccount, lamports, space, owner }
        if (info.base === this.feePayer.toBase58()) {
            console.log(chalk.yellow(`Found Operator-Derived Account: ${info.newAccount} (Seed: ${info.seed})`));
            await this.insertAccount(info.newAccount, 'Seed', info.seed, info.base, info.lamports, timestamp);
        }
    }

    async handleStandardAccount(info: any, signature: string, tx: ParsedTransactionWithMeta) {
        const instructions = tx.transaction.message.instructions as any[];

        // Check for basic Token Initialization ONLY here
        const initIx = instructions.find(ix =>
            (ix.program === 'spl-token' || ix.program === 'spl-token-2022') &&
            (ix.parsed.type === 'initializeAccount' || ix.parsed.type === 'initializeAccount3') &&
            ix.parsed.info.account === info.newAccount
        );

        if (initIx && initIx.parsed.info.owner === this.feePayer.toBase58()) {
            console.log(chalk.cyan(`Found Operator-Owned Token Account: ${info.newAccount}`));
            const type = initIx.parsed.info.mint === 'So11111111111111111111111111111111111111112' ? 'wSOL' : 'ATA';
            await this.insertAccount(info.newAccount, type, null, this.feePayer.toBase58(), info.lamports, tx.blockTime);
        }
    }

    async handleSetAuthority(info: any, signature: string, tx: ParsedTransactionWithMeta) {
        // info: { account, authority, authorityType, newAuthority }
        if (
            (info.authorityType === 'closeAccount' || info.authorityType === 'CloseAccount') &&
            info.newAuthority === this.feePayer.toBase58()
        ) {
            console.log(chalk.magenta(`Found Delegated 'Right to Reclaim' Account: ${info.account}`));
            // We don't know the rent amount easily without looking up the account, 
            // but we can default to 0 and let Analyzer fix it, or assume standard rent if needed.
            // Using 0 ensures we don't block DB insert. Analyzer will fetch real balance.
            await this.insertAccount(info.account, 'ATA', null, this.feePayer.toBase58(), 0, tx.blockTime);
        }
    }

    async insertAccount(address: string, type: string, seed: string | null, closeAuthority: string, rentAmount: number, blockTime?: number | null) {
        const createdAt = blockTime ? blockTime * 1000 : Date.now();
        await this.db.run(`
            INSERT OR IGNORE INTO sponsored_accounts (address, type, seed, close_authority, status, rent_amount, last_checked, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            address,
            type,
            seed,
            closeAuthority,
            'Active',
            rentAmount,
            Date.now(),
            createdAt
        ]);
    }
}
