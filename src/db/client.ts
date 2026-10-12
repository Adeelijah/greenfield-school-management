import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Do not initialize a connection during module import or at build time.
let client: ReturnType<typeof postgres> | undefined;
export function getDatabase(){
 const url=process.env.DATABASE_URL;
 if(!url)throw new Error('DATABASE_URL is not configured');
 client ??= postgres(url,{max:5,prepare:false});
 return drizzle(client,{schema});
}
