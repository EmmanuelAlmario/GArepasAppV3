"use server";

import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
    ajustesInventario,
    detalleProducciones,
    detalleRecetas,
    insumos,
    recetas,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { programarAlertas } from "@/lib/alertas-server";
import { codigoPg, esDuplicado } from "@/lib/db-errores";
import { cantidad as formatCantidad } from "@/lib/format";
import { costoReceta, rendimientoDe } from "@/lib/costos";
import { round2, round4 } from "@/lib/num";
import { aBase, desdeBase, etiqueta, precioABase, UNIDADES } from "@/lib/units";

export type EstadoInsumo = { error?: string; campos?: Record<string, string> };
export type EstadoAjuste = { error?: string; campos?: Record<string, string> };

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/* ---------- utilidades ---------- */

const texto = (formData: FormData, clave: string) =>
    String(formData.get(clave) ?? "").trim();

const numero = (formData: FormData, clave: string) => {
    const valor = String(formData.get(clave) ?? "").replace(",", ".").trim();
    return valor === "" ? undefined : valor;
};

const cantidad = (etiqueta: string, minimo = 0) =>
    z.coerce
        .number({ error: `${etiqueta}: debe ser un número` })
        .min(minimo, `${etiqueta}: no puede ser negativo`);

const esquemaInsumo = z.object({
    nombre: z
        .string()
        .trim()
        .min(1, "El nombre es obligatorio")
        .max(60, "El nombre no puede superar 60 caracteres"),
    categoria: z
        .string()
        .trim()
        .min(1, "La categoría es obligatoria")
        .max(30, "La categoría no puede superar 30 caracteres"),
    marca: z
        .string()
        .trim()
        .min(1, "La marca es obligatoria")
        .max(30, "La marca no puede superar 30 caracteres"),
    unidadMedida: z.enum(UNIDADES, { error: "Selecciona la unidad de presentación" }),
    stockActual: cantidad("Stock actual").max(999_999_999, "Stock actual: valor demasiado alto"),
    stockMinimo: cantidad("Stock mínimo").max(999_999_999, "Stock mínimo: valor demasiado alto").optional(),
    precioCompra: z.coerce
        .number({ error: "Precio de compra: debe ser un número" })
        .gt(0, "El precio debe ser mayor a cero")
        .max(999_999_999, "Precio de compra: valor demasiado alto"),
    activo: z.boolean(),
});

const esquemaAjuste = z.object({
    cantidad: z.coerce
        .number({ error: "Cantidad: debe ser un número" })
        .refine((n) => n !== 0, "La cantidad de ajuste no puede ser cero."),
    motivo: z.string().trim().max(150, "El motivo no puede superar 150 caracteres").optional(),
});

function mensajeDe(error: unknown) {
    return error instanceof Error ? error.message : "No se pudo guardar el insumo.";
}



function camposDe(error: z.ZodError) {
    const campos: Record<string, string> = {};
    for (const issue of error.issues) {
        const campo = String(issue.path[0] ?? "form");
        campos[campo] ??= issue.message;
    }
    return campos;
}

/** Nombre único sin distinguir mayúsculas (paridad con existsByNombreIgnoreCase). */
async function nombreEnUso(nombre: string, excluirId?: number) {
    const [fila] = await db
        .select({ id: insumos.id })
        .from(insumos)
        .where(and(sql`lower(${insumos.nombre}) = lower(${nombre})`, excluirId ? ne(insumos.id, excluirId) : undefined))
        .limit(1);
    return Boolean(fila);
}

/** Inserta el movimiento en ajustes_inventario; el stock lo actualiza quien llama. */
async function registrarAjuste(
    tx: Transaccion,
    insumo: { id: number; precioUnidadBase: number },
    delta: number,
    stockResultante: number,
    motivo: string,
    usuario: string,
) {
    await tx.insert(ajustesInventario).values({
        insumoId: insumo.id,
        delta,
        stockResultante,
        valor: round2(Math.abs(delta) * insumo.precioUnidadBase),
        motivo: motivo.trim() || "Ajuste manual",
        usuario: usuario.trim() || "sistema",
        fecha: new Date(),
    });
}

/** Precio del insumo fabricado = costo de la receta ÷ rendimiento (6 decimales). */
async function recalcularPrecioProducido(tx: Transaccion, recetaId: number) {
    const [receta] = await tx
        .select({ rendimiento: recetas.rendimiento, insumoProducidoId: recetas.insumoProducidoId })
        .from(recetas)
        .where(eq(recetas.id, recetaId));

    if (!receta?.insumoProducidoId) return;

    const lineas = await tx
        .select({
            cantidad: detalleRecetas.cantidad,
            precioUnidadBase: insumos.precioUnidadBase,
        })
        .from(detalleRecetas)
        .innerJoin(insumos, eq(detalleRecetas.insumoId, insumos.id))
        .where(eq(detalleRecetas.recetaId, recetaId));

    const precio =
        Math.round((costoReceta(lineas) / rendimientoDe(receta.rendimiento)) * 1_000_000) / 1_000_000;

    await tx
        .update(insumos)
        .set({ precioUnidadBase: precio, version: sql`coalesce(${insumos.version}, 0) + 1` })
        .where(eq(insumos.id, receta.insumoProducidoId));
}

/** Recalcula las recetas que usan el insumo y las que lo fabrican. */
async function recalcularInsumosProducidos(tx: Transaccion, insumoId: number) {
    const fabrican = await tx
        .select({ id: recetas.id })
        .from(recetas)
        .innerJoin(detalleRecetas, eq(detalleRecetas.recetaId, recetas.id))
        .where(and(eq(detalleRecetas.insumoId, insumoId), isNotNull(recetas.insumoProducidoId)));

    const producen = await tx
        .select({ id: recetas.id })
        .from(recetas)
        .where(eq(recetas.insumoProducidoId, insumoId));

    const ids = [...new Set([...fabrican, ...producen].map((r) => r.id))];
    for (const id of ids) await recalcularPrecioProducido(tx, id);
}

/* ---------- acciones ---------- */

export async function guardarInsumo(
    _estado: EstadoInsumo,
    formData: FormData,
): Promise<EstadoInsumo> {
    const sesion = await requireAdmin("/insumos");

    const idCrudo = texto(formData, "id");
    const id = idCrudo === "" ? null : Number(idCrudo);
    if (id !== null && !Number.isInteger(id)) return { error: "Insumo no válido." };

    const parseo = esquemaInsumo.safeParse({
        nombre: texto(formData, "nombre"),
        categoria: texto(formData, "categoria"),
        marca: texto(formData, "marca"),
        unidadMedida: texto(formData, "unidadMedida"),
        stockActual: numero(formData, "stockActual"),
        stockMinimo: numero(formData, "stockMinimo"),
        precioCompra: numero(formData, "precioCompra"),
        activo: formData.get("activo") !== null,
    });

    if (!parseo.success) {
        return { error: "Revisa los campos marcados.", campos: camposDe(parseo.error) };
    }

    const datos = parseo.data;
    const unidad = datos.unidadMedida;
    const stockBase = round4(aBase(datos.stockActual, unidad));
    const minimoBase =
        datos.stockMinimo === undefined ? null : round4(aBase(datos.stockMinimo, unidad));
    const precioBase = Number(precioABase(datos.precioCompra, unidad).toFixed(6));

    const fila = {
        nombre: datos.nombre,
        categoria: datos.categoria,
        marca: datos.marca,
        unidadPresentacion: unidad,
        precioUnidadBase: precioBase,
        stockMinimo: minimoBase,
        activo: datos.activo,
    };

    try {
        if (await nombreEnUso(datos.nombre, id ?? undefined)) {
            return {
                error: `Ya existe un insumo llamado “${datos.nombre}”.`,
                campos: { nombre: "Nombre repetido" },
            };
        }

        if (id === null) {
            await db.insert(insumos).values({ ...fila, stockActual: stockBase });
        } else {
            await db.transaction(async (tx) => {
                const [bloqueado] = await tx
                    .select()
                    .from(insumos)
                    .where(eq(insumos.id, id))
                    .for("update");

                if (!bloqueado) throw new Error("El insumo ya no existe.");

                await tx
                    .update(insumos)
                    .set({
                        ...fila,
                        stockActual: stockBase,
                        version: sql`coalesce(${insumos.version}, 0) + 1`,
                    })
                    .where(eq(insumos.id, id));

                // El stock se toca desde la ficha: queda registrado como movimiento.
                const delta = round4(stockBase - bloqueado.stockActual);
                if (delta !== 0) {
                    await registrarAjuste(
                        tx,
                        bloqueado,
                        delta,
                        stockBase,
                        "Edición de ficha de insumo",
                        sesion.username,
                    );
                }

                await recalcularInsumosProducidos(tx, id);
            });
        }
    } catch (error) {
        if (esDuplicado(error)) {
            return {
                error: "Ya existe un insumo con ese nombre.",
                campos: { nombre: "Nombre repetido" },
            };
        }
        return { error: mensajeDe(error) };
    }

    programarAlertas();
    revalidatePath("/insumos");
    revalidatePath("/recetas");
    revalidatePath("/productos");
    redirect("/insumos");
}

export async function ajustarStockInsumo(
    _estado: EstadoAjuste,
    formData: FormData,
): Promise<EstadoAjuste> {
    const sesion = await requireAdmin("/insumos");

    const id = Number(texto(formData, "id"));
    if (!Number.isInteger(id)) return { error: "Insumo no válido." };

    const parseo = esquemaAjuste.safeParse({
        cantidad: numero(formData, "cantidad"),
        motivo: texto(formData, "motivo"),
    });

    if (!parseo.success) {
        return { error: "Revisa los campos marcados.", campos: camposDe(parseo.error) };
    }

    try {
        await db.transaction(async (tx) => {
            const [insumo] = await tx
                .select()
                .from(insumos)
                .where(eq(insumos.id, id))
                .for("update");

            if (!insumo) throw new Error("El insumo ya no existe.");

            // La cantidad se ingresa en la unidad de presentación (kg, L, u).
            const delta = round4(aBase(parseo.data.cantidad, insumo.unidadPresentacion));
            if (delta === 0) throw new Error("La cantidad de ajuste no puede ser cero.");

            const nuevoStock = round4(insumo.stockActual + delta);
            if (nuevoStock < 0) {
                const unidad = etiqueta(insumo.unidadPresentacion);
                const disponible = formatCantidad(
                    round4(desdeBase(insumo.stockActual, insumo.unidadPresentacion)),
                );
                throw new Error(
                    `El ajuste dejaría el stock de “${insumo.nombre}” en negativo. ` +
                        `Disponible: ${disponible} ${unidad}, ` +
                        `ajuste: ${formatCantidad(parseo.data.cantidad)} ${unidad}.`,
                );
            }

            await tx
                .update(insumos)
                .set({
                    stockActual: nuevoStock,
                    version: sql`coalesce(${insumos.version}, 0) + 1`,
                })
                .where(eq(insumos.id, id));

            await registrarAjuste(
                tx,
                insumo,
                delta,
                nuevoStock,
                parseo.data.motivo || "Ajuste manual de inventario",
                sesion.username,
            );
        });
    } catch (error) {
        return { error: mensajeDe(error) };
    }

    programarAlertas();
    revalidatePath("/insumos");
    redirect("/insumos");
}

export async function eliminarInsumo(formData: FormData) {
    await requireAdmin("/insumos");
    const id = Number(texto(formData, "id"));
    if (!Number.isInteger(id)) redirect("/insumos");

    const [[enReceta], [enProduccion], [produce]] = await Promise.all([
        db.select({ id: detalleRecetas.id }).from(detalleRecetas).where(eq(detalleRecetas.insumoId, id)).limit(1),
        db
            .select({ id: detalleProducciones.id })
            .from(detalleProducciones)
            .where(eq(detalleProducciones.insumoId, id))
            .limit(1),
        db.select({ id: recetas.id }).from(recetas).where(eq(recetas.insumoProducidoId, id)).limit(1),
    ]);

    let aviso: string | null = null;
    if (enReceta) aviso = "El insumo está en uso en una o más recetas y no se puede eliminar.";
    if (enProduccion) aviso = "El insumo tiene producciones registradas y no se puede eliminar.";
    if (produce) aviso = "El insumo es fabricado por una receta y no se puede eliminar.";

    if (aviso) redirect(`/insumos?error=${encodeURIComponent(aviso)}`);

    try {
        await db.delete(insumos).where(eq(insumos.id, id));
    } catch (error) {
        // 23503 = violación de llave foránea (movimientos de inventario u otro historial).
        const fk = codigoPg(error) === "23503";
        redirect(
            `/insumos?error=${encodeURIComponent(
                fk
                    ? "El insumo tiene movimientos registrados y no se puede eliminar."
                    : mensajeDe(error),
            )}`,
        );
    }

    revalidatePath("/insumos");
    revalidatePath("/recetas");
    redirect("/insumos");
}
