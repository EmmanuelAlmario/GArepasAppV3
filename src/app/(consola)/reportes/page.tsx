import Link from "next/link";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { detalleVentas, gastos, jornadas, productos, ventas } from "@/db/schema";
import { fechaHoraCorta, money } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import StatCard from "@/components/ui/stat-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes" };

/* Bogotá es UTC-5 todo el año: el día local empieza a las 05:00 UTC. */
const hoyBogota = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

const esFecha = (valor: string | undefined): valor is string => {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const fecha = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
};

const sumarDias = (iso: string, dias: number) => {
    const fecha = new Date(`${iso}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
};

/** dd/mm/aaaa sin pasar por Date (evita el corrimiento de zona). */
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

const ETIQUETAS_GASTO: Record<string, string> = {
    MATERIA_PRIMA: "Materia prima",
    SERVICIOS: "Servicios",
    TRANSPORTE: "Transporte",
    EQUIPAMIENTO: "Equipamiento",
    MANTENIMIENTO: "Mantenimiento",
    OTROS: "Otros",
};

const ETIQUETAS_CANAL: Record<string, string> = {
    MOSTRADOR: "Mostrador / carrito",
    WHATSAPP: "WhatsApp",
    APP: "App de domicilios",
    EVENTO: "Evento",
    RETAIL: "Retail (para hacer en casa)",
};

const ETIQUETAS_PAGO: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    CREDITO: "Crédito",
};

const RANGOS = [
    { clave: "hoy", etiqueta: "Hoy" },
    { clave: "7d", etiqueta: "7 días" },
    { clave: "mes", etiqueta: "Mes" },
    { clave: "anio", etiqueta: "Año" },
] as const;

/** Ancho relativo de las barras CSS (sin librerías de gráficos). */
const ancho = (valor: number, maximo: number) =>
    maximo > 0 ? Math.max(0, Math.min(100, Math.round((valor / maximo) * 100))) : 0;

export default async function PaginaReportes({
    searchParams,
}: {
    searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
    await requireAdmin("/reportes");
    const { rango, desde, hasta } = await searchParams;

    const hoy = hoyBogota();
    const rangoValido = RANGOS.some((r) => r.clave === rango);
    const rangoActivo = rangoValido ? rango! : esFecha(desde) ? "custom" : "mes";

    let ini: string;
    let fin: string;
    switch (rangoActivo) {
        case "hoy":
            ini = hoy;
            fin = hoy;
            break;
        case "anio":
            ini = `${hoy.slice(0, 4)}-01-01`;
            fin = hoy;
            break;
        case "custom":
            ini = esFecha(desde) ? desde : sumarDias(hoy, -6);
            fin = esFecha(hasta) ? hasta : hoy;
            break;
        case "7d":
            ini = sumarDias(hoy, -6);
            fin = hoy;
            break;
        default:
            ini = `${hoy.slice(0, 7)}-01`;
            fin = hoy;
    }

    // Misma tolerancia del servicio Java: no hay futuro y el rango nunca se invierte.
    if (fin > hoy) fin = hoy;
    if (ini > fin) ini = sumarDias(fin, -6);

    const inicio = new Date(`${ini}T00:00:00-05:00`);
    const cierre = new Date(`${sumarDias(fin, 1)}T00:00:00-05:00`);

    const enRango = and(
        eq(ventas.estado, "ACTIVA"),
        gte(ventas.fecha, inicio),
        lt(ventas.fecha, cierre),
    );

    const [[resumenVentas], porCategoria, topProductos, porFormaPago, cierres, porCanal] =
        await Promise.all([
        db
            .select({
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                cantidad: sql<number>`count(*)::int`,
            })
            .from(ventas)
            .where(enRango),
        db
            .select({
                categoria: gastos.categoria,
                total: sql<number>`coalesce(sum(${gastos.monto}), 0)::float8`,
            })
            .from(gastos)
            .where(and(gte(gastos.fecha, inicio), lt(gastos.fecha, cierre)))
            .groupBy(gastos.categoria)
            .orderBy(desc(sql`sum(${gastos.monto})`)),
        db
            .select({
                id: productos.id,
                nombre: productos.nombre,
                unidades: sql<number>`sum(${detalleVentas.cantidad})::int`,
                ingreso: sql<number>`coalesce(sum(${detalleVentas.subtotal}), 0)::float8`,
            })
            .from(detalleVentas)
            .innerJoin(ventas, eq(detalleVentas.ventaId, ventas.id))
            .innerJoin(productos, eq(detalleVentas.productoId, productos.id))
            .where(enRango)
            .groupBy(productos.id, productos.nombre)
            .orderBy(desc(sql`sum(${detalleVentas.cantidad})`))
            .limit(5),
        db
            .select({
                formaPago: ventas.formaPago,
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                cantidad: sql<number>`count(*)::int`,
            })
            .from(ventas)
            .where(enRango)
            .groupBy(ventas.formaPago)
            .orderBy(desc(sql`sum(${ventas.total})`)),
        db
            .select({
                id: jornadas.id,
                fechaCierre: jornadas.fechaCierre,
                cerradaPor: jornadas.cerradaPor,
                fondoInicial: jornadas.fondoInicial,
                efectivoContado: jornadas.efectivoContado,
                diferencia: jornadas.diferencia,
                notas: jornadas.notas,
            })
            .from(jornadas)
            .where(
                and(
                    eq(jornadas.activa, false),
                    gte(jornadas.fechaCierre, inicio),
                    lt(jornadas.fechaCierre, cierre),
                ),
            )
            .orderBy(desc(jornadas.fechaCierre))
            .limit(30),
        db
            .select({
                canal: ventas.canal,
                total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                comision: sql<number>`coalesce(sum(${ventas.total} * ${ventas.comisionPct} / 100), 0)::float8`,
                cantidad: sql<number>`count(*)::int`,
            })
            .from(ventas)
            .where(enRango)
            .groupBy(ventas.canal)
            .orderBy(desc(sql`sum(${ventas.total})`)),
    ]);

    const ingresoTotal = Number(resumenVentas.total);
    const cantidadVentas = Number(resumenVentas.cantidad);
    const gastoTotal = porCategoria.reduce((suma, g) => suma + Number(g.total), 0);
    const utilidad = ingresoTotal - gastoTotal;
    const margen = ingresoTotal > 0 ? (utilidad / ingresoTotal) * 100 : 0;
    const ticket = cantidadVentas > 0 ? ingresoTotal / cantidadVentas : 0;

    const maxGasto = Math.max(0, ...porCategoria.map((g) => Number(g.total)));
    const maxCanal = Math.max(0, ...porCanal.map((c) => Number(c.total)));
    const maxProducto = Math.max(0, ...topProductos.map((p) => Number(p.ingreso)));
    const maxPago = Math.max(0, ...porFormaPago.map((p) => Number(p.total)));

    return (
        <div className="page">
            <header className="mb-5">
                <h1 className="page-title">
                    Reportes
                </h1>
                <p className="text-sm text-ink-soft">
                    Ingresos, gastos y utilidad del periodo. Solo cuentan las ventas activas.
                </p>
            </header>

            <div className="card mb-4 p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <span className="label">Rango</span>
                        <div className="segmented">
                            {RANGOS.map((r) => (
                                <Link
                                    key={r.clave}
                                    href={`/reportes?rango=${r.clave}`}
                                    aria-current={rangoActivo === r.clave ? "page" : undefined}
                                >
                                    {r.etiqueta}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <form method="get" className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="rango" value="custom" />
                        <div>
                            <label className="label" htmlFor="desde">
                                Desde
                            </label>
                            <input
                                className="input min-h-11"
                                type="date"
                                id="desde"
                                name="desde"
                                defaultValue={ini}
                            />
                        </div>
                        <div>
                            <label className="label" htmlFor="hasta">
                                Hasta
                            </label>
                            <input
                                className="input min-h-11"
                                type="date"
                                id="hasta"
                                name="hasta"
                                defaultValue={fin}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                        >
                            Aplicar rango
                        </button>
                    </form>
                </div>

                <p className="mt-3 text-xs text-ink-faint">
                    Mostrando del {fechaCorta(ini)} al {fechaCorta(fin)} (hora de Bogotá, día final
                    completo).
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    etiqueta="Ventas"
                    valor={ingresoTotal}
                    formato="dinero"
                    detalle={`${cantidadVentas} ${cantidadVentas === 1 ? "venta" : "ventas"} · ticket ${money(ticket)}`}
                />
                <StatCard
                    etiqueta="Gastos"
                    valor={gastoTotal}
                    formato="dinero"
                    detalle="Materia prima y gastos operativos"
                />
                <StatCard
                    etiqueta="Utilidad"
                    valor={utilidad}
                    formato="dinero"
                    detalle={utilidad < 0 ? "Pérdida del periodo" : "Ingresos menos gastos"}
                />
                <StatCard
                    etiqueta="Margen"
                    valor={margen}
                    formato="decimal"
                    sufijo="%"
                    detalle="Sobre los ingresos del periodo"
                />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="card p-4" aria-labelledby="top-productos">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h2
                            id="top-productos"
                            className="text-2xl tracking-[.04em] text-ink"
                        >
                            Top 5 productos
                        </h2>
                        <span className="text-xs text-ink-faint">Por unidades</span>
                    </div>

                    {topProductos.length === 0 ? (
                        <p className="py-6 text-center text-sm text-ink-faint">
                            Sin ventas en el rango. Cuando registres ventas aparecerán aquí.
                        </p>
                    ) : (
                        <ul className="grid gap-3">
                            {topProductos.map((p) => {
                                const ingreso = Number(p.ingreso);
                                const unidades = Number(p.unidades);
                                return (
                                    <li key={p.id}>
                                        <div className="flex items-baseline justify-between gap-3 text-sm">
                                            <span className="truncate text-ink">{p.nombre}</span>
                                            <span className="shrink-0 tabular-nums text-ink">
                                                {money(ingreso)}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                                            <div
                                                className="h-full rounded-full bg-accent"
                                                style={{ width: `${ancho(ingreso, maxProducto)}%` }}
                                            />
                                        </div>
                                        <p className="mt-0.5 text-xs text-ink-faint">
                                            {unidades} {unidades === 1 ? "unidad" : "unidades"}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section className="card p-4" aria-labelledby="gastos-categoria">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h2
                            id="gastos-categoria"
                            className="text-2xl tracking-[.04em] text-ink"
                        >
                            Gastos por categoría
                        </h2>
                        <span className="text-xs text-ink-faint">Del periodo</span>
                    </div>

                    {porCategoria.length === 0 ? (
                        <p className="py-6 text-center text-sm text-ink-faint">
                            Sin gastos en el rango. La materia prima se descuenta del margen.
                        </p>
                    ) : (
                        <ul className="grid gap-3">
                            {porCategoria.map((g) => {
                                const total = Number(g.total);
                                return (
                                    <li key={g.categoria}>
                                        <div className="flex items-baseline justify-between gap-3 text-sm">
                                            <span className="truncate text-ink">
                                                {ETIQUETAS_GASTO[g.categoria] ?? g.categoria}
                                            </span>
                                            <span className="shrink-0 tabular-nums text-ink">
                                                {money(total)}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                                            <div
                                                className="h-full rounded-full bg-chart-alt"
                                                style={{ width: `${ancho(total, maxGasto)}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>

            <section className="card mt-4 p-4" aria-labelledby="formas-pago">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h2
                        id="formas-pago"
                        className="text-2xl tracking-[.04em] text-ink"
                    >
                        Ventas por forma de pago
                    </h2>
                    <span className="text-xs text-ink-faint">
                        Los abonos no suman ingreso: solo reducen saldo
                    </span>
                </div>

                {porFormaPago.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-faint">Sin ventas en el rango.</p>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {porFormaPago.map((p) => {
                            const total = Number(p.total);
                            const cantidad = Number(p.cantidad);
                            return (
                                <li key={p.formaPago}>
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="text-ink">
                                            {ETIQUETAS_PAGO[p.formaPago] ?? p.formaPago}
                                            <span className="ml-1.5 text-xs text-ink-faint">
                                                ({cantidad})
                                            </span>
                                        </span>
                                        <span className="shrink-0 tabular-nums text-ink">
                                            {money(total)}
                                        </span>
                                    </div>
                                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                                        <div
                                            className="h-full rounded-full bg-accent"
                                            style={{ width: `${ancho(total, maxPago)}%` }}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="card mt-4" aria-labelledby="ventas-canal">
                <div className="panel-head">
                    <h2 id="ventas-canal" className="section-title">
                        Ventas por canal
                    </h2>
                    <span className="text-xs text-ink-faint">
                        Comisión descontada = lo que realmente entra
                    </span>
                </div>

                {porCanal.length === 0 ? (
                    <div className="empty">
                        <p className="empty-title">Sin ventas en el rango</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <caption>Ventas por canal con comisión</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Canal</th>
                                    <th scope="col" className="num">Pedidos</th>
                                    <th scope="col" className="num">Vendido</th>
                                    <th scope="col" className="num">Comisión</th>
                                    <th scope="col" className="num">Neto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {porCanal.map((c) => {
                                    const total = Number(c.total);
                                    const comision = Number(c.comision);
                                    return (
                                        <tr key={c.canal}>
                                            <td className="text-ink">
                                                {ETIQUETAS_CANAL[c.canal] ?? c.canal}
                                            </td>
                                            <td className="num text-ink-soft">{c.cantidad}</td>
                                            <td className="num">{money(total)}</td>
                                            <td className="num text-ink-soft">
                                                {comision > 0 ? `−${money(comision)}` : "—"}
                                            </td>
                                            <td className="num font-medium">{money(total - comision)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
