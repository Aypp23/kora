import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/schema.js';
import chalk from 'chalk';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function startServer() {
    const db = await initDatabase();

    // GET /api/stats - Totals
    app.get('/api/stats', async (req, res) => {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_accounts,
                    SUM(CASE WHEN status IN ('Active', 'Reclaimable') THEN rent_amount ELSE 0 END) as locked_sol,
                    (SELECT SUM(amount_lamports) FROM reclamation_logs) as reclaimed_sol,
                    SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_count
                FROM sponsored_accounts
            `);

            // Format numbers
            const response = {
                total_reclaimed: (stats.reclaimed_sol || 0) / LAMPORTS_PER_SOL,
                active_locked: (stats.locked_sol || 0) / LAMPORTS_PER_SOL,
                total_accounts: stats.total_accounts || 0,
                active_count: stats.active_count || 0
            };

            res.json(response);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /api/accounts - List
    app.get('/api/accounts', async (req, res) => {
        try {
            const accounts = await db.all(`
                SELECT s.address, s.status, s.rent_amount as balance, s.last_activity, s.created_at, s.whitelisted, r.tx_signature as reclamation_tx
                FROM sponsored_accounts s
                LEFT JOIN reclamation_logs r ON s.address = r.account_address
                ORDER BY s.created_at DESC
                LIMIT 100
            `);
            res.json(accounts);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /api/logs - Audit Trail
    app.get('/api/logs', async (req, res) => {
        try {
            const logs = await db.all(`
                SELECT * FROM reclamation_logs
                ORDER BY timestamp DESC
                LIMIT 50
            `);
            res.json(logs);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.listen(PORT, () => {
        console.log(chalk.green(`🚀 Kora Dashboard API running on http://localhost:${PORT}`));
        console.log(chalk.blue(`Endpoints ready:`));
        console.log(`- GET /api/stats`);
        console.log(`- GET /api/accounts`);
        console.log(`- GET /api/logs`);
    });
}

// Start
startServer().catch(err => console.error(err));
