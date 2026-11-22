import Link from "next/link";
import { and, desc, eq, gte, lt, sql, type SQLWrapper } from "drizzle-orm";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import { db } from "@/db";
import { detalleRecetas, detalleVentas, gastos, insumos, productos, recetas, ventas } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { money, moneyFino } from "@/lib/format";
import {
    completarSerie,
    concentracion,
    foodCost,
    mediaMovil,
    precioSugerido,
    tramosCartera,
    variacion,
} from "@/lib/analitica";
import { alertasActivas } from "@/lib/alertas-server";
import { aplicarPrecioSugerido, descartar, recalcularAhora } from "@/app/actions/alertas";
import { costoReceta, costoUnitario } from "@/lib/costos";
import SerieLinea from "@/components/charts/serie-linea";
import BarrasComparadas from "@/components/charts/barras-comparadas";
import MapaCalor from "@/components/charts/mapa-calor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Análisis" };

const DIAS = [7, 30, 90] as const;
const NOMBRES_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HORAS = Array.from({ length: 13 }, (_, i) => 9 + i); // 9:00 a 21:00

/** Bogotá es UTC-5: se resta para agrupar por día y hora locales. */
const local = (columna: SQLWrapper) => sql`(${columna} - interval '5 hours')`;

export default async function PaginaAnalisis({
    searchParams,
}: {
    searchParams: Promise<{ dias?: string }>;
}) {
    await requireAdmin("/analisis");
    const { dias: diasCrudo } = await searchParams;
    const dias = DIAS.includes(Number(diasCrudo) as (typeof DIAS)[number])
        ? Number(diasCrudo)
        : 30;

    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * 86_400_000);
    const desdePrevio = new Date(desde.getTime() - dias * 86_400_000);

    const [
        [actual],
        [previo],
        serieVentas,
        serieGastos,
        porCanal,
        porProducto,
        costos,
        porHoraDia,
        cartera,
        topSaldos,
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
            .select({
                dia: sql<string>`to_char(${local(ventas.fecha)}, 'YYYY-MM-DD')`,
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde)))
            .groupBy(sql`1`)
            .orderBy(sql`1`),
        db
            .select({
                dia: sql<string>`to_char(${local(gastos.fecha)}, 'YYYY-MM-DD')`,
                total: sql<number>`coalesce(sum(${gastos.monto}), 0)::float8`,
            })
            .from(gastos)
            .where(gte(gastos.fecha, desde))
            .groupBy(sql`1`)
            .orderBy(sql`1`),
        db
            .select({
                canal: ventas.canal,
                vendido: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                comision: sql<number>`coalesce(sum(${ventas.total} * ${ventas.comisionPct} / 100), 0)::float8`,
                pedidos: sql<number>`count(*)::int`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde)))
            .groupBy(ventas.canal)
            .orderBy(desc(sql`sum(${ventas.total})`)),
        db
            .select({
                productoId: detalleVentas.productoId,
                nombre: productos.nombre,
                unidades: sql<number>`sum(${detalleVentas.cantidad})::int`,
                ingreso: sql<number>`sum(${detalleVentas.cantidad} * ${detalleVentas.precioUnitario})::float8`,
            })
            .from(detalleVentas)
            .innerJoin(ventas, eq(detalleVentas.ventaId, ventas.id))
            .innerJoin(productos, eq(detalleVentas.productoId, productos.id))
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde)))
            .groupBy(detalleVentas.productoId, productos.nombre)
            .orderBy(desc(sql`sum(${detalleVentas.cantidad} * ${detalleVentas.precioUnitario})`)),
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
                dia: sql<number>`extract(isodow from ${local(ventas.fecha)})::int`,
                hora: sql<number>`extract(hour from ${local(ventas.fecha)})::int`,
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde)))
            .groupBy(sql`1`, sql`2`),
        db
            .select({ saldo: ventas.saldo, vence: ventas.fechaVencimiento })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), sql`${ventas.saldo} > 0`)),
        db
            .select({
                nombre: ventas.nombreCliente,
                saldo: sql<number>`sum(${ventas.saldo})::float8`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), sql`${ventas.saldo} > 0`))
            .groupBy(ventas.nombreCliente)
            .orderBy(desc(sql`sum(${ventas.saldo})`))
            .limit(5),
    ]);

    const [anuladas] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(ventas)
        .where(and(eq(ventas.estado, "ANULADA"), gte(ventas.fecha, desde)));

    /* ---------- Series ---------- */
    const serie = completarSerie(serieVentas, desde, hasta);
    const serieGasto = completarSerie(serieGastos, desde, hasta);
    const suavizada = mediaMovil(
        serie.map((p) => p.valor),
        dias <= 7 ? 3 : 7,
    );

    const gastosPorDia = new Map(serieGasto.map((p) => [p.etiqueta, p.valor]));
    const comparada = serie.map((p) => ({
        etiqueta: p.etiqueta,
        a: p.valor,
        b: gastosPorDia.get(p.etiqueta) ?? 0,
    }));

    const totalVentas = Number(actual.total);
    const totalPrevio = Number(previo.total);
    const cantidad = Number(actual.cantidad);
    const cantidadPrevia = Number(previo.cantidad);
    const ticket = cantidad > 0 ? totalVentas / cantidad : 0;
    const ticketPrevio = cantidadPrevia > 0 ? totalPrevio / cantidadPrevia : 0;

    /* ---------- Costos por producto ---------- */
    const lineasPorReceta = new Map<number, Array<{ cantidad: number; precioUnidadBase: number }>>();
    const rendimientoPorReceta = new Map<number, number | null>();
    for (const l of costos) {
        const lista = lineasPorReceta.get(l.recetaId) ?? [];
        lista.push({ cantidad: Number(l.cantidad), precioUnidadBase: Number(l.precio) });
        lineasPorReceta.set(l.recetaId, lista);
        rendimientoPorReceta.set(l.recetaId, l.rendimiento === null ? null : Number(l.rendimiento));
    }

    const costoProducto = new Map<number, number>();
    const filasProducto = await db
        .select({ id: productos.id, nombre: productos.nombre, precio: productos.precioVenta, recetaId: productos.recetaId })
        .from(productos);
    for (const p of filasProducto) {
        if (!p.recetaId) continue;
        const lineas = lineasPorReceta.get(p.recetaId) ?? [];
        costoProducto.set(
            p.id,
            costoUnitario(costoReceta(lineas), rendimientoPorReceta.get(p.recetaId) ?? null),
        );
    }

    const margenProductos = porProducto.map((p) => {
        const costo = costoProducto.get(p.productoId) ?? 0;
        const precio = Number(p.ingreso) / Math.max(1, p.unidades);
        return {
            nombre: p.nombre,
            unidades: p.unidades,
            ingreso: Number(p.ingreso),
            precio,
            costo,
            margen: (precio - costo) * p.unidades,
            fc: foodCost(costo, precio),
            sugerido: precioSugerido(costo, 0.35),
        };
    });

    /* ---------- Horarios ---------- */
    const matriz = NOMBRES_DIA.map(() => HORAS.map(() => 0));
    for (const f of porHoraDia) {
        const fila = Number(f.dia) - 1;
        const columna = HORAS.indexOf(Number(f.hora));
        if (fila >= 0 && fila < 7 && columna >= 0) matriz[fila][columna] = Number(f.total);
    }
    const promedioDiaSemana = matriz.map((fila) => fila.reduce((a, b) => a + b, 0) / dias);

    /* ---------- Cartera ---------- */
    const tramos = tramosCartera(
        cartera.map((c) => ({ saldo: Number(c.saldo), vence: c.vence })),
    );
    const saldos = topSaldos.map((c) => Number(c.saldo));

    /* ---------- Alertas del motor (persistidas y recalculadas solas) ---------- */
    const { filas: listaAlertas, actualizadaEn } = await alertasActivas();

    const haceCuanto = actualizadaEn
        ? (() => {
              const minutos = Math.floor((Date.now() - actualizadaEn.getTime()) / 60000);
              if (minutos < 1) return "hace segundos";
              if (minutos < 60) return `hace ${minutos} min`;
              return `hace ${Math.floor(minutos / 60)} h`;
          })()
        : "sin calcular";

    const delta = (valor: number | null) => {
        if (valor === null) return null;
        const Icono = valor > 1 ? ArrowUpRight : valor < -1 ? ArrowDownRight : Minus;
        return { Icono, texto: `${valor > 0 ? "+" : ""}${valor.toFixed(0)}%`, sube: valor > 1, baja: valor < -1 };
    };

    const variacionVentas = delta(variacion(totalVentas, totalPrevio));
    const variacionTicket = delta(variacion(ticket, ticketPrevio));
    const variacionPedidos = delta(variacion(cantidad, cantidadPrevia));

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Análisis</h1>
                    <p className="page-sub">
                        Qué está pasando con el negocio y qué hacer con eso. Solo ventas activas.
                    </p>
                </div>
                <div className="segmented">
                    {DIAS.map((d) => (
                        <Link key={d} href={`/analisis?dias=${d}`} aria-current={dias === d ? "page" : undefined}>
                            {d} días
                        </Link>
                    ))}
                </div>
            </header>

            {/* ---------- Cifras con variación ---------- */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { titulo: "Vendido", valor: money(totalVentas), delta: variacionVentas },
                    { titulo: "Pedidos", valor: String(cantidad), delta: variacionPedidos },
                    { titulo: "Ticket promedio", valor: money(ticket), delta: variacionTicket },
                    { titulo: "Anuladas", valor: String(anuladas.n), delta: null },
                ].map((k) => (
                    <div key={k.titulo} className="stat">
                        <span className="stat-label">{k.titulo}</span>
                        <span className="stat-value">{k.valor}</span>
                        {k.delta ? (
                            <span
                                className={`inline-flex items-center gap-1 text-xs ${
                                    k.delta.sube
                                        ? "text-success"
                                        : k.delta.baja
                                          ? "text-danger"
                                          : "text-ink-faint"
                                }`}
                            >
                                <k.delta.Icono size={12} /> {k.delta.texto} vs periodo anterior
                            </span>
                        ) : (
                            <span className="stat-detail">del periodo</span>
                        )}
                    </div>
                ))}
            </div>

            {/* ---------- Alertas automáticas ---------- */}
            <section className="mt-5" aria-labelledby="recomendaciones" data-tour="decisiones">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-accent" />
                        <h2 id="recomendaciones" className="section-title">
                            Decisiones automáticas
                        </h2>
                        <span className="text-xs text-ink-faint">
                            {listaAlertas.length} activas · {haceCuanto}
                        </span>
                    </div>
                    <form action={recalcularAhora}>
                        <button type="submit" className="btn btn-secondary btn-sm">
                            Recalcular ahora
                        </button>
                    </form>
                </div>

                <div className="grid gap-2 lg:grid-cols-2">
                    {listaAlertas.map((i) => {
                        const metricas = (i.metricas ?? {}) as Record<string, number | string>;
                        const aplicable = Number(metricas.aplicable ?? 0) === 1;
                        return (
                            <article
                                key={i.clave}
                                className="card border-l-4 p-3"
                                style={{
                                    borderLeftColor:
                                        i.nivel === "alto"
                                            ? "var(--ga-danger)"
                                            : i.nivel === "medio"
                                              ? "var(--ga-warning)"
                                              : "var(--ga-accent)",
                                }}
                            >
                                <div className="flex items-start gap-2">
                                    <AlertTriangle
                                        size={14}
                                        className={`mt-0.5 shrink-0 ${
                                            i.nivel === "alto"
                                                ? "text-danger"
                                                : i.nivel === "medio"
                                                  ? "text-warning"
                                                  : "text-accent"
                                        }`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[0.8125rem] font-medium text-ink">
                                            {i.titulo}
                                        </p>
                                        <p className="mt-0.5 text-xs text-ink-soft">{i.detalle}</p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <p className="text-xs font-medium text-accent-strong">
                                                → {i.accion}
                                            </p>
                                            {aplicable && (
                                                <form action={aplicarPrecioSugerido}>
                                                    <input
                                                        type="hidden"
                                                        name="productoId"
                                                        value={metricas.productoId}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="precio"
                                                        value={metricas.precioSugerido}
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="btn btn-primary btn-sm"
                                                    >
                                                        Aplicar precio
                                                    </button>
                                                </form>
                                            )}
                                            {i.href && (
                                                <Link
                                                    href={i.href}
                                                    className="text-xs text-ink-soft underline hover:text-ink"
                                                >
                                                    Ver
                                                </Link>
                                            )}
                                            <form action={descartar}>
                                                <input type="hidden" name="id" value={i.id} />
                                                <button
                                                    type="submit"
                                                    className="text-xs text-ink-faint hover:text-ink"
                                                >
                                                    Descartar
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            {/* ---------- Series ---------- */}
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <section className="card p-4" aria-labelledby="tendencia">
                    <div className="panel-head mb-2 border-0 p-0">
                        <h2 id="tendencia" className="section-title">
                            Ventas por día
                        </h2>
                        <span className="text-xs text-ink-faint">línea punteada: media móvil</span>
                    </div>
                    <SerieLinea
                        datos={serie}
                        referencia={suavizada}
                        etiquetaReferencia="Media móvil"
                        titulo="Ventas por día del periodo"
                        formato={(n) => money(n)}
                    />
                </section>

                <section className="card p-4" aria-labelledby="ingresos-gastos">
                    <div className="panel-head mb-2 border-0 p-0">
                        <h2 id="ingresos-gastos" className="section-title">
                            Ingresos vs gastos
                        </h2>
                    </div>
                    <BarrasComparadas
                        datos={comparada}
                        titulo="Ingresos y gastos por día"
                        etiquetaA="Ingresos"
                        etiquetaB="Gastos"
                        formato={(n) => money(n)}
                    />
                </section>
            </div>

            {/* ---------- Horarios ---------- */}
            <section className="card mt-4 p-4" aria-labelledby="horarios">
                <div className="panel-head mb-3 border-0 p-0">
                    <h2 id="horarios" className="section-title">
                        Cuándo se vende
                    </h2>
                    <span className="text-xs text-ink-faint">ventas por día y hora (Bogotá)</span>
                </div>
                <MapaCalor
                    filas={NOMBRES_DIA}
                    columnas={HORAS.map((h) => `${h}:00`)}
                    valores={matriz}
                    titulo="Mapa de calor de ventas por día y hora"
                    formato={(n) => money(n)}
                />
            </section>

            {/* ---------- Productos y canales ---------- */}
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                <section className="card" aria-labelledby="margen-producto">
                    <div className="panel-head">
                        <h2 id="margen-producto" className="section-title">
                            Margen por producto
                        </h2>
                        <span className="text-xs text-ink-faint">costo según receta actual</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <caption>Margen y food cost por producto</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Producto</th>
                                    <th scope="col" className="num">Unid.</th>
                                    <th scope="col" className="num">Precio</th>
                                    <th scope="col" className="num">Costo</th>
                                    <th scope="col" className="num">Food cost</th>
                                    <th scope="col" className="num">Margen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {margenProductos.map((p) => (
                                    <tr key={p.nombre}>
                                        <td className="text-ink">{p.nombre}</td>
                                        <td className="num text-ink-soft">{p.unidades}</td>
                                        <td className="num">{money(p.precio)}</td>
                                        <td className="num text-ink-soft">{moneyFino(p.costo)}</td>
                                        <td
                                            className={`num ${
                                                p.fc > 40 ? "font-medium text-danger" : "text-ink-soft"
                                            }`}
                                        >
                                            {p.fc.toFixed(0)}%
                                        </td>
                                        <td className="num font-medium">{money(p.margen)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="px-4 pb-3 text-xs text-ink-faint">
                        Food cost objetivo ≤ 35%. Con el costo actual, el precio sugerido para 35% es:
                        {" "}
                        {margenProductos
                            .map((p) => `${p.nombre} ${money(p.sugerido)}`)
                            .join(" · ")}
                    </p>
                </section>

                <div className="grid gap-4">
                    <section className="card" aria-labelledby="canales">
                        <div className="panel-head">
                            <h2 id="canales" className="section-title">
                                Canal
                            </h2>
                            <span className="text-xs text-ink-faint">neto de comisión</span>
                        </div>
                        <ul className="divide-y divide-line">
                            {porCanal.map((c) => {
                                const vendido = Number(c.vendido);
                                const comision = Number(c.comision);
                                return (
                                    <li key={c.canal} className="flex items-center justify-between px-4 py-2 text-sm">
                                        <span className="text-ink">{c.canal.toLowerCase()}</span>
                                        <span className="text-right">
                                            <span className="block num">{money(vendido - comision)}</span>
                                            <span className="block text-[11px] text-ink-faint">
                                                {money(vendido)}
                                                {comision > 0 ? ` − ${money(comision)} comisión` : ""}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    <section className="card" aria-labelledby="cartera">
                        <div className="panel-head">
                            <h2 id="cartera" className="section-title">
                                Cartera
                            </h2>
                            <span className="text-xs text-ink-faint">
                                top 3 = {concentracion(saldos).toFixed(0)}%
                            </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-y-1 px-4 py-3 text-sm">
                            <dt className="text-ink-soft">Corriente</dt>
                            <dd className="text-right num">{money(tramos.corriente)}</dd>
                            <dt className="text-ink-soft">Por vencer</dt>
                            <dd className="text-right num">{money(tramos.porVencer)}</dd>
                            <dt className="text-warning">Vencida</dt>
                            <dd className="text-right num text-warning">{money(tramos.vencida)}</dd>
                            <dt className="text-danger">+30 días</dt>
                            <dd className="text-right num text-danger">{money(tramos.critica)}</dd>
                        </dl>
                        <ul className="border-t border-line px-4 py-2">
                            {topSaldos.map((c) => (
                                <li
                                    key={c.nombre ?? "sin-nombre"}
                                    className="flex justify-between py-1 text-xs"
                                >
                                    <span className="truncate text-ink-soft">
                                        {c.nombre ?? "Consumidor final"}
                                    </span>
                                    <span className="num text-ink">{money(c.saldo)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>

            <p className="mt-4 text-xs text-ink-faint">
                Calculado con {cantidad} pedidos del periodo. Las cifras de margen usan el costo actual
                de las recetas y no descuentan mano de obra ni empaque por fuera de la receta.
            </p>
        </div>
    );
}
