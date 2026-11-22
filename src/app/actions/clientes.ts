"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clientes, ventas } from "@/db/schema";
import { requireAdmin, requireSesion } from "@/lib/auth";
import { esDuplicado } from "@/lib/db-errores";

export type EstadoCliente = { error?: string; campos?: Record<string, string> };

const esquemaCliente = z.object({
    nombre: z
        .string()
        .trim()
        .min(1, "El nombre es obligatorio")
        .max(80, "El nombre no puede superar los 80 caracteres"),
    telefono: z.string().trim().max(30, "El teléfono no puede superar los 30 caracteres"),
    direccion: z.string().trim().max(150, "La dirección no puede superar los 150 caracteres"),
    notas: z.string().trim().max(250, "Las notas no pueden superar los 250 caracteres"),
    activo: z.boolean(),
});

const limpiar = (valor: string) => (valor === "" ? null : valor);

function mensajeDe(error: unknown) {
    return error instanceof Error ? error.message : "No se pudo guardar el cliente.";
}



export async function guardarCliente(
    _estado: EstadoCliente,
    formData: FormData,
): Promise<EstadoCliente> {
    const idCrudo = String(formData.get("id") ?? "").trim();
    const id = idCrudo === "" ? null : Number(idCrudo);
    if (id !== null && (!Number.isInteger(id) || id <= 0)) {
        return { error: "El cliente no es válido." };
    }

    await requireAdmin(id === null ? "/clientes/nuevo" : `/clientes/${id}`);

    const parseo = esquemaCliente.safeParse({
        nombre: String(formData.get("nombre") ?? ""),
        telefono: String(formData.get("telefono") ?? ""),
        direccion: String(formData.get("direccion") ?? ""),
        notas: String(formData.get("notas") ?? ""),
        activo: formData.get("activo") !== null,
    });

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
        telefono: limpiar(datos.telefono),
        direccion: limpiar(datos.direccion),
        notas: limpiar(datos.notas),
        activo: datos.activo,
    };

    try {
        /* El unique de la base es sensible a mayúsculas; el negocio no lo es. */
        const [repetido] = await db
            .select({ id: clientes.id })
            .from(clientes)
            .where(
                and(
                    eq(sql`lower(${clientes.nombre})`, datos.nombre.toLowerCase()),
                    id === null ? undefined : ne(clientes.id, id),
                ),
            )
            .limit(1);
        if (repetido) {
            return {
                error: "Ya existe un cliente con ese nombre.",
                campos: { nombre: "Nombre repetido" },
            };
        }

        if (id === null) {
            await db.insert(clientes).values({ ...fila, creadoEn: new Date() });
        } else {
            const actualizado = await db
                .update(clientes)
                .set(fila)
                .where(eq(clientes.id, id))
                .returning({ id: clientes.id });
            if (actualizado.length === 0) return { error: "El cliente ya no existe." };
        }
    } catch (error) {
        if (esDuplicado(error)) {
            return {
                error: "Ya existe un cliente con ese nombre.",
                campos: { nombre: "Nombre repetido" },
            };
        }
        return { error: mensajeDe(error) };
    }

    revalidatePath("/clientes");
    revalidatePath("/pos");
    redirect(id === null ? "/clientes" : `/clientes/${id}`);
}

export async function alternarCliente(formData: FormData) {
    await requireAdmin("/clientes");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    await db
        .update(clientes)
        .set({ activo: sql`not ${clientes.activo}` })
        .where(eq(clientes.id, id));

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    revalidatePath("/pos");
}

/** Con ventas registradas se desactiva en lugar de borrarse (igual que el backend). */
export async function eliminarCliente(formData: FormData) {
    await requireAdmin("/clientes");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    const [conteo] = await db
        .select({ n: sql<string>`count(*)` })
        .from(ventas)
        .where(eq(ventas.clienteId, id));

    if (Number(conteo?.n ?? 0) > 0) {
        await db.update(clientes).set({ activo: false }).where(eq(clientes.id, id));
        revalidatePath(`/clientes/${id}`);
    } else {
        await db.delete(clientes).where(eq(clientes.id, id));
    }

    revalidatePath("/clientes");
    revalidatePath("/pos");
}
