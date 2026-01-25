import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, TransactionInstruction } from '@solana/web3.js';
import { Database } from 'sqlite';
import type { SponsoredAccount } from './db/schema.js';
import { createCloseAccountInstruction } from '@solana/spl-token';
import chalk from 'chalk';

import fs from 'fs';

export class Reclaimer {
    connection: Connection;
    db: Database;
    operatorKeypair: Keypair;

    constructor(connection: Connection, db: Database, operatorKeypair: Keypair) {
        this.connection = connection;
        this.db = db;
        this.operatorKeypair = operatorKeypair;
    }

    async reclaimAccounts(dryRun: boolean = false): Promise<number> {
        console.log(chalk.blue(`Starting reclamation process... ${dryRun ? '[DRY RUN]' : ''}`));
        const accounts = await this.db.all<SponsoredAccount[]>('SELECT * FROM sponsored_accounts WHERE status = ?', ['Reclaimable']);

        if (accounts.length === 0) {
            console.log(chalk.green('No reclaimable accounts found.'));
            return 0;
        }

        let count = 0;

        for (const account of accounts) {
            console.log(chalk.yellow(`Attempting to reclaim ${account.address} (${account.type})...`));
            try {
                let txId: string = 'DRY_RUN_TX_ID';

                if (!dryRun) {
                    if (account.type === 'wSOL' || account.type === 'ATA') {
                        txId = await this.reclaimTokenAccount(account);
                    } else if (account.type === 'Seed') {
                        txId = await this.reclaimSeedAccount(account);
                    } else {
                        continue;
                    }
                    console.log(chalk.green(`Reclaim successful! Tx: ${txId}`));
                } else {
                    console.log(chalk.magenta(`[DRY RUN] Would simulate reclaim for ${account.address}`));
                }

                if (!dryRun) {
                    // 1. Update Status
                    await this.db.run('UPDATE sponsored_accounts SET status = ?, rent_amount = 0 WHERE address = ?', ['Reclaimed', account.address]);

                    // 2. Audit Log (DB)
                    await this.db.run(
                        'INSERT INTO reclamation_logs (account_address, amount_lamports, tx_signature, timestamp, reason) VALUES (?, ?, ?, ?, ?)',
                        [account.address, account.rent_amount, txId, Date.now(), 'Automated Reclaim']
                    );
                }

                // 3. Audit Log (File) - Always log dry runs too for visibility, or decide?
                // Let's log Dry Runs as [DRY RUN]
                const logMessage = `[${new Date().toISOString()}] ${dryRun ? '[DRY RUN] ' : ''}RECLAIMED | Address: ${account.address} | Amount: ${account.rent_amount} | Tx: ${txId}\n`;
                fs.appendFileSync('audit.log', logMessage);

                count++;

            } catch (err: any) {
                console.error(chalk.red(`Failed to reclaim ${account.address}:`), err.message);
            }
        }
        return count;
    }

    private createMemoInstruction(reason: string): TransactionInstruction {
        return new TransactionInstruction({
            keys: [{ pubkey: this.operatorKeypair.publicKey, isSigner: true, isWritable: true }],
            programId: new PublicKey("Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"), // Memo v1
            data: Buffer.from(reason, "utf-8"),
        });
    }

    async reclaimTokenAccount(account: SponsoredAccount): Promise<string> {
        const pubkey = new PublicKey(account.address);
        const ix = createCloseAccountInstruction(
            pubkey, // Account
            this.operatorKeypair.publicKey, // Destination
            this.operatorKeypair.publicKey // Authority
        );

        const memoIx = this.createMemoInstruction(`Kora Rent Reclaim: Closing potentially abandoned W-SOL account ${account.address} per cleanup policy.`);
        const tx = new Transaction().add(ix).add(memoIx);
        return await sendAndConfirmTransaction(this.connection, tx, [this.operatorKeypair]);
    }

    async reclaimSeedAccount(account: SponsoredAccount): Promise<string> {
        const balance = await this.connection.getBalance(new PublicKey(account.address));

        // SystemProgram.transfer with seed
        // Only works if the derived address is owned by SystemProgram and was created using this seed/base
        const ix = SystemProgram.transfer({
            fromPubkey: new PublicKey(account.address),
            basePubkey: this.operatorKeypair.publicKey,
            toPubkey: this.operatorKeypair.publicKey,
            lamports: balance,
            seed: account.seed || '',
            programId: SystemProgram.programId
        });

        const memoIx = this.createMemoInstruction(`Kora Rent Reclaim: Recovering seed account rent.`);
        const tx = new Transaction().add(ix).add(memoIx);
        return await sendAndConfirmTransaction(this.connection, tx, [this.operatorKeypair]);
    }
}
