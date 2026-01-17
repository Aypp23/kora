import { PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { createCloseAccountInstruction } from '@solana/spl-token';
import chalk from 'chalk';
export class Reclaimer {
    connection;
    db;
    operatorKeypair;
    constructor(connection, db, operatorKeypair) {
        this.connection = connection;
        this.db = db;
        this.operatorKeypair = operatorKeypair;
    }
    async reclaimAccounts() {
        console.log(chalk.blue('Starting reclamation process...'));
        const accounts = await this.db.all('SELECT * FROM sponsored_accounts WHERE status = ?', ['Reclaimable']);
        if (accounts.length === 0) {
            console.log(chalk.green('No reclaimable accounts found.'));
            return;
        }
        for (const account of accounts) {
            console.log(chalk.yellow(`Attempting to reclaim ${account.address} (${account.type})...`));
            try {
                let txId;
                if (account.type === 'wSOL' || account.type === 'ATA') {
                    txId = await this.reclaimTokenAccount(account);
                }
                else if (account.type === 'Seed') {
                    txId = await this.reclaimSeedAccount(account);
                }
                else {
                    continue;
                }
                console.log(chalk.green(`Reclaim successful! Tx: ${txId}`));
                await this.db.run('UPDATE sponsored_accounts SET status = ?, rent_amount = 0 WHERE address = ?', ['Reclaimed', account.address]);
            }
            catch (err) {
                console.error(chalk.red(`Failed to reclaim ${account.address}:`), err.message);
            }
        }
    }
    async reclaimTokenAccount(account) {
        const pubkey = new PublicKey(account.address);
        const ix = createCloseAccountInstruction(pubkey, // Account
        this.operatorKeypair.publicKey, // Destination
        this.operatorKeypair.publicKey // Authority
        );
        const tx = new Transaction().add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [this.operatorKeypair]);
    }
    async reclaimSeedAccount(account) {
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
        const tx = new Transaction().add(ix);
        return await sendAndConfirmTransaction(this.connection, tx, [this.operatorKeypair]);
    }
}
//# sourceMappingURL=reclaim.js.map