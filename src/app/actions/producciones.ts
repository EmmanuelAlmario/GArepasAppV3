"use server";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
    detalleProducciones,
    detalleRecetas,
    gastos,
    insumos,
    producciones,
    productos,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { programarAlertas } from "@/lib/alertas-server";
import { round2 } from "@/lib/num";
import {
    construirLineas,
    costoTotalDe,
    todasSuficientes,
    type LineaCalculada,
} from "@/lib/produccion";

export type EstadoFormularioProduccion = {
    error?: string;
    campos?: Record<string, string>;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ProductoProduccion = { id: number; nombre: string; recetaId: number | null };

function mensajeDe(error: unknown) {
    return error instanceof Error ? error.message : "No se pudo guardar la producción.";
}

/**
 * Líneas de la producción con los insumos bloqueados (FOR UPDATE, en orden de
 * id para no cruzarse con otra transacción). Espejo de construirDetalles().
 */
async function lineasConStock(
    tx: Tx,
    producto: ProductoProduccion,
    cantidad: number,
    preciosCongelados?: Map<number, number | null>,
): Promise<LineaCalculada[]> {
    if (producto.recetaId == null) {
        throw new Error(`El producto '${producto.nombre}' no tiene una receta asignada.`);
    }

    const receta = await tx
        .select({ insumoId: detalleRecetas.insumoId, cantidad: detalleRecetas.cantidad })
        .from(detalleRecetas)
        .where(eq(detalleRecetas.recetaId, producto.recetaId));

    const requeridos = new Map<number, number>();
    for (const linea of receta) {
        requeridos.set(
            linea.insumoId,
            (requeridos.get(linea.insumoId) ?? 0) + linea.cantidad * cantidad,
        );
    }

    const ids = [...requeridos.keys()].sort((a, b) => a - b);
    const bloqueados = await tx
        .select({
            id: insumos.id,
            nombre: insumos.nombre,
            stockActual: insumos.stockActual,
            precioUnidadBase: insumos.precioUnidadBase,
        })
        .from(insumos)
        .where(inArray(insumos.id, ids))
        .orderBy(asc(insumos.id))
        .for("update");

    if (bloqueados.length !== ids.length) {
        throw new Error("La receta apunta a un insumo que ya no existe.");
    }

    return construirLineas(requeridos, new Map(bloqueados.map((i) => [i.id, i])), preciosCongelados);
}

/**
 * Descuenta insumos, suma stock del producto (solo producción manual) y
 * registra el gasto de materia prima. Espejo de aplicarProduccion().
 */
async function aplicarProduccion(
    tx: Tx,
    produccion: { id: number; fecha: Date; cantidad: number },
    producto: ProductoProduccion,
    lineas: LineaCalculada[],
    costoTotal: number,
    agregarStockProducto: boolean,
) {
    for (const linea of lineas) {
        await tx
            .update(insumos)
            .set({
                stockActual: sql`${insumos.stockActual} - ${linea.cantidadRequerida}`,
                version: sql`coalesce(${insumos.version}, 0) + 1`,
            })
            .where(eq(insumos.id, linea.insumoId));
    }

    if (agregarStockProducto) {
        await tx
            .update(productos)
            .set({
                stockActual: sql`${productos.stockActual} + ${produccion.cantidad}`,
                version: sql`coalesce(${productos.version}, 0) + 1`,
            })
            .where(eq(productos.id, producto.id));
    }

    if (costoTotal > 0) {
        await tx.insert(gastos).values({
            fecha: produccion.fecha,
            monto: round2(costoTotal),
            categoria: "MATERIA_PRIMA",
            descripcion: `Materia prima - ${producto.nombre} x${produccion.cantidad} (produccion #${produccion.id})`,
            produccionId: produccion.id,
        });
    }
}

function revalidarInventario(id?: number) {
    revalidatePath("/producciones");
    revalidatePath("/gastos");
    revalidatePath("/");
    if (id !== undefined) revalidatePath(`/producciones/${id}`);
}

export async function registrarProduccion(
    _estado: EstadoFormularioProduccion,
    formData: FormData,
): Promise<EstadoFormularioProduccion> {
    await requireAdmin("/producciones");

    const productoId = Number(formData.get("productoId"));
    const cantidad = Number(formData.get("cantidad"));
    const campos: Record<string, string> = {};
    if (!Number.isInteger(productoId) || productoId <= 0) {
        campos.productoId = "Selecciona un producto";
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        campos.cantidad = "La cantidad debe ser al menos 1";
    }
    if (Object.keys(campos).length > 0) {
        return { error: "Revisa los campos marcados.", campos };
    }

    let estado: "COMPLETADA" | "PENDIENTE";
    try {
        estado = await db.transaction(async (tx) => {
            const [producto] = await tx
                .select({
                    id: productos.id,
                    nombre: productos.nombre,
                    recetaId: productos.recetaId,
                    activo: productos.activo,
                })
                .from(productos)
                .where(eq(productos.id, productoId))
                .limit(1);

            if (!producto) throw new Error("El producto ya no existe.");
            if (producto.recetaId == null) {
                throw new Error(`El producto '${producto.nombre}' no tiene una receta asignada.`);
            }
            if (!producto.activo) {
                throw new Error(`El producto '${producto.nombre}' no está activo.`);
            }

            const lineas = await lineasConStock(tx, producto, cantidad);
            const costoTotal = costoTotalDe(lineas);

            const [creada] = await tx
                .insert(producciones)
                .values({
                    fecha: new Date(),
                    cantidad,
                    costoTotal,
                    estado: "PENDIENTE",
                    productoId: producto.id,
                })
                .returning({ id: producciones.id, fecha: producciones.fecha });

            if (lineas.length > 0) {
                await tx.insert(detalleProducciones).values(
                    lineas.map((l) => ({
                        produccionId: creada.id,
                        insumoId: l.insumoId,
                        cantidadRequerida: l.cantidadRequerida,
                        cantidadUsada: l.cantidadUsada,
                        costoLinea: l.costoLinea,
                        precioUnidadBaseSnapshot: l.precioUnidadBaseSnapshot,
                        suficiente: l.suficiente,
                    })),
                );
            }

            if (!todasSuficientes(lineas)) return "PENDIENTE";

            await aplicarProduccion(tx, { ...creada, cantidad }, producto, lineas, costoTotal, true);
            await tx
                .update(producciones)
                .set({ estado: "COMPLETADA" })
                .where(eq(producciones.id, creada.id));

            return "COMPLETADA";
        });
    } catch (error) {
        return { error: mensajeDe(error) };
    }

    revalidarInventario();
    programarAlertas();
    redirect(`/producciones?ok=${estado === "COMPLETADA" ? "completada" : "pendiente"}`);
}

/** Vuelve a calcular líneas con el stock de hoy y completa si alcanza. */
export async function verificarProduccion(formData: FormData) {
    await requireAdmin("/producciones");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    let estado: "COMPLETADA" | "PENDIENTE";
    try {
        estado = await db.transaction(async (tx) => {
            const [produccion] = await tx
                .select()
                .from(producciones)
                .where(eq(producciones.id, id))
                .limit(1)
                .for("update");
            if (!produccion) throw new Error("La producción ya no existe.");
            if (produccion.estado === "COMPLETADA") return "COMPLETADA";
            const [producto] = await tx
                .select({
                    id: productos.id,
                    nombre: productos.nombre,
                    recetaId: productos.recetaId,
                })
                .from(productos)
                .where(eq(productos.id, produccion.productoId))
                .limit(1);
            if (!producto) throw new Error("El producto de la producción ya no existe.");

            // Los precios de la primera verificación se congelan para siempre.
            const previas = await tx
                .select({
                    insumoId: detalleProducciones.insumoId,
                    precio: detalleProducciones.precioUnidadBaseSnapshot,
                })
                .from(detalleProducciones)
                .where(eq(detalleProducciones.produccionId, id));
            const congelados = new Map(previas.map((p) => [p.insumoId, p.precio]));

            const lineas = await lineasConStock(tx, producto, produccion.cantidad, congelados);
            const costoTotal = costoTotalDe(lineas);
            const completada = todasSuficientes(lineas);

            await tx.delete(detalleProducciones).where(eq(detalleProducciones.produccionId, id));
            if (lineas.length > 0) {
                await tx.insert(detalleProducciones).values(
                    lineas.map((l) => ({
                        produccionId: id,
                        insumoId: l.insumoId,
                        cantidadRequerida: l.cantidadRequerida,
                        cantidadUsada: l.cantidadUsada,
                        costoLinea: l.costoLinea,
                        precioUnidadBaseSnapshot: l.precioUnidadBaseSnapshot,
                        suficiente: l.suficiente,
                    })),
                );
            }
            await tx
                .update(producciones)
                .set({ costoTotal, estado: completada ? "COMPLETADA" : "PENDIENTE" })
                .where(eq(producciones.id, id));

            if (completada) {
                await aplicarProduccion(
                    tx,
                    { id, fecha: produccion.fecha, cantidad: produccion.cantidad },
                    producto,
                    lineas,
                    costoTotal,
                    produccion.ventaId === null,
                );
            }

            return completada ? "COMPLETADA" : "PENDIENTE";
        });
    } catch (error) {
        redirect(`/producciones?error=${encodeURIComponent(mensajeDe(error))}`);
    }

    revalidarInventario(id);
    programarAlertas();
    redirect(`/producciones?ok=${estado === "COMPLETADA" ? "completada" : "sigue-pendiente"}`);
}

/** Elimina la producción y revierte stock/gasto si estaba completada. */
export async function eliminarProduccion(formData: FormData) {
    await requireAdmin("/producciones");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    try {
        await db.transaction(async (tx) => {
            const [produccion] = await tx
                .select()
                .from(producciones)
                .where(eq(producciones.id, id))
                .limit(1)
                .for("update");
            if (!produccion) throw new Error("La producción ya no existe.");
            if (produccion.ventaId !== null) {
                throw new Error(
                    "Esta producción la generó una venta. Anula la venta desde Ventas para revertirla.",
                );
            }

            const detalles = await tx
                .select()
                .from(detalleProducciones)
                .where(eq(detalleProducciones.produccionId, id));

            if (produccion.estado === "COMPLETADA") {
                for (const detalle of detalles) {
                    const usada = detalle.cantidadUsada ?? 0;
                    if (usada <= 0) continue;
                    await tx
                        .update(insumos)
                        .set({
                            stockActual: sql`${insumos.stockActual} + ${usada}`,
                            version: sql`coalesce(${insumos.version}, 0) + 1`,
                        })
                        .where(eq(insumos.id, detalle.insumoId));
                }

                await tx
                    .update(productos)
                    .set({
                        stockActual: sql`${productos.stockActual} - ${produccion.cantidad}`,
                        version: sql`coalesce(${productos.version}, 0) + 1`,
                    })
                    .where(eq(productos.id, produccion.productoId));
            }

            await tx.delete(gastos).where(eq(gastos.produccionId, id));
            await tx.delete(detalleProducciones).where(eq(detalleProducciones.produccionId, id));
            await tx.delete(producciones).where(eq(producciones.id, id));
        });
    } catch (error) {
        redirect(`/producciones?error=${encodeURIComponent(mensajeDe(error))}`);
    }

    revalidarInventario(id);
    programarAlertas();
    redirect("/producciones?ok=eliminada");
}
