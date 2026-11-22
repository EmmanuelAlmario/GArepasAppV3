import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { extras, productos, recetas } from "@/db/schema";
import { money } from "@/lib/format";
import { requireSesion } from "@/lib/auth";
import FormularioProducto from "@/components/productos/formulario-producto";
import Modal from "@/components/ui/modal";
import ExtrasCarta from "@/components/productos/extras-carta";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import { alternarProducto } from "@/app/actions/productos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Productos" };

export default async function PaginaProductos({
    searchParams,
}: {
    searchParams: Promise<{ filtro?: string }>;
}) {
    await requireSesion("/productos");
    const { filtro } = await searchParams;

    const filas = await db
        .select({
            id: productos.id,
            nombre: productos.nombre,
            precioVenta: productos.precioVenta,
            stockActual: productos.stockActual,
            stockMinimo: productos.stockMinimo,
            activo: productos.activo,
            bajoPedido: productos.bajoPedido,
            controlarStock: productos.controlarStock,
            receta: recetas.nombre,
            recetaId: productos.recetaId,
        })
        .from(productos)
        .leftJoin(recetas, eq(productos.recetaId, recetas.id))
        .where(
            filtro === "bajo"
                ? sql`${productos.stockMinimo} is not null and ${productos.stockActual} <= ${productos.stockMinimo}`
                : sql`true`,
        )
        .orderBy(asc(productos.nombre));

    const listaExtras = await db
        .select({
            id: extras.id,
            nombre: extras.nombre,
            precio: extras.precio,
            activo: extras.activo,
        })
        .from(extras)
        .orderBy(asc(extras.orden), asc(extras.nombre));

    const listaRecetas = await db
        .select({ id: recetas.id, nombre: recetas.nombre })
        .from(recetas)
        .orderBy(asc(recetas.nombre));

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        Productos
                    </h1>
                    <p className="text-sm text-ink-soft">
                        Lo que se vende y lo que aparece en la carta pública.
                    </p>
                </div>
                <Modal
                    etiqueta="Nuevo producto"
                    titulo="Nuevo producto"
                    descripcion="La carta pública se actualiza al guardar."
                    icono={<Plus size={15} />}
                >
                    <FormularioProducto recetas={listaRecetas} />
                </Modal>
            </header>

            <div className="segmented mb-3">
                <Link href="/productos" aria-current={filtro !== "bajo" ? "page" : undefined}>
                    Todos
                </Link>
                <Link
                    href="/productos?filtro=bajo"
                    aria-current={filtro === "bajo" ? "page" : undefined}
                >
                    Bajo mínimo
                </Link>
            </div>

            {filas.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    No hay productos todavía. Crea el primero con “Nuevo producto”.
                </p>
            ) : (
                <div className="card overflow-hidden">
                    <table className="table">
                        <caption className="sr-only">Listado de productos</caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Producto</th>
                                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Receta</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Precio</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Stock</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((p) => {
                                const bajo = p.stockMinimo !== null && p.stockActual <= p.stockMinimo;
                                return (
                                    <tr key={p.id} className={p.activo ? "" : "opacity-60"}>
                                        <td className="px-4 py-2.5">
                                            <span className="font-medium text-ink">{p.nombre}</span>
                                            <div className="mt-0.5 flex gap-1.5 text-[11px]">
                                                {!p.activo && (
                                                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-ink-soft">
                                                        Inactivo
                                                    </span>
                                                )}
                                                {p.bajoPedido && (
                                                    <span className="badge badge-accent">
                                                        Bajo pedido
                                                    </span>
                                                )}
                                                {!p.controlarStock && (
                                                    <span className="badge">Stock libre</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-ink-soft sm:table-cell">
                                            {p.receta ?? "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {money(p.precioVenta)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            <span className={bajo ? "font-medium text-danger" : ""}>
                                                {p.stockActual}
                                            </span>
                                            {p.stockMinimo !== null && (
                                                <span className="text-xs text-ink-faint"> / {p.stockMinimo}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <Modal
                                                    etiqueta="Editar"
                                                    titulo="Editar producto"
                                                    ancho="md"
                                                    variante="ghost"
                                                    compacto
                                                >
                                                    <FormularioProducto
                                                        producto={{
                                                            id: p.id,
                                                            nombre: p.nombre,
                                                            precioVenta: Number(p.precioVenta),
                                                            stockActual: p.stockActual,
                                                            stockMinimo: p.stockMinimo,
                                                            recetaId: p.recetaId,
                                                            activo: p.activo,
                                                            bajoPedido: p.bajoPedido,
                                                            controlarStock: p.controlarStock,
                                                        }}
                                                        recetas={listaRecetas}
                                                    />
                                                </Modal>
                                                <ModalConfirmar
                                                    accion={alternarProducto}
                                                    campos={{ id: p.id }}
                                                    etiqueta={p.activo ? "Desactivar" : "Activar"}
                                                    titulo={
                                                        p.activo
                                                            ? "Sacar el producto de la carta"
                                                            : "Volver a poner el producto"
                                                    }
                                                    descripcion={
                                                        p.activo
                                                            ? "Deja de mostrarse en la carta pública y de venderse en el POS. No borra el historial."
                                                            : "Vuelve a aparecer en la carta pública y en el POS."
                                                    }
                                                    confirmar={p.activo ? "Desactivar" : "Activar"}
                                                    peligro={p.activo}
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

            <ExtrasCarta extras={listaExtras.map((e) => ({ ...e, precio: Number(e.precio) }))} />
        </div>
    );
}
