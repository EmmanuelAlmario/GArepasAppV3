import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Salud para el despliegue: responde cuando la app y la base están arriba. */
export async function GET() {
    try {
        await db.execute(sql`select 1`);
        return Response.json({ ok: true });
    } catch {
        return Response.json({ ok: false }, { status: 503 });
    }
}
