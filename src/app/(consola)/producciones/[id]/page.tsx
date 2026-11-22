import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { detalleProducciones, gastos, insumos, producciones, productos } from "@/db/schema";
import { cantidad, fecha, money } from "@/lib/format";
import { requireSesion } from "@/lib/auth";
import { etiquetaBase } from "@/lib/produccion";
import { eliminarProduccion, verificarProduccion } from "@/app/actions/producciones";
import ModalConfirmar from "@/components/ui/modal-confirmar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle de producción" };

export default async function PaginaDetalleProduccion({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireSesion("/producciones");
    const { id } = await params;
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [fila] = await db
        .select({
            id: producciones.id,
            fecha: producciones.fecha,
            cantidad: producciones.cantidad,
            costoTotal: producciones.costoTotal,
            estado: producciones.estado,
            productoNombre: productos.nombre,
        })
        .from(producciones)
        .innerJoin(productos, eq(producciones.productoId, productos.id))
        .where(eq(producciones.id, numero))
        .limit(1);
    if (!fila) notFound();

    const [lineas, gasto] = await Promise.all([
        db
            .select({
                id: detalleProducciones.id,
                insumoNombre: insumos.nombre,
                unidadPresentacion: insumos.unidadPresentacion,
                stockActual: insumos.stockActual,
                cantidadRequerida: detalleProducciones.cantidadRequerida,
                costoLinea: detalleProducciones.costoLinea,
                suficiente: detalleProducciones.suficiente,
            })
            .from(detalleProducciones)
            .innerJoin(insumos, eq(detalleProducciones.insumoId, insumos.id))
            .where(eq(detalleProducciones.produccionId, numero))
            .orderBy(asc(detalleProducciones.id)),
        db
            .select({ id: gastos.id, monto: gastos.monto })
            .from(gastos)
            .where(eq(gastos.produccionId, numero))
            .limit(1),
    ]);

    const completada = fila.estado === "COMPLETADA";
    const costoTotal = Number(fila.costoTotal ?? 0);
    const costoUnitario = fila.cantidad > 0 ? costoTotal / fila.cantidad : 0;
    const insumosOk = lineas.filter((l) => l.suficiente).length;
    const tieneStockAhora =
        lineas.length > 0 &&
        lineas.every((l) => Number(l.stockActual) >= Number(l.cantidadRequerida));

    return (
        <div className="page">
            <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="page-title">
                        Producción #{fila.id}
                    </h1>
                    <p className="text-sm text-ink-soft">
                        <span className="font-medium text-ink">{fila.productoNombre}</span> ·{" "}
                        {fila.cantidad} {fila.cantidad === 1 ? "unidad" : "unidades"} ·{" "}
                        {fecha(fila.fecha)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {!completada && (
                        <ModalConfirmar
                            accion={verificarProduccion}
                            campos={{ id: fila.id }}
                            etiqueta="Re-verificar ahora"
                            titulo="Volver a revisar el stock"
                            descripcion="Si ya alcanzan los insumos, la producción se completa y descuenta stock."
                            confirmar="Re-verificar"
                            peligro={false}
                            compacto={false}
                        />
                    )}
                    <ModalConfirmar
                        accion={eliminarProduccion}
                        campos={{ id: fila.id }}
                        etiqueta="Eliminar"
                        titulo="Eliminar producción"
                        descripcion="Si estaba completada se revierte el stock y se borra el gasto de materia prima."
                        confirmar="Eliminar"
                        compacto={false}
                    />
                    <Link
                        href="/producciones"
                        className="btn btn-secondary"
                    >
                        <ArrowLeft size={15} /> Volver
                    </Link>
                </div>
            </header>

            {!completada && tieneStockAhora && (
                <p role="status" className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink">
                    El stock actual ya alcanza para completar esta producción. Pulsa{" "}
                    <strong>Re-verificar ahora</strong> para descontar insumos, sumar stock del
                    producto y registrar el gasto de materia prima.
                </p>
            )}
            {!completada && !tieneStockAhora && (
                <p role="status" className="mb-4 rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
                    Esta producción quedó pendiente: al verificarla faltaban insumos. La columna{" "}
                    <strong>Stock actual</strong> muestra el inventario de hoy y{" "}
                    <strong>Faltante actual</strong> cuánto falta. Vuelve a verificar cuando lo
                    repongas.
                </p>
            )}

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="card p-4">
                    <p className="text-xs text-ink-soft">Estado</p>
                    <p className="mt-1">
                        <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                completada
                                    ? "bg-surface-sunken text-ink"
                                    : "bg-warning-tint text-ink"
                            }`}
                        >
                            {completada ? "Completada" : "Pendiente"}
                        </span>
                    </p>
                </div>
                <div className="card p-4">
                    <p className="text-xs text-ink-soft">Costo total</p>
                    <p className="mt-1 text-lg font-medium tabular-nums text-ink">
                        {money(costoTotal)}
                    </p>
                </div>
                <div className="card p-4">
                    <p className="text-xs text-ink-soft">Costo unitario</p>
                    <p className="mt-1 text-lg font-medium tabular-nums text-ink">
                        {money(costoUnitario)}
                    </p>
                </div>
                <div className="card p-4">
                    <p className="text-xs text-ink-soft">Insumos suficientes</p>
                    <p className="mt-1 text-lg font-medium tabular-nums text-ink">
                        {insumosOk} / {lineas.length}
                    </p>
                    <p className="text-[11px] text-ink-faint">Según la última verificación</p>
                </div>
            </div>

            {gasto[0] && (
                <p className="mb-4 text-sm text-ink-soft">
                    Gasto de materia prima registrado:{" "}
                    <Link
                        href={`/gastos/${gasto[0].id}`}
                        className="font-medium text-accent hover:underline"
                    >
                        {money(gasto[0].monto)}
                    </Link>
                </p>
            )}

            <div className="card overflow-x-auto">
                <div className="border-b border-line px-4 py-3">
                    <h2 className="section-title">Insumos requeridos</h2>
                </div>
                <table className="table">
                    <caption className="sr-only">
                        Insumos requeridos por la producción, stock actual y costo de cada línea
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col" className="px-4 py-2.5 font-medium">Insumo</th>
                            <th scope="col" className="px-4 py-2.5 text-right font-medium">Requerido</th>
                            <th scope="col" className="px-4 py-2.5 text-right font-medium">Stock actual</th>
                            <th scope="col" className="px-4 py-2.5 text-right font-medium">Faltante</th>
                            <th scope="col" className="px-4 py-2.5 text-right font-medium">Costo línea</th>
                            <th scope="col" className="px-4 py-2.5 font-medium">Última verificación</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineas.map((l) => {
                            const unidad = etiquetaBase(l.unidadPresentacion);
                            const requerida = Number(l.cantidadRequerida);
                            const disponible = Number(l.stockActual);
                            const faltante = requerida - disponible;
                            return (
                                <tr key={l.id} className={faltante > 0 ? "bg-danger-tint/40" : ""}>
                                    <td className="px-4 py-2.5 text-ink">{l.insumoNombre}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {cantidad(requerida)} {unidad}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {cantidad(disponible)} {unidad}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {faltante > 0 ? (
                                            <span className="text-danger">
                                                {cantidad(faltante)} {unidad}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {money(l.costoLinea)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span
                                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                                                l.suficiente
                                                    ? "bg-surface-sunken text-ink"
                                                    : "bg-danger-tint text-danger"
                                            }`}
                                        >
                                            {l.suficiente ? "Suficiente" : "Faltaba stock"}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
