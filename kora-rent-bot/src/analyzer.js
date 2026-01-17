import { PublicKey } from '@solana/web3.js';
import chalk from 'chalk';
export class Analyzer {
    connection;
    db;
    constructor(connection, db) {
        this.connection = connection;
        this.db = db;
    }
    async updateAccountStatuses() {
        console.log(chalk.blue('Updating account statuses...'));
        const accounts = await this.db.all('SELECT * FROM sponsored_accounts WHERE status = ?', ['Active']);
        for (const account of accounts) {
            const pubkey = new PublicKey(account.address);
            const info = await this.connection.getAccountInfo(pubkey);
            if (!info) {
                // Account doesn't exist anymore
                console.log(chalk.gray(`Account ${account.address} is closed (not found). Marking as Reclaimed.`));
                await this.db.run('UPDATE sponsored_accounts SET status = ?, rent_amount = 0 WHERE address = ?', ['Reclaimed', account.address]);
                continue;
            }
            // Logic to determine if Reclaimable
            let isReclaimable = false;
            if (account.type === 'wSOL') {
                try {
                    const balance = await this.connection.getTokenAccountBalance(pubkey);
                    // If 0 tokens, it's an empty wrapper.
                    if (balance.value.uiAmount === 0 || balance.value.amount === '0') {
                        isReclaimable = true;
                    }
                }
                catch (e) {
                    // Likely invalid token account or other issue
                    console.log(chalk.red(`Error checking balance for ${account.address}:`), e);
                }
            }
            else if (account.type === 'Seed') {
                // If data length is 0, it's just holding SOL (maybe a buffer account).
                if (info.data.length === 0) {
                    isReclaimable = true;
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
//# sourceMappingURL=analyzer.js.map