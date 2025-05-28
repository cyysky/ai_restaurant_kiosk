const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3').verbose();

class DataStore extends EventEmitter {
    constructor() {
        super();
        this.db = null;
        this.isInitialized = false;
        this.dbPath = path.join(__dirname, '../../data/kiosk.db');
    }

    async initialize() {
        console.log('Initializing Data Store...');
        
        try {
            // Ensure data directory exists
            await this.ensureDataDirectory();
            
            // Initialize SQLite database
            await this.initializeDatabase();
            
            // Create tables
            await this.createTables();
            
            this.isInitialized = true;
            console.log('Data Store initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Data Store:', error);
            throw error;
        }
    }

    async ensureDataDirectory() {
        const dataDir = path.dirname(this.dbPath);
        try {
            await fs.access(dataDir);
        } catch (error) {
            await fs.mkdir(dataDir, { recursive: true });
        }
    }

    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async createTables() {
        const tables = [
            // Orders table
            `CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT UNIQUE NOT NULL,
                items TEXT NOT NULL,
                subtotal REAL NOT NULL,
                tax REAL NOT NULL,
                total REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                customer_info TEXT,
                payment_method TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Sessions table
            `CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                cart_data TEXT,
                user_preferences TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )`,
            
            // Analytics table
            `CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                event_data TEXT,
                session_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Menu cache table
            `CREATE TABLE IF NOT EXISTS menu_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cache_key TEXT UNIQUE NOT NULL,
                cache_data TEXT NOT NULL,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];
        
        for (const tableSQL of tables) {
            await this.runQuery(tableSQL);
        }
        
        console.log('Database tables created successfully');
    }

    // Database helper methods
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    allQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Order management
    async saveOrder(order) {
        try {
            const sql = `
                INSERT INTO orders (
                    order_id, items, subtotal, tax, total, 
                    status, customer_info, payment_method
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                order.orderId,
                JSON.stringify(order.items),
                order.subtotal,
                order.tax,
                order.total,
                order.status || 'pending',
                JSON.stringify(order.customerInfo || {}),
                order.paymentMethod || 'cash'
            ];
            
            const result = await this.runQuery(sql, params);
            console.log('Order saved with ID:', result.id);
            
            // Emit event for order saved
            this.emit('order-saved', { ...order, dbId: result.id });
            
            return result.id;
            
        } catch (error) {
            console.error('Failed to save order:', error);
            throw error;
        }
    }

    async getOrder(orderId) {
        try {
            const sql = 'SELECT * FROM orders WHERE order_id = ?';
            const row = await this.getQuery(sql, [orderId]);
            
            if (row) {
                return {
                    ...row,
                    items: JSON.parse(row.items),
                    customer_info: JSON.parse(row.customer_info || '{}')
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Failed to get order:', error);
            throw error;
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const sql = `
                UPDATE orders 
                SET status = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE order_id = ?
            `;
            
            const result = await this.runQuery(sql, [status, orderId]);
            
            if (result.changes > 0) {
                this.emit('order-status-updated', { orderId, status });
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('Failed to update order status:', error);
            throw error;
        }
    }

    async getRecentOrders(limit = 10) {
        try {
            const sql = `
                SELECT * FROM orders 
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            
            const rows = await this.allQuery(sql, [limit]);
            
            return rows.map(row => ({
                ...row,
                items: JSON.parse(row.items),
                customer_info: JSON.parse(row.customer_info || '{}')
            }));
            
        } catch (error) {
            console.error('Failed to get recent orders:', error);
            throw error;
        }
    }

    // Session management
    async saveSession(sessionId, cartData, userPreferences = {}) {
        try {
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
            
            const sql = `
                INSERT OR REPLACE INTO sessions (
                    session_id, cart_data, user_preferences, expires_at, updated_at
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            const params = [
                sessionId,
                JSON.stringify(cartData),
                JSON.stringify(userPreferences),
                expiresAt.toISOString()
            ];
            
            await this.runQuery(sql, params);
            console.log('Session saved:', sessionId);
            
        } catch (error) {
            console.error('Failed to save session:', error);
            throw error;
        }
    }

    async getSession(sessionId) {
        try {
            const sql = `
                SELECT * FROM sessions 
                WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP
            `;
            
            const row = await this.getQuery(sql, [sessionId]);
            
            if (row) {
                return {
                    sessionId: row.session_id,
                    cartData: JSON.parse(row.cart_data || '{}'),
                    userPreferences: JSON.parse(row.user_preferences || '{}'),
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    expiresAt: row.expires_at
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Failed to get session:', error);
            throw error;
        }
    }

    async cleanupExpiredSessions() {
        try {
            const sql = 'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP';
            const result = await this.runQuery(sql);
            
            if (result.changes > 0) {
                console.log(`Cleaned up ${result.changes} expired sessions`);
            }
            
            return result.changes;
            
        } catch (error) {
            console.error('Failed to cleanup expired sessions:', error);
            throw error;
        }
    }

    // Analytics
    async logEvent(eventType, eventData = {}, sessionId = null) {
        try {
            const sql = `
                INSERT INTO analytics (event_type, event_data, session_id)
                VALUES (?, ?, ?)
            `;
            
            const params = [
                eventType,
                JSON.stringify(eventData),
                sessionId
            ];
            
            await this.runQuery(sql, params);
            
        } catch (error) {
            console.error('Failed to log analytics event:', error);
            // Don't throw error for analytics failures
        }
    }

    async getAnalytics(startDate, endDate, eventType = null) {
        try {
            let sql = `
                SELECT event_type, event_data, session_id, created_at
                FROM analytics
                WHERE created_at BETWEEN ? AND ?
            `;
            
            const params = [startDate, endDate];
            
            if (eventType) {
                sql += ' AND event_type = ?';
                params.push(eventType);
            }
            
            sql += ' ORDER BY created_at DESC';
            
            const rows = await this.allQuery(sql, params);
            
            return rows.map(row => ({
                ...row,
                event_data: JSON.parse(row.event_data || '{}')
            }));
            
        } catch (error) {
            console.error('Failed to get analytics:', error);
            throw error;
        }
    }

    // Cache management
    async setCache(key, data, ttlMinutes = 60) {
        try {
            const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
            
            const sql = `
                INSERT OR REPLACE INTO menu_cache (cache_key, cache_data, expires_at)
                VALUES (?, ?, ?)
            `;
            
            await this.runQuery(sql, [key, JSON.stringify(data), expiresAt.toISOString()]);
            
        } catch (error) {
            console.error('Failed to set cache:', error);
            throw error;
        }
    }

    async getCache(key) {
        try {
            const sql = `
                SELECT cache_data FROM menu_cache 
                WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP
            `;
            
            const row = await this.getQuery(sql, [key]);
            
            if (row) {
                return JSON.parse(row.cache_data);
            }
            
            return null;
            
        } catch (error) {
            console.error('Failed to get cache:', error);
            return null;
        }
    }

    async clearCache(pattern = null) {
        try {
            let sql = 'DELETE FROM menu_cache';
            const params = [];
            
            if (pattern) {
                sql += ' WHERE cache_key LIKE ?';
                params.push(pattern);
            }
            
            const result = await this.runQuery(sql, params);
            console.log(`Cleared ${result.changes} cache entries`);
            
            return result.changes;
            
        } catch (error) {
            console.error('Failed to clear cache:', error);
            throw error;
        }
    }

    // Maintenance
    async performMaintenance() {
        try {
            console.log('Performing database maintenance...');
            
            // Cleanup expired sessions
            await this.cleanupExpiredSessions();
            
            // Cleanup expired cache
            await this.runQuery('DELETE FROM menu_cache WHERE expires_at <= CURRENT_TIMESTAMP');
            
            // Cleanup old analytics (keep last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            await this.runQuery('DELETE FROM analytics WHERE created_at < ?', [thirtyDaysAgo.toISOString()]);
            
            // Vacuum database
            await this.runQuery('VACUUM');
            
            console.log('Database maintenance completed');
            
        } catch (error) {
            console.error('Database maintenance failed:', error);
            throw error;
        }
    }

    // Statistics
    async getStatistics() {
        try {
            const stats = {};
            
            // Order statistics
            const orderStats = await this.getQuery(`
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(total) as total_revenue,
                    AVG(total) as avg_order_value
                FROM orders
                WHERE created_at >= date('now', '-7 days')
            `);
            
            stats.orders = orderStats;
            
            // Popular items
            const popularItems = await this.allQuery(`
                SELECT 
                    json_extract(value, '$.name') as item_name,
                    SUM(json_extract(value, '$.quantity')) as total_quantity
                FROM orders, json_each(orders.items)
                WHERE created_at >= date('now', '-7 days')
                GROUP BY json_extract(value, '$.name')
                ORDER BY total_quantity DESC
                LIMIT 5
            `);
            
            stats.popularItems = popularItems;
            
            // Session statistics
            const sessionStats = await this.getQuery(`
                SELECT COUNT(*) as active_sessions
                FROM sessions
                WHERE expires_at > CURRENT_TIMESTAMP
            `);
            
            stats.sessions = sessionStats;
            
            return stats;
            
        } catch (error) {
            console.error('Failed to get statistics:', error);
            throw error;
        }
    }

    // Status and diagnostics
    getStatus() {
        return {
            initialized: this.isInitialized,
            connected: !!this.db,
            dbPath: this.dbPath
        };
    }

    // Cleanup
    async shutdown() {
        console.log('Shutting down Data Store...');
        
        try {
            // Perform final maintenance
            await this.performMaintenance();
            
            // Close database connection
            if (this.db) {
                await new Promise((resolve, reject) => {
                    this.db.close((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }
            
            this.isInitialized = false;
            console.log('Data Store shut down successfully');
            
        } catch (error) {
            console.error('Error during Data Store shutdown:', error);
        }
    }
}

module.exports = DataStore;