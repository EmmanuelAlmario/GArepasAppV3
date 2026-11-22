import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Banknote } from "lucide-react";
import { db } from "@/db";
import {
    abonos,
    configuracionNegocio,
    detalleVentaExtras,
    detalleVentas,
    extras,
    productos,
    ventas,
} from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import Modal from "@/components/ui/modal";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import FormularioCobro from "@/components/pos/formulario-cobro";
import { fecha, fechaHoraCorta, money } from "@/lib/format";
import { anularVenta } from "@/app/actions/ventas";
import BotonImprimir from "@/components/pos/boton-imprimir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recibo" };

const ETIQUETAS_CANAL: Record<string, string> = {
    MOSTRADOR: "Mostrador / carrito",
    WHATSAPP: "WhatsApp",
    APP: "App de domicilios",
    EVENTO: "Evento",
    RETAIL: "Retail",
};

const ETIQUETAS_PAGO: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    CREDITO: "Crédito",
};

export default async function PaginaRecibo({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    await requireSesion(`/ventas/${id}`);
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [[venta], detalles, listaAbonos, config, extrasVenta] = await Promise.all([
        db.select().from(ventas).where(eq(ventas.id, numero)).limit(1),
        db
            .select({
                id: detalleVentas.id,
                cantidad: detalleVentas.cantidad,
                precioUnitario: detalleVentas.precioUnitario,
                subtotal: detalleVentas.subtotal,
                nota: detalleVentas.nota,
                nombre: productos.nombre,
            })
            .from(detalleVentas)
            .innerJoin(productos, eq(detalleVentas.productoId, productos.id))
            .where(eq(detalleVentas.ventaId, numero))
            .orderBy(asc(detalleVentas.id)),
        db
            .select()
            .from(abonos)
            .where(eq(abonos.ventaId, numero))
            .orderBy(asc(abonos.fecha)),
        db.select().from(configuracionNegocio).limit(1),
        db
            .select({
                detalleId: detalleVentaExtras.detalleVentaId,
                nombre: extras.nombre,
                cantidad: detalleVentaExtras.cantidad,
                precioUnitario: detalleVentaExtras.precioUnitario,
            })
            .from(detalleVentaExtras)
            .innerJoin(extras, eq(detalleVentaExtras.extraId, extras.id))
            .innerJoin(detalleVentas, eq(detalleVentaExtras.detalleVentaId, detalleVentas.id))
            .where(eq(detalleVentas.ventaId, numero)),
    ]);

    const extrasPorDetalle = new Map<number, typeof extrasVenta>();
    for (const extra of extrasVenta) {
        const lista = extrasPorDetalle.get(extra.detalleId) ?? [];
        lista.push(extra);
        extrasPorDetalle.set(extra.detalleId, lista);
    }

    if (!venta) notFound();

    const negocio = config[0];
    const activa = venta.estado === "ACTIVA";
    const saldo = Number(venta.saldo);
    const pendiente = activa && saldo > 0;

    return (
        <div className="mx-auto max-w-3xl">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <Link
                    href="/ventas"
                    className="btn btn-secondary"
                >
                    <ArrowLeft size={16} /> Historial
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <BotonImprimir />
                    {pendiente && (
                        <Modal
                            etiqueta="Registrar cobro"
                            titulo={`Cobrar saldo de la venta #${venta.id}`}
                            descripcion={`Saldo pendiente: ${money(saldo)}`}
                            ancho="sm"
                            icono={<Banknote size={15} />}
                        >
                            <FormularioCobro ventaId={venta.id} saldo={saldo} puedeCobrar />
                        </Modal>
                    )}
                    {activa && !pendiente && (
                        <ModalConfirmar
                            accion={anularVenta}
                            campos={{ id: venta.id }}
                            etiqueta="Anular venta"
                            titulo={`Anular la venta #${venta.id}`}
                            descripcion="Devuelve el stock y la saca de los reportes. No se puede deshacer."
                            confirmar="Anular venta"
                            compacto={false}
                        />
                    )}
                </div>
            </header>

            <article className="card mx-auto max-w-xl p-6 print:max-w-none print:border-0 print:shadow-none">
                <div className="flex items-start justify-between gap-4 border-b border-dashed border-line-strong pb-4">
                    <div className="flex items-start gap-3">
                        {negocio?.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={negocio.logoUrl}
                                alt=""
                                className="size-12 rounded-lg object-contain"
                            />
                        )}
                        <div>
                            <p className="text-2xl tracking-[.04em] text-ink">
                                {negocio?.nombreComercial ?? "Gordo Arepas"}
                            </p>
                            {negocio?.identificacionFiscal && (
                                <p className="text-xs text-ink-soft">
                                    NIT {negocio.identificacionFiscal}
                                </p>
                            )}
                            {negocio?.telefono && (
                                <p className="text-xs text-ink-soft">{negocio.telefono}</p>
                            )}
                            {negocio?.direccion && (
                                <p className="text-xs text-ink-soft">{negocio.direccion}</p>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs tracking-wide text-ink-soft uppercase">Recibo</p>
                        <p className="text-3xl text-ink">
                            #{venta.id}
                        </p>
                        <p className="text-xs text-ink-soft">{fechaHoraCorta(venta.fecha)}</p>
                        {!activa && (
                            <span className="badge mt-1">
                                ANULADA
                            </span>
                        )}
                    </div>
                </div>

                {venta.nombreCliente && (
                    <p className="border-b border-dashed border-line-strong py-3 text-sm">
                        <span className="text-xs tracking-wide text-ink-soft uppercase">
                            Cliente
                        </span>
                        <br />
                        <span className="font-medium text-ink">{venta.nombreCliente}</span>
                    </p>
                )}

                <table className="table">
                    <caption className="sr-only">Productos del recibo</caption>
                    <thead>
                        <tr className="text-left text-xs tracking-wide text-ink-soft uppercase">
                            <th scope="col" className="py-2 font-medium">Producto</th>
                            <th scope="col" className="py-2 text-right font-medium">Cant.</th>
                            <th scope="col" className="py-2 text-right font-medium">Precio</th>
                            <th scope="col" className="py-2 text-right font-medium">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detalles.map((d) => (
                            <tr key={d.id}>
                                <td className="py-2 text-ink">
                                    {d.nombre}
                                    {d.nota && (
                                        <span className="block text-xs text-ink-soft">
                                            {d.nota}
                                        </span>
                                    )}
                                    {extrasPorDetalle.get(d.id)?.map((e) => (
                                        <span
                                            key={`${d.id}-${e.nombre}`}
                                            className="block text-xs text-ink-soft"
                                        >
                                            + {e.nombre} ({money(e.precioUnitario)})
                                        </span>
                                    ))}
                                </td>
                                <td className="py-2 text-right tabular-nums">{d.cantidad}</td>
                                <td className="py-2 text-right tabular-nums">
                                    {money(d.precioUnitario)}
                                </td>
                                <td className="py-2 text-right tabular-nums">
                                    {money(d.subtotal)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <dl className="grid gap-1 border-t border-dashed border-line-strong pt-3 text-sm">
                    <div className="flex justify-between text-ink-soft">
                        <dt>Subtotal</dt>
                        <dd className="tabular-nums">{money(venta.subtotal)}</dd>
                    </div>
                    {Number(venta.impuestos) > 0 && (
                        <div className="flex justify-between text-ink-soft">
                            <dt>Impuestos</dt>
                            <dd className="tabular-nums">{money(venta.impuestos)}</dd>
                        </div>
                    )}
                    <div className="flex items-baseline justify-between border-t border-line pt-1">
                        <dt className="font-medium text-ink">Total</dt>
                        <dd className="text-2xl text-ink tabular-nums">
                            {money(venta.total)}
                        </dd>
                    </div>
                    {pendiente && (
                        <div className="flex justify-between font-medium text-danger">
                            <dt>Saldo pendiente</dt>
                            <dd className="tabular-nums">{money(saldo)}</dd>
                        </div>
                    )}
                    <div className="flex justify-between text-ink-soft">
                        <dt>Forma de pago</dt>
                        <dd>{ETIQUETAS_PAGO[venta.formaPago] ?? venta.formaPago}</dd>
                    </div>
                    {venta.efectivoRecibido !== null && (
                        <div className="flex justify-between text-ink-soft">
                            <dt>Recibido</dt>
                            <dd className="tabular-nums">{money(venta.efectivoRecibido)}</dd>
                        </div>
                    )}
                    {venta.cambio !== null && (
                        <div className="flex justify-between text-ink-soft">
                            <dt>Devuelta</dt>
                            <dd className="tabular-nums">{money(venta.cambio)}</dd>
                        </div>
                    )}
                    <div className="flex justify-between text-ink-soft">
                        <dt>Canal</dt>
                        <dd>{ETIQUETAS_CANAL[venta.canal] ?? venta.canal}</dd>
                    </div>
                    {Number(venta.comisionPct) > 0 && (
                        <div className="flex justify-between text-ink-soft">
                            <dt>Comisión app ({venta.comisionPct}%)</dt>
                            <dd className="tabular-nums">
                                −{money((Number(venta.total) * Number(venta.comisionPct)) / 100)}
                            </dd>
                        </div>
                    )}
                    {venta.fechaVencimiento && (
                        <div className="flex justify-between text-ink-soft">
                            <dt>Vence</dt>
                            <dd>{fecha(venta.fechaVencimiento)}</dd>
                        </div>
                    )}
                </dl>

                {listaAbonos.length > 0 && (
                    <section className="mt-4 border-t border-dashed border-line-strong pt-3">
                        <h2 className="section-title">
                            Abonos recibidos
                        </h2>
                        <dl className="grid gap-1 text-sm">
                            {listaAbonos.map((a) => (
                                <div key={a.id} className="flex justify-between text-ink-soft">
                                    <dt>
                                        {fecha(a.fecha)} · {ETIQUETAS_PAGO[a.metodo] ?? a.metodo}
                                        {a.nota ? ` · ${a.nota}` : ""}
                                    </dt>
                                    <dd className="tabular-nums">{money(a.monto)}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}

                {negocio?.mensajeRecibo && (
                    <p className="mt-5 border-t border-dashed border-line-strong pt-4 text-center text-sm text-ink-soft">
                        {negocio.mensajeRecibo}
                    </p>
                )}
            </article>
        </div>
    );
}
