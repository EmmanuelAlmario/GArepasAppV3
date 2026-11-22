"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { gastos } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { programarAlertas } from "@/lib/alertas-server";
import { esquemaGasto, planoGasto } from "@/lib/gastos";
import { round2 } from "@/lib/num";

export type EstadoGasto = { error?: string; campos?: Record<string, string> };

function mensajeDe(error: unknown) {
    return error instanceof Error ? error.message : "No se pudo guardar el gasto.";
}

export async function guardarGasto(_estado: EstadoGasto, formData: FormData): Promise<EstadoGasto> {
    await requireAdmin("/gastos");

    const idCrudo = String(formData.get("id") ?? "").trim();
    const id = idCrudo === "" ? null : Number(idCrudo);
    if (id !== null && !Number.isInteger(id)) return { error: "El gasto ya no existe." };

    const parseo = esquemaGasto.safeParse(planoGasto(formData));
    if (!parseo.success) {
        const campos: Record<string, string> = {};
        for (const issue of parseo.error.issues) {
            const campo = String(issue.path[0] ?? "form");
            campos[campo] ??= issue.message;
        }
        return { error: "Revisa los campos marcados.", campos };
    }

    const datos = parseo.data;

    try {
        if (id === null) {
            // La fecha se registra al guardar, igual que GastoService.registrar().
            await db.insert(gastos).values({
                descripcion: datos.descripcion,
                monto: round2(datos.monto),
                categoria: datos.categoria,
                fecha: new Date(),
            });
        } else {
            const [actual] = await db.select().from(gastos).where(eq(gastos.id, id)).limit(1);
            if (!actual) return { error: "El gasto ya no existe." };
            if (actual.produccionId !== null) {
                return {
                    error: "Este gasto fue generado automáticamente por una producción y no se puede editar.",
                };
            }

            await db
                .update(gastos)
                .set({
                    descripcion: datos.descripcion,
                    monto: round2(datos.monto),
                    categoria: datos.categoria,
                })
                .where(eq(gastos.id, id));
        }
    } catch (error) {
        return { error: mensajeDe(error) };
    }

    programarAlertas();
    revalidatePath("/gastos");
    revalidatePath("/");
    redirect("/gastos?ok=guardado");
}

export async function eliminarGasto(formData: FormData) {
    await requireAdmin("/gastos");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    try {
        const [gasto] = await db.select().from(gastos).where(eq(gastos.id, id)).limit(1);
        if (!gasto) throw new Error("El gasto ya no existe.");
        if (gasto.produccionId !== null) {
            throw new Error(
                "No se puede eliminar: es el gasto de materia prima de una producción. Elimina la producción para revertirlo.",
            );
        }
        await db.delete(gastos).where(eq(gastos.id, id));
    } catch (error) {
        redirect(`/gastos?error=${encodeURIComponent(mensajeDe(error))}`);
    }

    programarAlertas();
    revalidatePath("/gastos");
    revalidatePath("/");
    redirect("/gastos?ok=eliminado");
}
