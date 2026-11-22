"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { detalleRecetas, insumos, productos, recetas } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { esDuplicado } from "@/lib/db-errores";
import { costoReceta, rendimientoDe } from "@/lib/costos";
import { round4 } from "@/lib/num";
import { aBase, compatible, etiqueta, UNIDADES, type Unidad } from "@/lib/units";

export type EstadoReceta = { error?: string; campos?: Record<string, string> };

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

type FilaReceta = { insumoId: number; cantidad: number; unidad: Unidad };

/* ---------- utilidades ---------- */

const texto = (formData: FormData, clave: string) =>
    String(formData.get(clave) ?? "").trim();

/** "", "0" o un número; undefined si el campo viene vacío. */
const numero = (formData: FormData, clave: string) => {
    const valor = String(formData.get(clave) ?? "").replace(",", ".").trim();
    return valor === "" ? undefined : valor;
};

const esquemaCabecera = z.object({
    nombre: z
        .string()
        .trim()
        .min(1, "El nombre es obligatorio")
        .max(50, "El nombre no puede superar 50 caracteres"),
    descripcion: z.string().trim().max(150, "La descripción no puede superar 150 caracteres").optional(),
    insumoProducidoId: z.coerce.number().int().positive().optional(),
    rendimiento: z.coerce
        .number({ error: "El rendimiento debe ser un número" })
        .positive("El rendimiento debe ser mayor a cero")
        .optional(),
});

function mensajeDe(error: unknown) {
    return error instanceof Error ? error.message : "No se pudo guardar la receta.";
}



function camposDe(error: z.ZodError) {
    const campos: Record<string, string> = {};
    for (const issue of error.issues) {
        const campo = String(issue.path[0] ?? "form");
        campos[campo] ??= issue.message;
    }
    return campos;
}

/** Insumo en unidad base: kg → g, L → ml, resto igual. */
const unidadBaseDe = (unidad: Unidad): Unidad =>
    unidad === "KILOGRAMO" ? "GRAMO" : unidad === "LITRO" ? "MILILITRO" : unidad;

/**
 * Lee las filas repetidas del formulario. Las filas totalmente vacías se
 * ignoran; una fila con insumo y cantidad exige unidad válida.
 */
function leerFilas(formData: FormData): { filas: FilaReceta[] } | { error: string } {
    const ids = formData.getAll("insumoId").map(String);
    const cantidades = formData.getAll("cantidad").map(String);
    const unidades = formData.getAll("unidad").map(String);

    const filas: FilaReceta[] = [];
    for (let i = 0; i < ids.length; i++) {
        const idCrudo = ids[i]?.trim() ?? "";
        const cantidadCruda = (cantidades[i] ?? "").replace(",", ".").trim();
        const unidadCruda = (unidades[i] ?? "").trim();

        if (idCrudo === "" && cantidadCruda === "" && unidadCruda === "") continue;
        if (idCrudo === "") continue;

        const insumoId = Number(idCrudo);
        const cantidad = Number(cantidadCruda);
        if (!Number.isInteger(insumoId) || !Number.isFinite(cantidad) || cantidad <= 0) continue;

        if (!UNIDADES.includes(unidadCruda as Unidad)) {
            return { error: "Cada fila con insumo y cantidad necesita una unidad de medida." };
        }

        filas.push({ insumoId, cantidad, unidad: unidadCruda as Unidad });
    }

    return { filas };
}

/** Nombre único sin distinguir mayúsculas (paridad con existsByNombreIgnoreCase). */
async function nombreEnUso(nombre: string, excluirId?: number) {
    const [fila] = await db
        .select({ id: recetas.id })
        .from(recetas)
        .where(and(sql`lower(${recetas.nombre}) = lower(${nombre})`, excluirId ? ne(recetas.id, excluirId) : undefined))
        .limit(1);
    return Boolean(fila);
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

/* ---------- acciones ---------- */

export async function guardarReceta(
    _estado: EstadoReceta,
    formData: FormData,
): Promise<EstadoReceta> {
    await requireAdmin("/recetas");

    const idCrudo = texto(formData, "id");
    const id = idCrudo === "" ? null : Number(idCrudo);
    if (id !== null && !Number.isInteger(id)) return { error: "Receta no válida." };

    const parseoCabecera = esquemaCabecera.safeParse({
        nombre: texto(formData, "nombre"),
        descripcion: texto(formData, "descripcion") === "" ? undefined : texto(formData, "descripcion"),
        insumoProducidoId: numero(formData, "insumoProducidoId"),
        rendimiento: numero(formData, "rendimiento"),
    });

    if (!parseoCabecera.success) {
        return { error: "Revisa los campos marcados.", campos: camposDe(parseoCabecera.error) };
    }

    const cabecera = parseoCabecera.data;
    const leidas = leerFilas(formData);
    if ("error" in leidas) return { error: leidas.error };

    if (leidas.filas.length === 0) {
        return { error: "La receta debe incluir al menos un ingrediente con cantidad mayor a cero." };
    }

    // Suma cantidades por insumo (en unidad base), como el backend.
    const cantidades = new Map<number, number>();
    const unidades = new Map<number, Unidad>();
    for (const fila of leidas.filas) {
        const enBase = aBase(fila.cantidad, fila.unidad);
        cantidades.set(fila.insumoId, round4((cantidades.get(fila.insumoId) ?? 0) + enBase));
        unidades.set(fila.insumoId, fila.unidad);
    }

    if (cabecera.insumoProducidoId !== undefined && cabecera.rendimiento === undefined) {
        return {
            error: "Una receta que fabrica un insumo necesita indicar su rendimiento (cuánto rinde un lote).",
            campos: { rendimiento: "Indica el rendimiento del lote" },
        };
    }

    try {
        if (await nombreEnUso(cabecera.nombre, id ?? undefined)) {
            return {
                error: `Ya existe una receta llamada “${cabecera.nombre}”.`,
                campos: { nombre: "Nombre repetido" },
            };
        }

        await db.transaction(async (tx) => {
            const ids = [...cantidades.keys()];
            const usados = await tx.select().from(insumos).where(inArray(insumos.id, ids));
            const porId = new Map(usados.map((i) => [i.id, i]));

            let insumoProducido: (typeof usados)[number] | null = null;
            if (cabecera.insumoProducidoId !== undefined) {
                insumoProducido = porId.get(cabecera.insumoProducidoId) ?? null;
                if (!insumoProducido) {
                    const [fila] = await tx
                        .select()
                        .from(insumos)
                        .where(eq(insumos.id, cabecera.insumoProducidoId));
                    if (!fila) throw new Error("El insumo que fabrica la receta ya no existe.");
                    insumoProducido = fila;
                }
            }

            // Una receta que fabrica un insumo no puede usar insumos que ya
            // fabrica otra receta (evita ciclos y precios que se pisan).
            if (insumoProducido) {
                const fabricados = await tx
                    .select({ insumoProducidoId: recetas.insumoProducidoId })
                    .from(recetas)
                    .where(
                        and(
                            inArray(recetas.insumoProducidoId, ids),
                            id === null ? undefined : ne(recetas.id, id),
                        ),
                    );
                if (fabricados.length > 0) {
                    const elegido = fabricados[0].insumoProducidoId!;
                    const nombre = porId.get(elegido)?.nombre ?? `#${elegido}`;
                    throw new Error(
                        `El insumo “${nombre}” ya es fabricado por otra receta y no puede usarse en una receta que también fabrica insumos.`,
                    );
                }
            }

            for (const [insumoId] of cantidades) {
                const insumo = porId.get(insumoId);
                if (!insumo) throw new Error("Uno de los insumos de la receta ya no existe.");

                const unidad = unidades.get(insumoId)!;
                const unidadBase = unidadBaseDe(insumo.unidadPresentacion);
                if (!compatible(unidad, unidadBase)) {
                    throw new Error(
                        `La unidad ${etiqueta(unidad)} no es compatible con el insumo “${insumo.nombre}” ` +
                            `(se maneja en ${etiqueta(unidadBase)}).`,
                    );
                }

                if (insumoProducido && insumoId === insumoProducido.id) {
                    throw new Error("Un insumo no puede ser ingrediente de la receta que lo fabrica.");
                }
            }

            const rendimiento = insumoProducido
                ? cabecera.rendimiento!
                : (cabecera.rendimiento ?? 1);

            const fila = {
                nombre: cabecera.nombre,
                descripcion: cabecera.descripcion ?? null,
                rendimiento,
                insumoProducidoId: insumoProducido ? insumoProducido.id : null,
            };

            let recetaId: number;
            if (id === null) {
                const [creada] = await tx.insert(recetas).values(fila).returning({ id: recetas.id });
                recetaId = creada.id;
            } else {
                const [actualizada] = await tx
                    .update(recetas)
                    .set(fila)
                    .where(eq(recetas.id, id))
                    .returning({ id: recetas.id });
                if (!actualizada) throw new Error("La receta ya no existe.");
                recetaId = actualizada.id;
                await tx.delete(detalleRecetas).where(eq(detalleRecetas.recetaId, recetaId));
            }

            await tx.insert(detalleRecetas).values(
                [...cantidades].map(([insumoId, cantidad]) => ({
                    recetaId,
                    insumoId,
                    cantidad,
                })),
            );

            await recalcularPrecioProducido(tx, recetaId);
        });
    } catch (error) {
        if (esDuplicado(error)) {
            return {
                error: "Ya existe una receta con ese nombre.",
                campos: { nombre: "Nombre repetido" },
            };
        }
        return { error: mensajeDe(error) };
    }

    revalidatePath("/recetas");
    revalidatePath("/productos");
    revalidatePath("/insumos");
    redirect("/recetas");
}

export async function eliminarReceta(formData: FormData) {
    await requireAdmin("/recetas");
    const id = Number(texto(formData, "id"));
    if (!Number.isInteger(id)) redirect("/recetas");

    const [asignada] = await db
        .select({ id: productos.id })
        .from(productos)
        .where(eq(productos.recetaId, id))
        .limit(1);

    if (asignada) {
        redirect(
            `/recetas?error=${encodeURIComponent(
                "La receta está asignada a uno o más productos y no se puede eliminar.",
            )}`,
        );
    }

    const [receta] = await db
        .select({ insumoProducidoId: recetas.insumoProducidoId })
        .from(recetas)
        .where(eq(recetas.id, id));

    if (!receta) redirect("/recetas");
    if (receta.insumoProducidoId !== null) {
        redirect(
            `/recetas?error=${encodeURIComponent(
                "La receta es el origen de un insumo fabricado y no se puede eliminar.",
            )}`,
        );
    }

    await db.transaction(async (tx) => {
        await tx.delete(detalleRecetas).where(eq(detalleRecetas.recetaId, id));
        await tx.delete(recetas).where(eq(recetas.id, id));
    });

    revalidatePath("/recetas");
    redirect("/recetas");
}
