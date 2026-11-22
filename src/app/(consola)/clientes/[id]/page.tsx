import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Plus } from "lucide-react";
import { db } from "@/db";
import {
    abonos,
    clientes,
    detalleVentas,
    productos,
    ventas,
} from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import Modal from "@/components/ui/modal";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import FormularioCliente from "@/components/clientes/formulario-cliente";
import FormularioCobro from "@/components/pos/formulario-cobro";
import { fechaHoraCorta, money } from "@/lib/format";
import { round2 } from "@/lib/num";
import { alternarCliente } from "@/app/actions/clientes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cliente" };

const ETIQUETAS_PAGO: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    CREDITO: "Crédito",
};

export default async function PaginaCliente({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    await requireSesion(`/clientes/${id}`);
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [[cliente], compras, listaAbonos] = await Promise.all([
        db.select().from(clientes).where(eq(clientes.id, numero)).limit(1),
        db
            .select({
                id: ventas.id,
                fecha: ventas.fecha,
                total: ventas.total,
                saldo: ventas.saldo,
                formaPago: ventas.formaPago,
                fechaVencimiento: ventas.fechaVencimiento,
            })
            .from(ventas)
            .where(and(eq(ventas.clienteId, numero), eq(ventas.estado, "ACTIVA")))
            .orderBy(desc(ventas.fecha)),
        db
            .select({
                id: abonos.id,
                ventaId: abonos.ventaId,
                monto: abonos.monto,
                fecha: abonos.fecha,
                metodo: abonos.metodo,
                nota: abonos.nota,
            })
            .from(abonos)
            .innerJoin(ventas, eq(abonos.ventaId, ventas.id))
            .where(eq(ventas.clienteId, numero))
            .orderBy(desc(abonos.fecha)),
    ]);

    if (!cliente) notFound();

    const ids = compras.map((v) => v.id);
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
              .orderBy(asc(detalleVentas.id))
        : [];

    const porVenta = new Map<number, string[]>();
    for (const d of detalles) {
        const lista = porVenta.get(d.ventaId) ?? [];
        lista.push(`${d.nombre} ×${d.cantidad}`);
        porVenta.set(d.ventaId, lista);
    }

    const saldo = round2(compras.reduce((suma, v) => suma + Number(v.saldo), 0));
    const sinDatos = !cliente.telefono && !cliente.direccion && !cliente.notas;

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <Link
                        href="/clientes"
                        className="mb-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                        <ArrowLeft size={13} /> Clientes
                    </Link>
                    <h1 className="page-title">{cliente.nombre}</h1>
                    <p className="text-sm text-ink-soft">
                        {cliente.telefono ?? "Sin datos de contacto"}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ModalConfirmar
                        accion={alternarCliente}
                        campos={{ id: cliente.id }}
                        etiqueta={cliente.activo ? "Desactivar" : "Activar"}
                        titulo={cliente.activo ? "Desactivar cliente" : "Activar cliente"}
                        descripcion={
                            cliente.activo
                                ? "Deja de aparecer al fiar, pero conserva su historial y saldo."
                                : "Vuelve a estar disponible para fiar y registrar cobros."
                        }
                        confirmar={cliente.activo ? "Desactivar" : "Activar"}
                        peligro={cliente.activo}
                        compacto={false}
                    />
                    <Modal
                        etiqueta="Nuevo cliente"
                        titulo="Nuevo cliente"
                        ancho="sm"
                        icono={<Plus size={15} />}
                    >
                        <FormularioCliente />
                    </Modal>
                </div>
            </header>

            <div className="mb-4 grid gap-4 md:grid-cols-[1.3fr_1fr]">
                <section className="card p-4" aria-labelledby="datos-cliente">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 id="datos-cliente" className="text-2xl text-ink">
                            Datos del cliente
                        </h2>
                        <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                cliente.activo
                                    ? "bg-success-tint text-success"
                                    : "bg-surface-sunken text-ink-soft"
                            }`}
                        >
                            {cliente.activo ? "Activo" : "Inactivo"}
                        </span>
                    </div>

                    {sinDatos ? (
                        <p className="text-sm text-ink-faint">Sin datos de contacto.</p>
                    ) : (
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <dt className="text-xs tracking-wide text-ink-soft uppercase">
                                    Teléfono
                                </dt>
                                <dd className="font-medium text-ink">
                                    {cliente.telefono ?? "—"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs tracking-wide text-ink-soft uppercase">
                                    Dirección
                                </dt>
                                <dd className="font-medium text-ink">
                                    {cliente.direccion ?? "—"}
                                </dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-xs tracking-wide text-ink-soft uppercase">
                                    Notas
                                </dt>
                                <dd className="text-ink">{cliente.notas ?? "—"}</dd>
                            </div>
                        </dl>
                    )}

                    <details className="mt-4 border-t border-line pt-3">
                        <summary className="cursor-pointer text-sm text-accent hover:underline">
                            Editar datos
                        </summary>
                        <div className="pt-3">
                            <FormularioCliente
                                compacto
                                cliente={{
                                    id: cliente.id,
                                    nombre: cliente.nombre,
                                    telefono: cliente.telefono,
                                    direccion: cliente.direccion,
                                    notas: cliente.notas,
                                    activo: cliente.activo,
                                }}
                            />
                        </div>
                    </details>
                </section>

                <section className="card p-4" aria-label="Saldo pendiente">
                    <p className="text-xs tracking-wide text-ink-soft uppercase">Saldo pendiente</p>
                    <p className="mt-1 text-4xl text-accent tabular-nums">
                        {money(saldo)}
                    </p>
                    <p className="text-xs text-ink-faint">Deuda total del cliente</p>
                </section>
            </div>

            <section className="card mb-4 overflow-x-auto" aria-labelledby="ventas-cliente">
                <div className="flex items-center justify-between px-4 py-3">
                    <h2 id="ventas-cliente" className="text-2xl text-ink">
                        Ventas
                    </h2>
                    <span className="badge">
                        {compras.length} venta(s)
                    </span>
                </div>

                {compras.length === 0 ? (
                    <p className="px-4 pb-5 text-sm text-ink-faint">
                        Sin ventas. Cuando le registres una aparecerá aquí con su saldo.
                    </p>
                ) : (
                    <table className="table">
                        <caption className="sr-only">
                            Ventas del cliente con su saldo y estado de cobro
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Productos</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Saldo</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Pago</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {compras.map((v) => {
                                const pendiente = Number(v.saldo) > 0;
                                return (
                                    <tr key={v.id}>
                                        <td className="px-4 py-2.5 text-ink-soft">
                                            {fechaHoraCorta(v.fecha)}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-ink-soft">
                                            {(porVenta.get(v.id) ?? []).join(", ") || "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {money(v.total)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            <span
                                                className={
                                                    pendiente
                                                        ? "font-medium text-accent"
                                                        : "text-ink-faint"
                                                }
                                            >
                                                {money(v.saldo)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="badge">
                                                {ETIQUETAS_PAGO[v.formaPago] ?? v.formaPago}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/ventas/${v.id}`}
                                                    className="rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-surface-muted"
                                                >
                                                    Recibo
                                                </Link>
                                                {pendiente && (
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
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="card overflow-x-auto" aria-labelledby="abonos-cliente">
                <div className="flex items-center justify-between px-4 py-3">
                    <h2 id="abonos-cliente" className="text-2xl text-ink">
                        Abonos recibidos
                    </h2>
                    <span className="badge">
                        {listaAbonos.length} abono(s)
                    </span>
                </div>

                {listaAbonos.length === 0 ? (
                    <p className="px-4 pb-5 text-sm text-ink-faint">
                        Sin abonos. Cuando registres un cobro aparecerá aquí.
                    </p>
                ) : (
                    <table className="table">
                        <caption className="sr-only">Abonos registrados para el cliente</caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Venta</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Monto</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Método</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Nota</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listaAbonos.map((a) => (
                                <tr key={a.id}>
                                    <td className="px-4 py-2.5 text-ink-soft">
                                        {fechaHoraCorta(a.fecha)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Link
                                            href={`/ventas/${a.ventaId}`}
                                            className="text-accent hover:underline"
                                        >
                                            #{a.ventaId}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                        {money(a.monto)}
                                    </td>
                                    <td className="px-4 py-2.5 text-ink-soft">
                                        {ETIQUETAS_PAGO[a.metodo] ?? a.metodo}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-ink-soft">
                                        {a.nota ?? "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}
