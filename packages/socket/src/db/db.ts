import { PrismaClient } from '@prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const pgPool = new Pool({ connectionString });
const adapter = new PrismaPg(pgPool);

export const prisma = new PrismaClient({ adapter });