import { Connection } from '@solana/web3.js';
import { Database } from 'sqlite';
export declare class Analyzer {
    connection: Connection;
    db: Database;
    constructor(connection: Connection, db: Database);
    updateAccountStatuses(): Promise<void>;
}
//# sourceMappingURL=analyzer.d.ts.map