import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, { max: 10, idle_timeout: 30 });
}

// Ленивое подключение: модуль можно импортировать при сборке без БД.
function getClient() {
  if (!globalForDb.pgClient) globalForDb.pgClient = createClient();
  return globalForDb.pgClient;
}

export function getDb() {
  return drizzle(getClient(), { schema });
}

export async function closeDb() {
  await globalForDb.pgClient?.end();
  globalForDb.pgClient = undefined;
}
