import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { assertRestrictedDatabaseConfiguration } from './connection-guard';

// Do not initialize a connection during module import or at build time.
let client: ReturnType<typeof postgres> | undefined;
export function getDatabase(){
 const url=process.env.DATABASE_URL;
 assertRestrictedDatabaseConfiguration(url, process.env.MIGRATION_DATABASE_URL, process.env.GREENFIELD_VERIFIED_DB_ROLE);
 client ??= postgres(url,{max:5,prepare:false});
 return drizzle(client,{schema});
}
