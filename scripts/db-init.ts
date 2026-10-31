import { createPool } from '../src/infrastructure/createPool.js';
import { schemaSql } from '../src/infrastructure/pgChunkStore.js';

const pool = createPool();
await pool.query(schemaSql());
console.log('schema ready');
await pool.end();
