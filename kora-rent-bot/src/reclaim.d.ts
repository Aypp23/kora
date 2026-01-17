import { Connection, Keypair } from '@solana/web3.js';
import { Database } from 'sqlite';
import type { SponsoredAccount } from './db/schema.js';
export declare class Reclaimer {
    connection: Connection;
    db: Database;
    operatorKeypair: Keypair;
    constructor(connection: Connection, db: Database, operatorKeypair: Keypair);
    reclaimAccounts(): Promise<void>;
    reclaimTokenAccount(account: SponsoredAccount): Promise<string>;
    reclaimSeedAccount(account: SponsoredAccount): Promise<string>;
}
//# sourceMappingURL=reclaim.d.ts.map