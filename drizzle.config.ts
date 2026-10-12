import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Drizzle Kit runs outside Next.js and does not automatically load .env.local.
config({ path: '.env.local' });

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
 throw new Error('MIGRATION_DATABASE_URL is missing from .env.local');
}

export default defineConfig({
 schema: './src/db/schema.ts',
 out: './drizzle',
 dialect: 'postgresql',
 dbCredentials: { url },
 strict: true,
 verbose: true
});
