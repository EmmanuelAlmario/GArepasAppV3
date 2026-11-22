import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { producciones, productos, recetas } from "@/db/schema";
import { fecha, money } from "@/lib/format";
import { requireSesion } from "@/lib/auth";
import Modal from "@/components/ui/modal";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import FormularioProduccion from "@/components/producciones/formulario-produccion";
import { eliminarProduccion, verificarProduccion } from "@/app/actions/producciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Producciones" };

const MENSAJES: Record<string, string> = {
    completada:
        "Producción completada: stock descontado y gasto de materia prima registrado.",
    pendiente:
        "Producción registrada como INSUFICIENTE: faltan insumos. Re-verifícala cuando repongas stock.",
    "sigue-pendiente": "Aún faltan insumos para completar la producción.",
    eliminada: "Producción eliminada y stock revertido.",
};

export default async function PaginaProducciones({
    searchParams,
}: {
    searchParams: Promise<{ ok?: string; estado?: string; error?: string }>;
}) {
    await requireSesion("/producciones");
    const { ok, estado, error } = await searchParams;

    const filas = await db
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
        .where(
            estado === "PENDIENTE" || estado === "COMPLETADA"
                ? eq(producciones.estado, estado)
                : undefined,
        )
        .orderBy(desc(producciones.fecha));

    const aviso = ok ? MENSAJES[ok] : undefined;

    /* Solo productos activos con receta: son los únicos que se pueden producir. */
    const productosDisponibles = await db
        .select({
            id: productos.id,
            nombre: productos.nombre,
            receta: recetas.nombre,
        })
        .from(productos)
        .innerJoin(recetas, eq(productos.recetaId, recetas.id))
        .where(eq(productos.activo, true))
        .orderBy(asc(productos.nombre));

    return (
        <div className="page">
            <header className="page-header" data-tour="produccion">
                <div>
                    <h1 className="page-title">
                        Producciones
                    </h1>
                    <p className="text-sm text-ink-soft">
                        Cada producción descuenta insumos, suma stock del producto y registra el
                        gasto de materia prima.
                    </p>
                </div>
                <Modal
                    etiqueta="Registrar producción"
                    titulo="Registrar producción"
                    descripcion="Descuenta insumos según la receta y suma stock del producto."
                    ancho="md"
                    icono={<Plus size={15} />}
                >
                    <FormularioProduccion productos={productosDisponibles} />
                </Modal>
            </header>

            <div className="segmented mb-3">
                <Link href="/producciones" aria-current={!estado ? "page" : undefined}>
                    Todas
                </Link>
                <Link
                    href="/producciones?estado=PENDIENTE"
                    aria-current={estado === "PENDIENTE" ? "page" : undefined}
                >
                    Pendientes
                </Link>
                <Link
                    href="/producciones?estado=COMPLETADA"
                    aria-current={estado === "COMPLETADA" ? "page" : undefined}
                >
                    Completadas
                </Link>
            </div>

            {aviso && (
                <p
                    role="status"
                    className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink"
                >
                    {aviso}
                </p>
            )}
            {error && (
                <p role="alert" className="mb-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}

            {filas.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    No hay producciones registradas. Registra una para descontar insumos y sumar
                    stock del producto.
                </p>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="table">
                        <caption className="sr-only">
                            Producciones ordenadas de la más reciente a la más antigua
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">#</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Producto</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Cant.</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Costo total</th>
                                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                                    Costo unit.
                                </th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Fecha</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((p) => {
                                const unitario = p.cantidad > 0 ? Number(p.costoTotal ?? 0) / p.cantidad : 0;
                                const completada = p.estado === "COMPLETADA";
                                return (
                                    <tr key={p.id}>
                                        <td className="px-4 py-2.5 tabular-nums text-ink-faint">
                                            {p.id}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Link
                                                href={`/producciones/${p.id}`}
                                                className="font-medium text-ink hover:text-accent hover:underline"
                                            >
                                                {p.productoNombre}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{p.cantidad}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {money(p.costoTotal)}
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-right tabular-nums md:table-cell">
                                            {money(unitario)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span
                                                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                                                    completada
                                                        ? "bg-surface-sunken text-ink"
                                                        : "bg-warning-tint text-ink"
                                                }`}
                                            >
                                                {completada ? "Completada" : "Pendiente: faltan insumos"}
                                            </span>
                                        </td>
                                        <td className="hidden px-4 py-2.5 whitespace-nowrap text-ink-soft sm:table-cell">
                                            {fecha(p.fecha)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex flex-wrap items-center justify-end gap-1">
                                                <Link
                                                    href={`/producciones/${p.id}`}
                                                    className="rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-surface-muted"
                                                >
                                                    Ver detalle
                                                </Link>
                                                {!completada && (
                                                    <ModalConfirmar
                                                        accion={verificarProduccion}
                                                        campos={{ id: p.id }}
                                                        etiqueta="Re-verificar"
                                                        titulo="Volver a revisar el stock"
                                                        descripcion="Si ya alcanzan los insumos, la producción se completa y descuenta stock."
                                                        confirmar="Re-verificar"
                                                        peligro={false}
                                                    />
                                                )}
                                                <ModalConfirmar
                                                    accion={eliminarProduccion}
                                                    campos={{ id: p.id }}
                                                    etiqueta="Eliminar"
                                                    titulo="Eliminar producción"
                                                    descripcion="Si estaba completada se revierte el stock y se borra el gasto de materia prima."
                                                    confirmar="Eliminar"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
