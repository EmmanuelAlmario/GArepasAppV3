import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { abonos, detalleVentas, productos, ventas } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import { fecha, fechaHoraCorta, money } from "@/lib/format";
import { round2 } from "@/lib/num";
import FormularioCobro from "@/components/pos/formulario-cobro";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registrar cobro" };

export default async function PaginaCobrar({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    await requireSesion(`/ventas/${id}/cobrar`);
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [[venta], detalles, listaAbonos] = await Promise.all([
        db.select().from(ventas).where(eq(ventas.id, numero)).limit(1),
        db
            .select({
                id: detalleVentas.id,
                cantidad: detalleVentas.cantidad,
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
    ]);

    if (!venta) notFound();

    const saldo = Number(venta.saldo);
    const abonado = round2(Number(venta.total) - saldo);
    const puedeCobrar = venta.estado === "ACTIVA" && saldo > 0;

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Registrar cobro</h1>
                    <p className="text-sm text-ink-soft">
                        El saldo baja y el abono queda en la bitácora de la venta.
                    </p>
                </div>
                <Link
                    href="/ventas"
                    className="btn btn-secondary"
                >
                    <ArrowLeft size={16} /> Historial
                </Link>
            </header>

            {!puedeCobrar && (
                <p
                    role="status"
                    className="mb-4 rounded-lg bg-warning-tint px-3 py-2 text-sm text-ink"
                >
                    {venta.estado !== "ACTIVA"
                        ? `La venta #${venta.id} está anulada.`
                        : `La venta #${venta.id} no tiene saldo pendiente.`}
                </p>
            )}

            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <section className="card p-4" aria-labelledby="resumen-venta">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 id="resumen-venta" className="text-2xl text-ink">
                            Venta #{venta.id}
                        </h2>
                        <span className="badge">
                            {venta.formaPago === "CREDITO" ? "Crédito" : venta.formaPago}
                        </span>
                    </div>

                    <p className="text-xs tracking-wide text-ink-soft uppercase">Cliente</p>
                    <p className="mb-3 font-medium text-ink">
                        {venta.nombreCliente ?? "Consumidor final"}
                    </p>
                    <p className="text-xs text-ink-faint">{fechaHoraCorta(venta.fecha)}</p>

                    <p className="mt-4 text-xs tracking-wide text-ink-soft uppercase">Productos</p>
                    <ul className="mb-3 list-inside list-disc text-sm text-ink">
                        {detalles.map((d) => (
                            <li key={d.id}>
                                {d.nombre} ×{d.cantidad}
                            </li>
                        ))}
                    </ul>

                    <dl className="grid gap-1 border-t border-line pt-3 text-sm">
                        <div className="flex justify-between text-ink-soft">
                            <dt>Total de la venta</dt>
                            <dd className="tabular-nums">{money(venta.total)}</dd>
                        </div>
                        <div className="flex justify-between text-ink-soft">
                            <dt>Abonado</dt>
                            <dd className="tabular-nums">{money(abonado)}</dd>
                        </div>
                        <div className="flex items-baseline justify-between font-medium text-ink">
                            <dt>Saldo pendiente</dt>
                            <dd className="text-2xl text-danger tabular-nums">
                                {money(saldo)}
                            </dd>
                        </div>
                        {venta.fechaVencimiento && (
                            <div className="flex justify-between text-ink-soft">
                                <dt>Vence</dt>
                                <dd>{fecha(venta.fechaVencimiento)}</dd>
                            </div>
                        )}
                    </dl>

                    {listaAbonos.length > 0 && (
                        <div className="mt-4 border-t border-line pt-3">
                            <p className="mb-1 text-xs tracking-wide text-ink-soft uppercase">
                                Abonos anteriores
                            </p>
                            <ul className="grid gap-1 text-sm">
                                {listaAbonos.map((a) => (
                                    <li key={a.id} className="flex justify-between text-ink-soft">
                                        <span>
                                            {fecha(a.fecha)} · {a.metodo}
                                        </span>
                                        <span className="tabular-nums">{money(a.monto)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                <section className="card p-4" aria-labelledby="datos-cobro">
                    <h2 id="datos-cobro" className="mb-3 text-2xl text-ink">
                        Datos del cobro
                    </h2>
                    <FormularioCobro ventaId={venta.id} saldo={saldo} puedeCobrar={puedeCobrar} />
                </section>
            </div>
        </div>
    );
}
