import { Telegraf, Context } from 'telegraf';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Database } from 'sqlite';
import { Monitor } from './monitor.js';
import { Analyzer } from './analyzer.js';
import { Reclaimer } from './reclaim.js';
import chalk from 'chalk';
import fs from 'fs';
import cron from 'node-cron';

export class BotService {
    private bot: Telegraf;
    private connection: Connection;
    private operator: Keypair;
    private db: Database;
    private chatId: string;
    private isRunning: boolean = false;

    constructor(
        token: string,
        chatId: string,
        connection: Connection,
        db: Database,
        operator: Keypair
    ) {
        this.bot = new Telegraf(token);
        this.chatId = chatId;
        this.connection = connection;
        this.db = db;
        this.operator = operator;

        this.setupMiddleware();
        this.setupCommands();
        this.setupScheduler();
    }

    private setupMiddleware() {
        // Security Middleware: Only allow the configured Operator
        this.bot.use((ctx, next) => {
            const senderId = ctx.chat?.id.toString();
            if (senderId !== this.chatId) {
                console.warn(chalk.yellow(`⚠️ Unauthorized access attempt from Chat ID: ${senderId}`));
                return; // Silent fail (ignore strangers)
            }
            return next();
        });
    }

    private setupCommands() {
        // /start
        this.bot.start((ctx) => {
            ctx.reply(
                `🤖 *Kora Rent Verification Bot*\n\n` +
                `I am monitoring your Kora Operator activity.\n` +
                `Account: \`${this.operator.publicKey.toBase58()}\`\n\n` +
                `*Commands:*\n` +
                `/status - Check database stats\n` +
                `/scan - Trigger a manual history scan\n` +
                `/reclaim - Trigger reclamation process\n` +
                `/balance - Check operator wallet balance`,
                { parse_mode: 'Markdown' }
            );
        });

        // /status
        this.bot.command('status', async (ctx) => {
            try {
                const db = this.db;

                const stats = await db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'Reclaimable' THEN 1 ELSE 0 END) as reclaimable,
                        SUM(CASE WHEN status = 'Reclaimed' THEN 1 ELSE 0 END) as reclaimed,
                        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active
                    FROM sponsored_accounts
                `);

                ctx.reply(
                    `📊 *Current Status*\n\n` +
                    `Total Tracked: ${stats.total}\n` +
                    `🟢 Active: ${stats.active}\n` +
                    `🟠 Reclaimable: ${stats.reclaimable}\n` +
                    `🔵 Reclaimed: ${stats.reclaimed}`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error: any) {
                ctx.reply(`Error getting status: ${error.message}`);
            }
        });

        // /balance
        this.bot.command('balance', async (ctx) => {
            try {
                const balance = await this.connection.getBalance(this.operator.publicKey);
                ctx.reply(`💰 *Balance:* ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`, { parse_mode: 'Markdown' });
            } catch (error: any) {
                ctx.reply(`Error fetching balance: ${error.message}`);
            }
        });

        // /scan
        this.bot.command('scan', async (ctx) => {
            if (this.isRunning) return ctx.reply('⚠️ A process is already running. Please wait.');
            this.isRunning = true;
            ctx.reply('🔍 Starting transaction history scan...');

            try {
                const db = this.db;
                const monitor = new Monitor(this.connection, db, this.operator.publicKey.toBase58());
                await monitor.scanHistory(50); // Default to last 50

                // Run analyzer mostly to categorize
                const analyzer = new Analyzer(this.connection, db);
                await analyzer.updateAccountStatuses();

                ctx.reply('✅ Scan complete! Check /status for results.');
            } catch (error: any) {
                ctx.reply(`❌ Scan failed: ${error.message}`);
            } finally {
                this.isRunning = false;
            }
        });

        // /reclaim
        this.bot.command('reclaim', async (ctx) => {
            if (this.isRunning) return ctx.reply('⚠️ A process is already running. Please wait.');
            this.isRunning = true;
            ctx.reply('🧹 Starting reclamation process...');

            try {
                const db = this.db;
                const reclaimer = new Reclaimer(this.connection, db, this.operator);

                const reclaimedCount = await reclaimer.reclaimAccounts();

                if (reclaimedCount > 0) {
                    ctx.reply(`✅ Successfully reclaimed ${reclaimedCount} accounts! Check /status for details.`);
                } else {
                    ctx.reply('✅ All caught up! No accounts needed reclaiming.');
                }
            } catch (error: any) {
                ctx.reply(`❌ Reclamation failed: ${error.message}`);
            } finally {
                this.isRunning = false;
            }
        });
    }

    public async notify(message: string) {
        if (this.chatId) {
            try {
                await this.bot.telegram.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
            } catch (e) {
                console.error('Failed to send Telegram notification:', e);
            }
        }
    }

    private setupScheduler() {
        console.log(chalk.magenta('⏰ Cron Scheduler initialized.'));

        // 1. Hourly Monitoring & Alerting (0 * * * *)
        cron.schedule('0 * * * *', async () => {
            console.log(chalk.blue('Hourly Scan & Check...'));
            try {
                // Monitor
                const monitor = new Monitor(this.connection, this.db, this.operator.publicKey.toBase58());
                await monitor.scanHistory(20); // Quick scan

                // Analyze
                const analyzer = new Analyzer(this.connection, this.db);
                await analyzer.updateAccountStatuses();

                // Alert Check
                await this.checkRentThreshold();
            } catch (e: any) {
                console.error('Hourly scan failed:', e);
            }
        });

        // 2. Daily Reclamation (0 0 * * *)
        cron.schedule('0 0 * * *', async () => {
            console.log(chalk.magenta('⏰ Executing Daily Reclamation...'));
            this.notify('⏰ *Daily Reclamation Started*');

            try {
                const reclaimer = new Reclaimer(this.connection, this.db, this.operator);
                const count = await reclaimer.reclaimAccounts();

                if (count > 0) {
                    this.notify(`✅ *Daily Cleanup Complete!* \n♻️ Reclaimed: ${count} accounts.`);
                } else {
                    this.notify(`✅ *Daily Cleanup Complete!* \nNo reclaimable accounts found today.`);
                }

            } catch (e: any) {
                console.error('Scheduled reclamation failed:', e);
                this.notify(`⚠️ *Reclamation Failed:* ${e.message}`);
            }
        });
    }

    private async checkRentThreshold() {
        try {
            const result = await this.db.get(`
                SELECT SUM(rent_amount) as total 
                FROM sponsored_accounts 
                WHERE status IN ('Active', 'Reclaimable')
            `);

            const totalLamports = result?.total || 0;
            const totalSol = totalLamports / LAMPORTS_PER_SOL;
            const ALERT_THRESHOLD_SOL = 1.0; // Configurable threshold

            if (totalSol > ALERT_THRESHOLD_SOL) {
                this.notify(
                    `🚨 *High Idle Rent Alert* 🚨\n\n` +
                    `There is currently *${totalSol.toFixed(4)} SOL* locked in inactive or sponsored accounts.\n` +
                    `This exceeds the alert threshold of ${ALERT_THRESHOLD_SOL} SOL.`
                );
            }
        } catch (e) {
            console.error('Failed to check rent threshold:', e);
        }
    }

    public launch() {
        this.bot.launch(() => {
            console.log(chalk.green('🤖 Telegram Bot started!'));
            this.notify('*Kora Bot Started* 🚀\nScheduler checks at 00:00 daily.');
        });

        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
}
