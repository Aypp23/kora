import { Database as SqliteDatabase } from 'sqlite';
export interface SponsoredAccount {
    address: string;
    type: 'Seed' | 'wSOL' | 'ATA';
    seed: string | null;
    close_authority: string;
    status: 'Active' | 'Reclaimable' | 'Reclaimed';
    rent_amount: number;
    last_checked: number;
}
export declare function initDatabase(dbPath?: string): Promise<SqliteDatabase>;
//# sourceMappingURL=schema.d.ts.map