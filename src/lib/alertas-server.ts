import { and, desc, eq, gte, lt, notInArray, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import {
    alertas,
    configuracionNegocio,
    detalleRecetas,
    detalleVentas,
    insumos,
    producciones,
    productos,
    recetas,
    ventas,
} from "@/db/schema";
import { costoReceta, costoUnitario } from "./costos";
import { tramosCartera } from "./analitica";
import { calcularAlertas, type ContextoAlertas } from "./motor-alertas";

/** Ventana de cálculo del motor. */
const DIAS = 30;
/** Pasado este tiempo, la próxima lectura recalcula sola. */
const VIGENCIA_MS = 10 * 60 * 1000;

/** Reúne las cifras que alimentan las reglas. */
async function recolectarContexto(): Promise<ContextoAlertas> {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - DIAS * 86_400_000);
    const desdePrevio = new Date(desde.getTime() - DIAS * 86_400_000);

    const [
        [actual],
        [previo],
        [anuladas],
        [config],
        porCanal,
        porProducto,
        filasReceta,
        porHoraDia,
        cartera,
        topSaldos,
        [stockBajo],
        [pendientes],
    ] = await Promise.all([
        db
            .select({
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                cantidad: sql<number>`count(*)::int`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde))),
        db
            .select({
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                cantidad: sql<number>`count(*)::int`,
            })
            .from(ventas)
            .where(
                and(
                    eq(ventas.estado, "ACTIVA"),
                    gte(ventas.fecha, desdePrevio),
                    lt(ventas.fecha, desde),
                ),
            ),
        db
            .select({ n: sql<number>`count(*)::int` })
            .from(ventas)
            .where(and(eq(ventas.estado, "ANULADA"), gte(ventas.fecha, desde))),
        db
            .select({
                objetivo: configuracionNegocio.objetivoFoodCost,
                meta: configuracionNegocio.metaTicket,
            })
            .from(configuracionNegocio)
            .limit(1),
        db
            .select({
                canal: ventas.canal,
                vendido: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                comision: sql<number>`coalesce(sum(${ventas.total} * ${ventas.comisionPct} / 100), 0)::float8`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde)))
            .groupBy(ventas.canal),
        db
            .select({
                productoId: detalleVentas.productoId,
                unidades: sql<number>`sum(${detalleVentas.cantidad})::int`,
                ingreso: sql<number>`sum(${detalleVentas.cantidad} * ${detalleVentas.precioUnitario})::float8`,
            })
            .from(detalleVentas)
            .innerJoin(ventas, eq(detalleVentas.ventaId, ventas.id))
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde)))
            .groupBy(detalleVentas.productoId),
        db
            .select({
                recetaId: detalleRecetas.recetaId,
                cantidad: detalleRecetas.cantidad,
                precio: insumos.precioUnidadBase,
                rendimiento: recetas.rendimiento,
            })
            .from(detalleRecetas)
            .innerJoin(insumos, eq(detalleRecetas.insumoId, insumos.id))
            .innerJoin(recetas, eq(detalleRecetas.recetaId, recetas.id)),
        db
            .select({
                dia: sql<number>`extract(isodow from (${ventas.fecha} - interval '5 hours'))::int`,
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde)))
            .groupBy(sql`1`),
        db
            .select({ saldo: ventas.saldo, vence: ventas.fechaVencimiento })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), sql`${ventas.saldo} > 0`)),
        db
            .select({ saldo: sql<number>`sum(${ventas.saldo})::float8` })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), sql`${ventas.saldo} > 0`))
            .groupBy(ventas.clienteId, ventas.nombreCliente)
            .orderBy(desc(sql`sum(${ventas.saldo})`))
            .limit(10),
        db
            .select({ n: sql<number>`count(*)::int` })
            .from(insumos)
            .where(
                and(
                    eq(insumos.activo, true),
                    sql`${insumos.stockMinimo} is not null`,
                    sql`${insumos.stockActual} <= ${insumos.stockMinimo}`,
                ),
            ),
        db
            .select({ n: sql<number>`count(*)::int` })
            .from(producciones)
            .where(eq(producciones.estado, "PENDIENTE")),
    ]);

    /* Costo por producto según su receta. */
    const lineas = new Map<number, Array<{ cantidad: number; precioUnidadBase: number }>>();
    const rendimiento = new Map<number, number | null>();
    for (const f of filasReceta) {
        const lista = lineas.get(f.recetaId) ?? [];
        lista.push({ cantidad: Number(f.cantidad), precioUnidadBase: Number(f.precio) });
        lineas.set(f.recetaId, lista);
        rendimiento.set(f.recetaId, f.rendimiento === null ? null : Number(f.rendimiento));
    }

    const catalogo = await db
        .select({
            id: productos.id,
            nombre: productos.nombre,
            precio: productos.precioVenta,
            recetaId: productos.recetaId,
        })
        .from(productos);
    const porId = new Map(catalogo.map((p) => [p.id, p]));

    const margenPorProducto = porProducto.flatMap((p) => {
        const producto = porId.get(p.productoId);
        if (!producto) return [];
        const costo = producto.recetaId
            ? costoUnitario(
                  costoReceta(lineas.get(producto.recetaId) ?? []),
                  rendimiento.get(producto.recetaId) ?? null,
              )
            : 0;
        return [
            {
                id: producto.id,
                nombre: producto.nombre,
                precio: Number(p.ingreso) / Math.max(1, p.unidades) || Number(producto.precio),
                costo,
                unidades: p.unidades,
            },
        ];
    });

    const promedioSemana = Array.from({ length: 7 }, () => 0);
    for (const fila of porHoraDia) {
        const indice = Number(fila.dia) - 1;
        if (indice >= 0 && indice < 7) promedioSemana[indice] = Number(fila.total) / DIAS;
    }

    const totalVentas = Number(actual.total);
    const cantidad = Number(actual.cantidad);

    return {
        objetivoFoodCost: Number(config?.objetivo ?? 35),
        metaTicket: Number(config?.meta ?? 0),
        ventasActual: totalVentas,
        ventasPrevio: Number(previo.total),
        diasActual: DIAS,
        diasPrevio: DIAS,
        ticketActual: cantidad > 0 ? totalVentas / cantidad : 0,
        anuladas: Number(anuladas.n),
        margenPorProducto,
        canales: porCanal.map((c) => ({
            canal: c.canal,
            vendido: Number(c.vendido),
            comision: Number(c.comision),
        })),
        porDiaSemana: promedioSemana,
        cartera: tramosCartera(
            cartera.map((c) => ({ saldo: Number(c.saldo), vence: c.vence })),
        ),
        saldosClientes: topSaldos.map((s) => Number(s.saldo)),
        stockBajo: Number(stockBajo.n),
        produccionPendiente: Number(pendientes.n),
    };
}

/**
 * Recalcula el tablero completo: actualiza las alertas vigentes, marca como
 * resueltas las que dejaron de aplicar y guarda las métricas que las originan.
 */
export async function recalcularAlertas() {
    const contexto = await recolectarContexto();
    const nuevas = calcularAlertas(contexto);
    const ahora = new Date();

    await db
        .insert(alertas)
        .values(
            nuevas.map((a) => ({
                clave: a.clave,
                nivel: a.nivel,
                titulo: a.titulo,
                detalle: a.detalle,
                accion: a.accion,
                href: a.href ?? null,
                metricas: a.metricas ?? {},
                estado: "activa" as const,
                creadaEn: ahora,
                actualizadaEn: ahora,
            })),
        )
        .onConflictDoUpdate({
            target: alertas.clave,
            set: {
                nivel: sql`excluded.nivel`,
                titulo: sql`excluded.titulo`,
                detalle: sql`excluded.detalle`,
                accion: sql`excluded.accion`,
                href: sql`excluded.href`,
                metricas: sql`excluded.metricas`,
                estado: "activa",
                actualizadaEn: ahora,
            },
        });

    /* Lo que ya no aplica deja de molestar. */
    await db
        .update(alertas)
        .set({ estado: "resuelta", actualizadaEn: ahora })
        .where(
            and(
                eq(alertas.estado, "activa"),
                notInArray(
                    alertas.clave,
                    nuevas.map((a) => a.clave),
                ),
            ),
        );

    return { total: nuevas.length, actualizadaEn: ahora };
}

/** Alertas activas, recalculando si el tablero está viejo. */
export async function alertasActivas() {
    const [ultima] = await db
        .select({ cuando: sql<string | null>`max(${alertas.actualizadaEn})` })
        .from(alertas);

    const viejo =
        !ultima?.cuando || Date.now() - new Date(ultima.cuando).getTime() > VIGENCIA_MS;

    if (viejo) await recalcularAlertas();

    const filas = await db
        .select()
        .from(alertas)
        .where(eq(alertas.estado, "activa"))
        .orderBy(
            sql`case ${alertas.nivel} when 'alto' then 0 when 'medio' then 1 else 2 end`,
            desc(alertas.actualizadaEn),
        );

    const [marca] = await db
        .select({ cuando: sql<string | null>`max(${alertas.actualizadaEn})` })
        .from(alertas);

    return {
        filas,
        actualizadaEn: marca?.cuando ? new Date(marca.cuando) : null,
    };
}

export async function descartarAlerta(id: number) {
    if (!Number.isInteger(id)) return;
    await db
        .update(alertas)
        .set({ estado: "descartada", descartadaEn: new Date(), actualizadaEn: new Date() })
        .where(eq(alertas.id, id));
}


/**
 * Deja programado el recálculo para después de responder. Se llama desde las
 * acciones que mueven las cifras: la alerta cambia sola, sin esperar a que
 * alguien abra el análisis.
 */
export function programarAlertas() {
    after(async () => {
        try {
            await recalcularAlertas();
        } catch {
            /* si falla, la próxima lectura recalcula por vigencia */
        }
    });
}
