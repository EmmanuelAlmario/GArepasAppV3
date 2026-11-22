import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { detalleRecetas, insumos, recetas } from "@/db/schema";
import { eliminarReceta } from "@/app/actions/recetas";
import { requireSesion } from "@/lib/auth";
import { costoReceta, costoUnitario, type LineaCosto } from "@/lib/costos";
import { money, moneyFino } from "@/lib/format";
import Modal from "@/components/ui/modal";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import FormularioReceta from "@/components/recetas/formulario-receta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recetas" };

const producido = alias(insumos, "insumo_producido");
const ingrediente = alias(insumos, "insumo_ingrediente");

export default async function PaginaRecetas({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>;
}) {
    await requireSesion("/recetas");
    const { error } = await searchParams;

    const filas = await db
        .select({
            id: recetas.id,
            nombre: recetas.nombre,
            descripcion: recetas.descripcion,
            rendimiento: recetas.rendimiento,
            insumoProducidoId: recetas.insumoProducidoId,
            producido: producido.nombre,
            cantidad: detalleRecetas.cantidad,
            precio: ingrediente.precioUnidadBase,
        })
        .from(recetas)
        .leftJoin(producido, eq(recetas.insumoProducidoId, producido.id))
        .leftJoin(detalleRecetas, eq(detalleRecetas.recetaId, recetas.id))
        .leftJoin(ingrediente, eq(detalleRecetas.insumoId, ingrediente.id))
        .orderBy(asc(recetas.nombre));

    const agrupadas = new Map<
        number,
        {
            id: number;
            nombre: string;
            descripcion: string | null;
            rendimiento: number | null;
            insumoProducidoId: number | null;
            producido: string | null;
            lineas: LineaCosto[];
        }
    >();

    for (const fila of filas) {
        let receta = agrupadas.get(fila.id);
        if (!receta) {
            receta = {
                id: fila.id,
                nombre: fila.nombre,
                descripcion: fila.descripcion,
                rendimiento: fila.rendimiento,
                insumoProducidoId: fila.insumoProducidoId,
                producido: fila.producido,
                lineas: [],
            };
            agrupadas.set(fila.id, receta);
        }
        if (fila.precio !== null) {
            receta.lineas.push({ cantidad: fila.cantidad ?? 0, precioUnidadBase: fila.precio });
        }
    }

    const lista = [...agrupadas.values()];

    const [insumosDisponibles, lineasRecetas] = await Promise.all([
        db
            .select({
                id: insumos.id,
                nombre: insumos.nombre,
                unidadPresentacion: insumos.unidadPresentacion,
                precioUnidadBase: insumos.precioUnidadBase,
            })
            .from(insumos)
            .where(eq(insumos.activo, true))
            .orderBy(asc(insumos.nombre)),
        db
            .select({
                recetaId: detalleRecetas.recetaId,
                insumoId: detalleRecetas.insumoId,
                cantidad: detalleRecetas.cantidad,
                unidad: insumos.unidadPresentacion,
            })
            .from(detalleRecetas)
            .innerJoin(insumos, eq(detalleRecetas.insumoId, insumos.id)),
    ]);

    const detallesPorReceta = new Map<number, typeof lineasRecetas>();
    for (const linea of lineasRecetas) {
        const actual = detallesPorReceta.get(linea.recetaId) ?? [];
        actual.push(linea);
        detallesPorReceta.set(linea.recetaId, actual);
    }

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        Recetas
                    </h1>
                    <p className="text-sm text-ink-soft">
                        Composición de cada producto y su costo calculado con los precios actuales
                        de los insumos.
                    </p>
                </div>
                <Modal
                    etiqueta="Nueva receta"
                    titulo="Nueva receta"
                    descripcion="El costo se calcula con los precios actuales de los insumos."
                    ancho="lg"
                    icono={<Plus size={15} />}
                >
                    <FormularioReceta insumos={insumosDisponibles} />
                </Modal>
            </header>

            {error && (
                <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}

            {lista.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    No hay recetas registradas. Una receta describe los insumos de un producto y
                    permite calcular su costo.
                </p>
            ) : (
                <div className="card overflow-hidden">
                    <table className="table">
                        <caption className="sr-only">
                            Recetas con su cantidad de insumos y costo calculado
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Receta</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Insumos</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Costo lote</th>
                                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                                    Costo unitario
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lista.map((r) => {
                                const total = costoReceta(r.lineas);
                                return (
                                    <tr key={r.id}>
                                        <td className="px-4 py-2.5">
                                            <span className="font-medium text-ink">{r.nombre}</span>
                                            <div className="mt-0.5 text-[11px] text-ink-faint">
                                                {r.descripcion ?? "—"}
                                                {r.producido && (
                                                    <span className="ml-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-accent-strong">
                                                        Fabrica {r.producido}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {r.lineas.length}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {money(total)}
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">
                                            {moneyFino(costoUnitario(total, r.rendimiento))}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <Modal
                                                    etiqueta="Editar"
                                                    titulo="Editar receta"
                                                    ancho="lg"
                                                    variante="ghost"
                                                    compacto
                                                >
                                                    <FormularioReceta
                                                        receta={{
                                                            id: r.id,
                                                            nombre: r.nombre,
                                                            descripcion: r.descripcion,
                                                            insumoProducidoId: r.insumoProducidoId,
                                                            rendimiento: r.rendimiento,
                                                            detalles: (
                                                                detallesPorReceta.get(r.id) ?? []
                                                            ).map((d) => ({
                                                                insumoId: d.insumoId,
                                                                cantidad: Number(d.cantidad),
                                                                unidad: d.unidad,
                                                            })),
                                                        }}
                                                        insumos={insumosDisponibles}
                                                    />
                                                </Modal>
                                                <ModalConfirmar
                                                    accion={eliminarReceta}
                                                    campos={{ id: r.id }}
                                                    etiqueta="Eliminar"
                                                    titulo="Eliminar receta"
                                                    descripcion="Solo se permite si no está asignada a un producto ni fabrica un insumo."
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
