import { PublicKey } from '@solana/web3.js';
import chalk from 'chalk';
export class Monitor {
    connection;
    db;
    feePayer;
    constructor(connection, db, feePayerArg) {
        this.connection = connection;
        this.db = db;
        this.feePayer = new PublicKey(feePayerArg);
    }
    async scanHistory(limit = 100) {
        console.log(chalk.blue(`Scanning history for ${this.feePayer.toBase58()}...`));
        const signatures = await this.connection.getSignaturesForAddress(this.feePayer, { limit });
        console.log(chalk.green(`Found ${signatures.length} transactions.`));
        for (const sigInfo of signatures) {
            if (sigInfo.err)
                continue;
            const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
                maxSupportedTransactionVersion: 0
            });
            if (!tx)
                continue;
            await this.processTransaction(tx, sigInfo.signature);
        }
    }
    async processTransaction(tx, signature) {
        if (!tx.transaction.message.instructions)
            return;
        for (const ix of tx.transaction.message.instructions) {
            // Check for System Program instructions
            if (ix.program === 'system') {
                if (ix.parsed.type === 'createAccountWithSeed') {
                    await this.handleSeedAccount(ix.parsed.info, signature);
                }
                else if (ix.parsed.type === 'createAccount') {
                    // Potential simple creation (like wSOL if followed by init)
                    // This is harder to track without context, but we can look at the new account
                    await this.handleStandardAccount(ix.parsed.info, signature, tx);
                }
            }
        }
    }
    async handleSeedAccount(info, signature) {
        // info: { base, seed, newAccount, lamports, space, owner }
        if (info.base === this.feePayer.toBase58()) {
            console.log(chalk.yellow(`Found Operator-Derived Account: ${info.newAccount} (Seed: ${info.seed})`));
            await this.db.run(`
                INSERT OR IGNORE INTO sponsored_accounts (address, type, seed, close_authority, status, rent_amount, last_checked)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                info.newAccount,
                'Seed',
                info.seed,
                info.base, // The base (fee payer) is effectively the authority for re-derived address operations
                'Active',
                info.lamports,
                Date.now()
            ]);
        }
    }
    async handleStandardAccount(info, signature, tx) {
        // Check if this account was initialized as a Token Account in the same tx
        // Look for 'initializeAccount' or 'initializeAccount3' on the same 'newAccount'
        const instructions = tx.transaction.message.instructions;
        const isTokenInit = instructions.some(ix => (ix.program === 'spl-token' || ix.program === 'spl-token-2022') &&
            (ix.parsed.type === 'initializeAccount' || ix.parsed.type === 'initializeAccount3') &&
            ix.parsed.info.account === info.newAccount);
        if (isTokenInit) {
            // It's a token account. Check if we (Fee Payer) are the close authority?
            // Usually initAccount sets the owner/close authority.
            // We'd need to parse the init instruction to see who the owner is.
            const initIx = instructions.find(ix => (ix.program === 'spl-token' || ix.program === 'spl-token-2022') &&
                (ix.parsed.type === 'initializeAccount' || ix.parsed.type === 'initializeAccount3') &&
                ix.parsed.info.account === info.newAccount);
            if (initIx) {
                // info: { account, mint, owner }
                // For wSOL, mint must be Wrapped SOL.
                // If owner is FeePayer, then we control it.
                if (initIx.parsed.info.owner === this.feePayer.toBase58()) {
                    console.log(chalk.cyan(`Found Operator-Owned Token Account: ${info.newAccount}`));
                    // Check if it's wSOL
                    if (initIx.parsed.info.mint === 'So11111111111111111111111111111111111111112') {
                        await this.db.run(`
                            INSERT OR IGNORE INTO sponsored_accounts (address, type, seed, close_authority, status, rent_amount, last_checked)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [
                            info.newAccount,
                            'wSOL',
                            null,
                            this.feePayer.toBase58(),
                            'Active',
                            info.lamports,
                            Date.now()
                        ]);
                    }
                    else {
                        // Regular ATA explicitly owned by Kora (maybe for other tokens)
                        await this.db.run(`
                            INSERT OR IGNORE INTO sponsored_accounts (address, type, seed, close_authority, status, rent_amount, last_checked)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [
                            info.newAccount,
                            'ATA',
                            null,
                            this.feePayer.toBase58(),
                            'Active',
                            info.lamports,
                            Date.now()
                        ]);
                    }
                }
            }
        }
    }
}
//# sourceMappingURL=monitor.js.map