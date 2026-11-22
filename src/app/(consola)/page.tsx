import Link from "next/link";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { insumos, jornadas, producciones, productos, ventas } from "@/db/schema";
import { fechaHoraCorta, money } from "@/lib/format";
import { requireSesion } from "@/lib/auth";
import { alertasActivas } from "@/lib/alertas-server";

export const dynamic = "force-dynamic";

/** Bogotá es UTC-5 todo el año: 00:00 local = 05:00 UTC. */
const inicioDelDia = () => {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    const [y, m, d] = partes.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
};

const fechaLarga = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
});

const hora = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
});

export default async function Inicio() {
    const sesion = await requireSesion("/");
    const desde = inicioDelDia();
    const esAdmin = sesion.rol === "ADMIN";

    const [ventasHoy, abierta, ultimas, productosStock, insumosBajo, porCobrar, pendientes] =
        await Promise.all([
            db
                .select({
                    total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8`,
                    cantidad: sql<number>`count(*)::int`,
                    efectivo: sql<number>`coalesce(sum(${ventas.total}) filter (where ${ventas.formaPago} = 'EFECTIVO'), 0)::float8`,
                })
                .from(ventas)
                .where(and(eq(ventas.estado, "ACTIVA"), gte(ventas.fecha, desde))),
            db.select().from(jornadas).where(eq(jornadas.activa, true)).limit(1),
            db
                .select({
                    id: ventas.id,
                    fecha: ventas.fecha,
                    total: ventas.total,
                    formaPago: ventas.formaPago,
                    nombreCliente: ventas.nombreCliente,
                })
                .from(ventas)
                .where(eq(ventas.estado, "ACTIVA"))
                .orderBy(desc(ventas.fecha))
                .limit(7),
            db
                .select({ n: sql<number>`count(*)::int` })
                .from(productos)
                .where(
                    and(
                        eq(productos.activo, true),
                        sql`${productos.stockMinimo} is not null`,
                        sql`${productos.stockActual} <= ${productos.stockMinimo}`,
                    ),
                ),
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
                .select({ total: sql<number>`coalesce(sum(${ventas.saldo}), 0)::float8` })
                .from(ventas)
                .where(and(eq(ventas.estado, "ACTIVA"), gt(ventas.saldo, 0))),
            db
                .select({ n: sql<number>`count(*)::int` })
                .from(producciones)
                .where(eq(producciones.estado, "PENDIENTE")),
        ]);

    const alertas = esAdmin ? (await alertasActivas()).filas : [];
    const hoy = ventasHoy[0];
    const jornada = abierta[0] ?? null;
    const cobrar = porCobrar[0];
    const ticket = hoy.cantidad > 0 ? Number(hoy.total) / hoy.cantidad : 0;
    const fecha = fechaLarga.format(new Date());

    const estaciones = [
        { numero: "01", titulo: "Vender", detalle: "Armar el pedido y cobrar", href: "/pos", admin: false },
        { numero: "02", titulo: "Ventas", detalle: "Historial, recibos y anulaciones", href: "/ventas", admin: true },
        { numero: "03", titulo: "Producir", detalle: "Descontar insumos y sumar stock", href: "/producciones", admin: true },
        { numero: "04", titulo: "Insumos", detalle: "Stock, precios y lista de compra", href: "/insumos", admin: true },
        { numero: "05", titulo: "Clientes", detalle: "Fiados, abonos y cartera", href: "/clientes", admin: false },
        { numero: "06", titulo: "Analizar", detalle: "Food cost, canales y decisiones", href: "/analisis", admin: true },
    ].filter((e) => esAdmin || !e.admin);

    return (
        <div className="pizarra">
            {/* ---------------- Cabecera de la hoja ---------------- */}
            <header className="pizarra-masthead">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <p className="pizarra-kicker">Garepas Management SAS · Cartagena</p>
                    <p className="pizarra-kicker">
                        Hoja del turno {jornada ? `N° ${String(jornada.id).padStart(3, "0")}` : "sin abrir"}
                    </p>
                </div>

                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                    <h1 className="pizarra-title">LA PIZARRA</h1>
                    <p className="pb-2 text-right text-[0.6875rem] leading-relaxed tracking-[0.14em] text-ink-soft uppercase">
                        {fecha}
                        <br />
                        {jornada
                            ? `Abierta por ${jornada.abiertaPor} · ${hora.format(jornada.fechaApertura)}`
                            : "Jornada cerrada"}
                    </p>
                </div>

                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y border-line py-2">
                    <p className="text-[0.8125rem] text-ink-soft">
                        <span className="pizarra-label mr-2">Hoy</span>
                        {money(hoy.total)} en {hoy.cantidad} pedidos
                    </p>
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[0.8125rem]">
                        <Link
                            href="/pos"
                            className="font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                        >
                            Registrar venta
                        </Link>
                        {esAdmin && (
                            <Link
                                href="/analisis"
                                className="text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
                            >
                                Ver análisis
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* ---------------- Cuerpo: bitácora, balance, cocina ---------------- */}
            <div className="mt-7 grid gap-x-10 gap-y-8 lg:grid-cols-12">
                {/* Bitácora */}
                <section className="lg:col-span-4" aria-labelledby="bitacora">
                    <h2 id="bitacora" className="pizarra-label">
                        Bitácora del turno
                    </h2>
                    <div className="pizarra-rule mt-2" />

                    <ol className="pizarra-timeline mt-4">
                        <li className="pizarra-timeline-item">
                            <p className="pizarra-hora">
                                {jornada ? hora.format(jornada.fechaApertura) : "—"}
                            </p>
                            <p className="text-[0.8125rem] text-ink">
                                {jornada
                                    ? `Apertura de caja con fondo de ${money(jornada.fondoInicial)}`
                                    : "Sin apertura: la caja no puede cobrar"}
                            </p>
                        </li>
                        <li className="pizarra-timeline-item">
                            <p className="pizarra-hora">
                                {ultimas[0] ? hora.format(ultimas[0].fecha) : "—"}
                            </p>
                            <p className="text-[0.8125rem] text-ink">
                                Última venta por {money(ultimas[0]?.total ?? 0)}
                                {ultimas[0]?.nombreCliente ? ` a ${ultimas[0].nombreCliente}` : ""}
                            </p>
                        </li>
                        <li className="pizarra-timeline-item">
                            <p className="pizarra-hora">Ahora</p>
                            <p className="text-[0.8125rem] text-ink">
                                {money(hoy.efectivo)} en efectivo · ticket promedio {money(ticket)}
                            </p>
                        </li>
                        <li className="pizarra-timeline-item" data-tenue="true">
                            <p className="pizarra-hora">Cierre</p>
                            <p className="text-[0.8125rem] text-ink-soft">
                                Arqueo pendiente: contar el efectivo y registrar retiros antes de
                                cerrar el día.
                            </p>
                        </li>
                    </ol>
                </section>

                {/* Balance */}
                <section className="lg:col-span-4" aria-labelledby="balance" data-tour="hoy">
                    <h2 id="balance" className="pizarra-label">
                        Balance del día
                    </h2>
                    <div className="pizarra-rule mt-2" />

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                        <div className="col-span-2">
                            <dt className="pizarra-label">Vendido</dt>
                            <dd className="pizarra-figure mt-1">{money(hoy.total)}</dd>
                        </div>
                        <div>
                            <dt className="pizarra-label">Pedidos</dt>
                            <dd className="pizarra-figure-sm mt-1">{hoy.cantidad}</dd>
                        </div>
                        <div>
                            <dt className="pizarra-label">Ticket</dt>
                            <dd className="pizarra-figure-sm mt-1">{money(ticket)}</dd>
                        </div>
                        <div>
                            <dt className="pizarra-label">Efectivo</dt>
                            <dd className="pizarra-figure-sm mt-1">{money(hoy.efectivo)}</dd>
                        </div>
                        <div>
                            <dt className="pizarra-label">Por cobrar</dt>
                            <dd className="pizarra-figure-sm mt-1">{money(cobrar.total)}</dd>
                        </div>
                    </dl>

                    <div className="pizarra-rule mt-5" />
                    <div className="mt-3 flex items-baseline justify-between gap-3">
                        <p className="text-[0.75rem] text-ink-soft">
                            {jornada ? "La caja está abierta" : "La caja está cerrada"}
                        </p>
                        <Link
                            href="/pos"
                            className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-accent-strong hover:underline"
                        >
                            Ir a la caja <ArrowRight size={12} />
                        </Link>
                    </div>
                </section>

                {/* Cocina y bodega */}
                <section className="lg:col-span-4" aria-labelledby="cocina">
                    <h2 id="cocina" className="pizarra-label">
                        Cocina y bodega
                    </h2>
                    <div className="pizarra-rule mt-2" />

                    <ul className="mt-4 grid gap-3">
                        <li className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                            <span className="text-[0.8125rem] text-ink-soft">Insumos bajo mínimo</span>
                            <Link
                                href="/insumos?filtro=bajo"
                                className="pizarra-figure-sm hover:text-accent-strong"
                            >
                                {insumosBajo[0].n}
                            </Link>
                        </li>
                        <li className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                            <span className="text-[0.8125rem] text-ink-soft">Producción pendiente</span>
                            <Link
                                href="/producciones?estado=PENDIENTE"
                                className="pizarra-figure-sm hover:text-accent-strong"
                            >
                                {pendientes[0].n}
                            </Link>
                        </li>
                        <li className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                            <span className="text-[0.8125rem] text-ink-soft">Productos por agotarse</span>
                            <Link
                                href="/productos?filtro=bajo"
                                className="pizarra-figure-sm hover:text-accent-strong"
                            >
                                {productosStock[0].n}
                            </Link>
                        </li>
                    </ul>

                    <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-faint">
                        Una producción con insumos faltantes queda pendiente: no descuenta stock ni
                        registra gasto hasta que se re-verifique.
                    </p>
                </section>
            </div>

            {/* ---------------- Avisos ---------------- */}
            {esAdmin && alertas.length > 0 && (
                <section className="mt-9" aria-labelledby="avisos" data-tour="alertas">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 id="avisos" className="pizarra-label">
                            Avisos de la casa
                        </h2>
                        <Link
                            href="/analisis"
                            className="text-[0.75rem] text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
                        >
                            {alertas.length} activos · ver análisis
                        </Link>
                    </div>
                    <div className="pizarra-rule mt-2" />

                    <div className="mt-1 grid gap-x-10 md:grid-cols-2">
                        {alertas.slice(0, 6).map((a, indice) => (
                            <Link key={a.id} href={a.href ?? "/analisis"} className="pizarra-aviso">
                                <span className="pizarra-aviso-num">
                                    {String(indice + 1).padStart(2, "0")}
                                </span>
                                <span>
                                    <span className="pizarra-aviso-titulo block">{a.titulo}</span>
                                    <span className="block text-[0.75rem] text-ink-soft">
                                        {a.accion}
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ---------------- Estaciones ---------------- */}
            <section className="mt-10" aria-labelledby="estaciones">
                <h2 id="estaciones" className="pizarra-label">
                    Estaciones de trabajo
                </h2>
                <div className="pizarra-rule mt-2" />

                <nav aria-label="Estaciones" className="pizarra-index mt-1">
                    {estaciones.map((e) => (
                        <Link key={e.href} href={e.href}>
                            <span className="pizarra-index-num">{e.numero}</span>
                            <span>
                                <span className="pizarra-index-title block">{e.titulo}</span>
                                <span className="block text-[0.75rem] text-ink-soft">
                                    {e.detalle}
                                </span>
                            </span>
                            <ArrowRight size={15} className="text-ink-faint" />
                        </Link>
                    ))}
                </nav>
            </section>

            {/* ---------------- Movimientos ---------------- */}
            <section className="mt-10" aria-labelledby="movimientos">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="movimientos" className="pizarra-label">
                        Últimos movimientos
                    </h2>
                    {esAdmin && (
                        <Link
                            href="/ventas"
                            className="text-[0.75rem] text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
                        >
                            Historial completo
                        </Link>
                    )}
                </div>

                {ultimas.length === 0 ? (
                    <p className="mt-3 border-y border-line py-6 text-center text-[0.8125rem] text-ink-faint">
                        Todavía no hay ventas registradas.
                    </p>
                ) : (
                    <table className="pizarra-tabla mt-2">
                        <caption>Últimas ventas del negocio</caption>
                        <thead>
                            <tr>
                                <th scope="col">Venta</th>
                                <th scope="col" className="hidden sm:table-cell">
                                    Hora
                                </th>
                                <th scope="col" className="hidden sm:table-cell">
                                    Cliente
                                </th>
                                <th scope="col" className="hidden sm:table-cell">
                                    Pago
                                </th>
                                <th scope="col" className="num">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {ultimas.map((v) => (
                                <tr key={v.id}>
                                    <td>
                                        <Link
                                            href={`/ventas/${v.id}`}
                                            className="font-medium text-ink hover:text-accent hover:underline"
                                        >
                                            #{v.id}
                                        </Link>
                                    </td>
                                    <td className="hidden text-ink-soft sm:table-cell">
                                        {fechaHoraCorta(v.fecha)}
                                    </td>
                                    <td className="hidden text-ink-soft sm:table-cell">
                                        {v.nombreCliente || "Consumidor final"}
                                    </td>
                                    <td className="hidden text-ink-soft sm:table-cell">
                                        {v.formaPago.toLowerCase()}
                                    </td>
                                    <td className="num font-medium">{money(v.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <footer className="pizarra-pie">
                <span>Garepas Management SAS · Cartagena</span>
                <span>
                    {esAdmin ? "Administración" : "Caja"} · {sesion.username} · datos en vivo
                </span>
            </footer>
        </div>
    );
}
