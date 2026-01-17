import { Database } from 'sqlite3';
import { open } from 'sqlite';
export async function initDatabase(dbPath = 'kora_bot.db') {
    const db = await open({
        filename: dbPath,
        driver: Database
    });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS sponsored_accounts (
            address TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            seed TEXT,
            close_authority TEXT NOT NULL,
            status TEXT NOT NULL,
            rent_amount INTEGER NOT NULL,
            last_checked INTEGER
        );
    `);
    return db;
}
//# sourceMappingURL=schema.js.map