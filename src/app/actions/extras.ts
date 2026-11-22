"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { extras } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { round2 } from "@/lib/num";

export type EstadoExtra = { error?: string; ok?: string };

function revalidarExtras() {
    revalidatePath("/productos");
    revalidatePath("/pos");
}

export async function guardarExtra(
    _estado: EstadoExtra,
    formData: FormData,
): Promise<EstadoExtra> {
    await requireAdmin("/productos");

    const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 40);
    const precioCrudo = String(formData.get("precio") ?? "").trim().replace(",", ".");
    const precio = Number(precioCrudo);

    if (nombre.length < 2) return { error: "Escribe el nombre del extra." };
    if (!Number.isFinite(precio) || precio < 0) return { error: "El precio no es válido." };

    try {
        await db.insert(extras).values({
            nombre,
            precio: round2(precio),
            activo: true,
            orden: 99,
        });
    } catch (error) {
        const duplicado =
            typeof error === "object" && error !== null && "code" in error && error.code === "23505";
        return { error: duplicado ? "Ya existe un extra con ese nombre." : "No se pudo guardar." };
    }

    revalidarExtras();
    return { ok: "Extra agregado." };
}

export async function alternarExtra(formData: FormData) {
    await requireAdmin("/productos");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    await db
        .update(extras)
        .set({ activo: sql`not ${extras.activo}` })
        .where(eq(extras.id, id));

    revalidarExtras();
}

export async function actualizarPrecioExtra(formData: FormData) {
    await requireAdmin("/productos");
    const id = Number(formData.get("id"));
    const precio = Number(String(formData.get("precio") ?? "").replace(",", "."));
    if (!Number.isInteger(id) || !Number.isFinite(precio) || precio < 0) return;

    await db.update(extras).set({ precio: round2(precio) }).where(eq(extras.id, id));
    revalidarExtras();
}
