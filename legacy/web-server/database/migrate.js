#!/usr/bin/env node

/**
 * Database Migration Script
 * Run with: node database/migrate.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/statecraft';

async function migrate() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('Connecting to database...');
        console.log('Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Hide password

        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running migration...');

        // Execute schema
        await pool.query(schema);

        console.log('✅ Migration completed successfully!');

        // Show tables
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('\nCreated tables:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration
migrate();
