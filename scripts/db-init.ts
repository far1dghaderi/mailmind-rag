import pg from 'pg';
import { schemaSql } from '../src/infrastructure/pgChunkStore.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(schemaSql());
console.log('schema ready');
await pool.end();
