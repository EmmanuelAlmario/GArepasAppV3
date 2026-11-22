import Link from "next/link";
import { and, count, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { ESTADOS_VENTA, FORMAS_PAGO, detalleVentas, productos, ventas } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import { fechaHoraCorta, money } from "@/lib/format";
import { anularVenta } from "@/app/actions/ventas";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import Modal from "@/components/ui/modal";
import FormularioCobro from "@/components/pos/formulario-cobro";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ventas" };

const POR_PAGINA = 20;

const ETIQUETAS_PAGO: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    CREDITO: "Crédito",
};

const esEstado = (valor: string | undefined): valor is (typeof ESTADOS_VENTA)[number] =>
    Boolean(valor) && (ESTADOS_VENTA as readonly string[]).includes(valor as string);

const esForma = (valor: string | undefined): valor is (typeof FORMAS_PAGO)[number] =>
    Boolean(valor) && (FORMAS_PAGO as readonly string[]).includes(valor as string);

/** Bogotá es UTC-5 todo el año: el día local empieza a las 05:00 UTC. */
function limite(valor: string | undefined, finDelDia: boolean): Date | null {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
    const fecha = new Date(`${valor}T${finDelDia ? "23:59:59.999" : "00:00:00.000"}-05:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

type Busqueda = {
    desde?: string;
    hasta?: string;
    estado?: string;
    formaPago?: string;
    page?: string;
};

export default async function PaginaVentas({
    searchParams,
}: {
    searchParams: Promise<Busqueda>;
}) {
    await requireSesion("/ventas");
    const filtros = await searchParams;

    const estado = esEstado(filtros.estado) ? filtros.estado : undefined;
    const formaPago = esForma(filtros.formaPago) ? filtros.formaPago : undefined;
    const desde = limite(filtros.desde, false);
    const hasta = limite(filtros.hasta, true);

    const condiciones: SQL[] = [];
    if (estado) condiciones.push(eq(ventas.estado, estado));
    if (formaPago) condiciones.push(eq(ventas.formaPago, formaPago));
    if (desde) condiciones.push(gte(ventas.fecha, desde));
    if (hasta) condiciones.push(lte(ventas.fecha, hasta));
    const where = condiciones.length ? and(...condiciones) : undefined;

    const paginaPedida = Number(filtros.page ?? "1");
    const pagina = Number.isInteger(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

    const [[conteo], filas] = await Promise.all([
        db.select({ n: count() }).from(ventas).where(where),
        db
            .select({
                id: ventas.id,
                fecha: ventas.fecha,
                total: ventas.total,
                saldo: ventas.saldo,
                formaPago: ventas.formaPago,
                estado: ventas.estado,
                nombreCliente: ventas.nombreCliente,
            })
            .from(ventas)
            .where(where)
            .orderBy(desc(ventas.fecha), desc(ventas.id))
            .limit(POR_PAGINA)
            .offset((pagina - 1) * POR_PAGINA),
    ]);

    const total = Number(conteo?.n ?? 0);
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const ids = filas.map((v) => v.id);
    const detalles = ids.length
        ? await db
              .select({
                  ventaId: detalleVentas.ventaId,
                  cantidad: detalleVentas.cantidad,
                  nombre: productos.nombre,
              })
              .from(detalleVentas)
              .innerJoin(productos, eq(detalleVentas.productoId, productos.id))
              .where(inArray(detalleVentas.ventaId, ids))
        : [];

    const porVenta = new Map<number, string[]>();
    for (const d of detalles) {
        const lista = porVenta.get(d.ventaId) ?? [];
        lista.push(`${d.nombre} ×${d.cantidad}`);
        porVenta.set(d.ventaId, lista);
    }

    const hayFiltros = Boolean(
        estado || formaPago || filtros.desde || filtros.hasta,
    );
    const enlace = (cambios: Partial<Busqueda>) => {
        const params = new URLSearchParams();
        const valores = { ...filtros, ...cambios };
        for (const [clave, valor] of Object.entries(valores)) {
            if (valor) params.set(clave, valor);
        }
        const query = params.toString();
        return `/ventas${query ? `?${query}` : ""}`;
    };

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Ventas</h1>
                    <p className="text-sm text-ink-soft">
                        Historial de ventas. Las anuladas se conservan pero no cuentan en los
                        reportes.
                    </p>
                </div>
                <Link
                    href="/pos"
                    className="btn btn-primary"
                >
                    <Plus size={16} /> Nueva venta
                </Link>
            </header>

            <form
                method="get"
                action="/ventas"
                className="filters mb-4"
            >
                <div>
                    <label className="label" htmlFor="desde">
                        Desde
                    </label>
                    <input
                        className="input min-h-11"
                        id="desde"
                        name="desde"
                        type="date"
                        defaultValue={filtros.desde ?? ""}
                    />
                </div>
                <div>
                    <label className="label" htmlFor="hasta">
                        Hasta
                    </label>
                    <input
                        className="input min-h-11"
                        id="hasta"
                        name="hasta"
                        type="date"
                        defaultValue={filtros.hasta ?? ""}
                    />
                </div>
                <div>
                    <label className="label" htmlFor="estado">
                        Estado
                    </label>
                    <select
                        className="input min-h-11"
                        id="estado"
                        name="estado"
                        defaultValue={estado ?? ""}
                    >
                        <option value="">Todas</option>
                        <option value="ACTIVA">Activas</option>
                        <option value="ANULADA">Anuladas</option>
                    </select>
                </div>
                <div>
                    <label className="label" htmlFor="formaPago">
                        Forma de pago
                    </label>
                    <select
                        className="input min-h-11"
                        id="formaPago"
                        name="formaPago"
                        defaultValue={formaPago ?? ""}
                    >
                        <option value="">Todas</option>
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TARJETA">Tarjeta</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                        <option value="CREDITO">Crédito</option>
                    </select>
                </div>
                <div className="flex items-end gap-2">
                    <button
                        type="submit"
                        className="btn btn-primary"
                    >
                        Filtrar
                    </button>
                    {hayFiltros && (
                        <Link
                            href="/ventas"
                            className="btn btn-secondary"
                        >
                            Limpiar
                        </Link>
                    )}
                </div>
            </form>

            <p className="mb-2 text-xs text-ink-faint">
                {total} venta(s) · página {Math.min(pagina, totalPaginas)} de {totalPaginas}
            </p>

            {filas.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    {hayFiltros
                        ? "Sin resultados para estos filtros."
                        : "No hay ventas registradas todavía."}
                </p>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="table">
                        <caption className="sr-only">
                            Ventas registradas, de la más reciente a la más antigua
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-3 py-2.5 font-medium">#</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Fecha</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Cliente</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Productos</th>
                                <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Pago</th>
                                <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                                <th scope="col" className="px-3 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((v) => {
                                const activa = v.estado === "ACTIVA";
                                const pendiente = Number(v.saldo) > 0;
                                return (
                                    <tr key={v.id} className={activa ? "" : "opacity-60"}>
                                        <td className="px-3 py-2.5 tabular-nums">
                                            <Link
                                                href={`/ventas/${v.id}`}
                                                className="font-medium text-accent hover:underline"
                                            >
                                                #{v.id}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2.5 text-ink-soft">
                                            {fechaHoraCorta(v.fecha)}
                                        </td>
                                        <td className="px-3 py-2.5 text-ink">
                                            {v.nombreCliente ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-ink-soft">
                                            {(porVenta.get(v.id) ?? []).join(", ") || "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            {money(v.total)}
                                            {pendiente && activa && (
                                                <div className="text-xs font-medium text-danger">
                                                    Debe {money(v.saldo)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="badge">
                                                {ETIQUETAS_PAGO[v.formaPago] ?? v.formaPago}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    activa
                                                        ? "bg-success-tint text-success"
                                                        : "bg-surface-sunken text-ink-soft"
                                                }`}
                                            >
                                                {activa ? "Activa" : "Anulada"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/ventas/${v.id}`}
                                                    className="rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-surface-muted"
                                                >
                                                    Recibo
                                                </Link>
                                                {activa && pendiente && (
                                                    <Modal
                                                        etiqueta="Cobrar"
                                                        titulo={`Cobrar saldo de la venta #${v.id}`}
                                                        descripcion={`Saldo pendiente: ${money(v.saldo)}`}
                                                        ancho="sm"
                                                        compacto
                                                    >
                                                        <FormularioCobro
                                                            ventaId={v.id}
                                                            saldo={Number(v.saldo)}
                                                            puedeCobrar
                                                        />
                                                    </Modal>
                                                )}
                                                {activa && !pendiente && (
                                                    <ModalConfirmar
                                                        accion={anularVenta}
                                                        campos={{ id: v.id }}
                                                        etiqueta="Anular"
                                                        titulo={`Anular la venta #${v.id}`}
                                                        descripcion="Devuelve el stock de los productos y la saca de los reportes. Solo se permite si no tiene saldo pendiente."
                                                        confirmar="Anular venta"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPaginas > 1 && (
                <nav
                    aria-label="Paginación de ventas"
                    className="mt-3 flex items-center justify-center gap-2 text-sm"
                >
                    {pagina > 1 ? (
                        <Link
                            href={enlace({ page: String(pagina - 1) })}
                            className="btn btn-secondary"
                        >
                            Anterior
                        </Link>
                    ) : (
                        <span className="flex min-h-11 items-center rounded-lg border border-line px-3 text-ink-faint">
                            Anterior
                        </span>
                    )}
                    <span className="text-xs text-ink-soft">
                        {Math.min(pagina, totalPaginas)} / {totalPaginas}
                    </span>
                    {pagina < totalPaginas ? (
                        <Link
                            href={enlace({ page: String(pagina + 1) })}
                            className="btn btn-secondary"
                        >
                            Siguiente
                        </Link>
                    ) : (
                        <span className="flex min-h-11 items-center rounded-lg border border-line px-3 text-ink-faint">
                            Siguiente
                        </span>
                    )}
                </nav>
            )}
        </div>
    );
}
