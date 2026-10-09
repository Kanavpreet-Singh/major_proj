import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const dbUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy?sslmode=require';
const sql = neon(dbUrl);
export const db = drizzle(sql, { schema });
