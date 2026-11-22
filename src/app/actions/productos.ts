"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { productos } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { programarAlertas } from "@/lib/alertas-server";
import { esDuplicado } from "@/lib/db-errores";
import { round2 } from "@/lib/num";
import { esquemaProducto, plano } from "@/lib/validators";

export type EstadoProducto = { error?: string; campos?: Record<string, string> };

function mensajeDe(error: unknown) {
    return error instanceof Error ? error.message : "No se pudo guardar el producto.";
}



export async function guardarProducto(
    _estado: EstadoProducto,
    formData: FormData,
): Promise<EstadoProducto> {
    await requireAdmin("/productos");

    const idCrudo = String(formData.get("id") ?? "").trim();
    const id = idCrudo === "" ? null : Number(idCrudo);

    const parseo = esquemaProducto.safeParse(plano(formData));
    if (!parseo.success) {
        const campos: Record<string, string> = {};
        for (const issue of parseo.error.issues) {
            const campo = String(issue.path[0] ?? "form");
            campos[campo] ??= issue.message;
        }
        return { error: "Revisa los campos marcados.", campos };
    }

    const datos = parseo.data;
    const fila = {
        nombre: datos.nombre,
        precioVenta: round2(datos.precioVenta),
        stockActual: datos.stockActual,
        stockMinimo: datos.stockMinimo ?? null,
        recetaId: datos.recetaId ?? null,
        activo: datos.activo,
        bajoPedido: datos.bajoPedido,
        controlarStock: datos.controlarStock,
    };

    try {
        if (id === null) {
            await db.insert(productos).values(fila);
        } else {
            const actualizado = await db
                .update(productos)
                .set({ ...fila, version: sql`coalesce(${productos.version}, 0) + 1` })
                .where(eq(productos.id, id))
                .returning({ id: productos.id });
            if (actualizado.length === 0) return { error: "El producto ya no existe." };
        }
    } catch (error) {
        if (esDuplicado(error)) {
            return {
                error: "Ya existe un producto con ese nombre.",
                campos: { nombre: "Nombre repetido" },
            };
        }
        return { error: mensajeDe(error) };
    }

    programarAlertas();
    revalidatePath("/productos");
    revalidatePath("/menu");
    redirect("/productos");
}

export async function alternarProducto(formData: FormData) {
    await requireAdmin("/productos");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    await db
        .update(productos)
        .set({ activo: sql`not ${productos.activo}` })
        .where(eq(productos.id, id));

    programarAlertas();
    revalidatePath("/productos");
    revalidatePath("/menu");
}
