import { Connection, PublicKey } from '@solana/web3.js';
import { Database } from 'sqlite';
import type { SponsoredAccount } from './db/schema.js';
import chalk from 'chalk';

export class Analyzer {
    connection: Connection;
    db: Database;

    constructor(connection: Connection, db: Database) {
        this.connection = connection;
        this.db = db;
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
            // If the on-chain balance differs from our DB balance, activity occurred.
            // Note: rent_amount in DB tracks the last known balance.
            if (info.lamports !== account.rent_amount) {
                console.log(chalk.green(`🔔 Activity detected on ${account.address}: Balance changed from ${account.rent_amount} to ${info.lamports} lamports.`));

                // Update DB with new balance and activity timestamp
                await this.db.run(`
                    UPDATE sponsored_accounts
                    SET rent_amount = ?, last_activity = ?
                    WHERE address = ?
                `, [info.lamports, Date.now(), account.address]);

                // Update local object for subsequent logic
                account.rent_amount = info.lamports;
            }

            // SAFETY CHECK: Grace Period (30 Days)
            // If the account is younger than 30 days, do NOT touch it.
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            if (account.created_at && (now - account.created_at < THIRTY_DAYS_MS)) {
                console.log(chalk.blue(`⏳ Account ${account.address} is in Grace Period (${Math.floor((now - account.created_at) / (1000 * 60 * 60 * 24))} days old). Skipping.`));
                continue;
            }

            // Logic to determine if Reclaimable
            let isReclaimable = false;

            if (account.type === 'wSOL') {
                try {
                    const balance = await this.connection.getTokenAccountBalance(pubkey);
                    // If 0 tokens, it's an empty wrapper.
                    // Safety Threshold: STRICT (0 SOL)
                    // We only reclaim if the account is purely rent (no user funds).
                    if (balance.value.uiAmount === 0 || balance.value.amount === '0') {
                        isReclaimable = true;
                    }
                } catch (e) {
                    // Likely invalid token account or other issue
                    console.log(chalk.red(`Error checking balance for ${account.address}:`), e);
                }
            } else if (account.type === 'Seed') {
                // For System Accounts, "Empty" means they ONLY hold the Rent Exemption amount.
                // If they hold MORE than rent, it's user funds.

                // Get exact rent for 0-byte account
                const minRent = await this.connection.getMinimumBalanceForRentExemption(0);

                // Safety: If balance > minRent (plus tiny dust tolerance), SKIP.
                // Using 0.00001 (10000 lamports) as dust tolerance.
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
