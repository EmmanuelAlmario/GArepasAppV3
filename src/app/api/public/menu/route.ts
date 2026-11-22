import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productos } from "@/db/schema";

/** Misma forma que consumía el menú React (MenuPublicoItemResponse). */
export const dynamic = "force-dynamic";

export async function GET() {
    const filas = await db
        .select({
            id: productos.id,
            nombre: productos.nombre,
            precio: productos.precioVenta,
            stockActual: productos.stockActual,
            bajoPedido: productos.bajoPedido,
        })
        .from(productos)
        .where(eq(productos.activo, true))
        .orderBy(asc(productos.nombre));

    const menu = filas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        disponible: Boolean(p.bajoPedido) || p.stockActual > 0,
    }));

    return NextResponse.json(menu, {
        headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
    });
}
