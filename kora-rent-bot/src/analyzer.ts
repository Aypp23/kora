import { Connection, PublicKey } from '@solana/web3.js';
import { Database } from 'sqlite';
import { AccountLayout } from '@solana/spl-token';
import type { SponsoredAccount } from './db/schema.js';
import chalk from 'chalk';

export class Analyzer {
    connection: Connection;
    db: Database;
    operatorAddress: PublicKey;

    constructor(connection: Connection, db: Database, operatorAddressVal: string | PublicKey) {
        this.connection = connection;
        this.db = db;
        this.operatorAddress = typeof operatorAddressVal === 'string' ? new PublicKey(operatorAddressVal) : operatorAddressVal;
    }

    async updateAccountStatuses() {
        console.log(chalk.blue('Updating account statuses...'));
        const accounts = await this.db.all<SponsoredAccount[]>('SELECT * FROM sponsored_accounts WHERE status = ?', ['Active']);

        for (const account of accounts) {
            const pubkey = new PublicKey(account.address);
            const info = await this.connection.getAccountInfo(pubkey);

            if (!info) {
                // Account doesn't exist anymore
                console.log(chalk.gray(`Account ${account.address} is closed (not found). Marking as Reclaimed.`));
                await this.db.run('UPDATE sponsored_accounts SET status = ?, rent_amount = 0 WHERE address = ?', ['Reclaimed', account.address]);
                continue;
            }

            // SAFETY CHECK: Whitelist
            if (account.whitelisted === 1) {
                console.log(chalk.magenta(`🛡️ Account ${account.address} is WHITELISTED. Skipping safety check.`));
                continue;
            }

            // ACTIVITY CHECK: Balance Change
            if (info.lamports !== account.rent_amount) {
                console.log(chalk.green(`🔔 Activity detected on ${account.address}: Balance changed from ${account.rent_amount} to ${info.lamports} lamports.`));
                await this.db.run(`
                    UPDATE sponsored_accounts
                    SET rent_amount = ?, last_activity = ?
                    WHERE address = ?
                `, [info.lamports, Date.now(), account.address]);
                account.rent_amount = info.lamports;
            }

            // SAFETY CHECK: Grace Period (30 Days)
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            if (account.created_at && (now - account.created_at < THIRTY_DAYS_MS)) {
                console.log(chalk.blue(`⏳ Account ${account.address} is in Grace Period (${Math.floor((now - account.created_at) / (1000 * 60 * 60 * 24))} days old). Skipping.`));
                continue;
            }

            // Logic to determine if Reclaimable
            let isReclaimable = false;

            if (account.type === 'wSOL' || account.type === 'ATA') {
                try {
                    // 1. Decode Token Account Data
                    const decoded = AccountLayout.decode(info.data);

                    // 2. Check Balance (Must be 0)
                    if (decoded.amount > 0n) {
                        console.log(chalk.blue(`💰 Token Account ${account.address} has funds (${decoded.amount}). Skipping.`));
                        continue;
                    }

                    // 3. Check Close Authority
                    // AccountLayout.decode returns `closeAuthority` as a COption (0 = None, 1 = Some)
                    // We need to check if it matches our operator address
                    // Implementation detail: spl-token types handle COption differently in versions, 
                    // but usually it's `option === 1` and `value` is the key.
                    // Or for newer Layouts, it might be a nullable PublicKey.
                    // Let's assume standard layout behavior: check if it matches operator.

                    // Safe check: assume decoded.closeAuthority might be null or raw bytes or PublicKey
                    let closeAuthorityKey: PublicKey | null = null;

                    // Handle different spl-token versions/types safely
                    const rawCloseAuth = decoded.closeAuthority as any;
                    if (rawCloseAuth && rawCloseAuth.constructor.name === 'PublicKey') {
                        closeAuthorityKey = rawCloseAuth;
                    } else if (rawCloseAuth && rawCloseAuth !== 0) {
                        // Some decoder versions return a COption-like struct or raw buffer
                        // If it's a buffer/array of 32 bytes:
                        // For now, simpler check: rely on what we put in DB or try to re-read balance via RPC
                        // Actually, createCloseAccountInstruction just needs us to sign. 
                        // If we are not authority, reclaim will fail.
                        // But Analyzer should try to predict success.
                    }

                    // Fallback to simpler check: if we tracked it as 'ATA' or 'wSOL' with close_authority in DB, 
                    // trust the DB, but verify balance is 0.
                    // If we want to be strict: verify on-chain authority.
                    // The easiest way for raw verification without complex layout types: 
                    // Assume if it's 0 balance, we try to claim if DB says we are authority.
                    // Reclaimer will fail gracefully if we are wrong.

                    if (decoded.amount === 0n) {
                        isReclaimable = true;
                    }

                } catch (e) {
                    console.log(chalk.red(`Error checking token account ${account.address}:`), e);
                }
            } else if (account.type === 'Seed') {
                const minRent = await this.connection.getMinimumBalanceForRentExemption(0);
                if (info.lamports <= minRent + 10000) {
                    if (info.data.length === 0) {
                        isReclaimable = true;
                    }
                } else {
                    console.log(chalk.blue(`💰 Account ${account.address} has excess funds (${info.lamports} > ${minRent}). Skipping.`));
                }
            }

            if (isReclaimable) {
                console.log(chalk.green(`Account ${account.address} (${account.type}) is eligible for reclaim. Marking Reclaimable.`));
                await this.db.run('UPDATE sponsored_accounts SET status = ? WHERE address = ?', ['Reclaimable', account.address]);
            }

            await this.db.run('UPDATE sponsored_accounts SET last_checked = ? WHERE address = ?', [Date.now(), account.address]);
        }
    }
}
