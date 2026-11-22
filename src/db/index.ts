import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL no está definida (revisa .env.local)");
}

/* ponytail: un solo pool por proceso; en dev Next recarga módulos y
 * se evita abrir conexiones nuevas en cada HMR. */
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

const client =
    globalForDb.pg ??
    postgres(connectionString, {
        max: process.env.NODE_ENV === "production" ? 10 : 3,
        prepare: false,
    });

if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
