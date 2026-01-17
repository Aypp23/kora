import sqlite3 from 'sqlite3';
import { open, Database as SqliteDatabase } from 'sqlite';

export interface SponsoredAccount {
    address: string;
    type: 'Seed' | 'wSOL' | 'ATA';
    seed: string | null;
    close_authority: string;
    status: 'Active' | 'Reclaimable' | 'Reclaimed';
    rent_amount: number;
    last_checked: number;
    whitelisted?: number; // 0 or 1
    last_activity?: number;
    created_at?: number;
}

export async function initDatabase(dbPath: string = 'kora_bot.db'): Promise<SqliteDatabase> {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS sponsored_accounts (
            address TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            seed TEXT,
            close_authority TEXT NOT NULL,
            status TEXT NOT NULL,
            rent_amount INTEGER NOT NULL,
            last_checked INTEGER,
            whitelisted INTEGER DEFAULT 0,
            last_activity INTEGER,
            created_at INTEGER
        );
    `);

    // Create Audit Log Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS reclamation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_address TEXT NOT NULL,
            amount_lamports INTEGER NOT NULL,
            tx_signature TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            reason TEXT
        );
    `);

    return db;
}
