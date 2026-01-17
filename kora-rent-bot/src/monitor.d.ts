import { Connection, PublicKey, type ParsedTransactionWithMeta } from '@solana/web3.js';
import { Database } from 'sqlite';
export declare class Monitor {
    connection: Connection;
    db: Database;
    feePayer: PublicKey;
    constructor(connection: Connection, db: Database, feePayerArg: string);
    scanHistory(limit?: number): Promise<void>;
    processTransaction(tx: ParsedTransactionWithMeta, signature: string): Promise<void>;
    handleSeedAccount(info: any, signature: string): Promise<void>;
    handleStandardAccount(info: any, signature: string, tx: ParsedTransactionWithMeta): Promise<void>;
}
//# sourceMappingURL=monitor.d.ts.map