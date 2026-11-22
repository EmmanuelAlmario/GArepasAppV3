import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { SlidersHorizontal } from "lucide-react";
import { db } from "@/db";
import { insumos } from "@/db/schema";
import FormularioInsumo from "@/components/insumos/formulario-insumo";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import { eliminarInsumo } from "@/app/actions/insumos";
import { requireSesion } from "@/lib/auth";
import { cantidad as formatCantidad, money } from "@/lib/format";
import { round2, round4 } from "@/lib/num";
import { desdeBase, etiqueta, precioDesdeBase } from "@/lib/units";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar insumo" };

const precioBaseFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 6 });

export default async function PaginaEditarInsumo({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireSesion("/insumos");
    const { id } = await params;
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [insumo] = await db.select().from(insumos).where(eq(insumos.id, numero)).limit(1);
    if (!insumo) notFound();

    const unidad = insumo.unidadPresentacion;
    const base = unidad === "KILOGRAMO" ? "GRAMO" : unidad === "LITRO" ? "MILILITRO" : unidad;

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        Editar insumo
                    </h1>
                    <p className="text-sm text-ink-soft">{insumo.nombre}</p>
                </div>
                <Link
                    href={`/insumos/${insumo.id}/ajuste`}
                    className="btn btn-secondary"
                >
                    <SlidersHorizontal size={16} /> Ajustar stock
                </Link>
            </header>

            <div className="card mb-4 max-w-2xl bg-surface-muted p-3 text-xs text-ink-soft">
                <p className="tabular-nums">
                    Guardado: {formatCantidad(round4(desdeBase(insumo.stockActual, unidad)))}{" "}
                    {etiqueta(unidad)} · ${precioBaseFmt.format(insumo.precioUnidadBase)} /{" "}
                    {etiqueta(base)} ·{" "}
                    {money(precioDesdeBase(insumo.precioUnidadBase, unidad))} / {etiqueta(unidad)}
                </p>
                <p className="mt-1">
                    Si cambias el stock aquí, el movimiento queda registrado en la bitácora de
                    inventario con la fecha y el usuario de la sesión.
                </p>
            </div>

            <FormularioInsumo
                insumo={{
                    id: insumo.id,
                    nombre: insumo.nombre,
                    categoria: insumo.categoria,
                    marca: insumo.marca,
                    unidadMedida: unidad,
                    stockActual: round4(desdeBase(insumo.stockActual, unidad)),
                    stockMinimo:
                        insumo.stockMinimo === null
                            ? null
                            : round4(desdeBase(insumo.stockMinimo, unidad)),
                    precioCompra: round2(precioDesdeBase(insumo.precioUnidadBase, unidad)),
                    activo: insumo.activo,
                }}
            />

            <details className="mt-8 max-w-2xl rounded-lg border border-line p-3 text-sm">
                <summary className="cursor-pointer text-danger">Eliminar insumo</summary>
                <p className="mt-2 text-xs text-ink-soft">
                    Solo se puede eliminar si no está en uso en recetas, no tiene producciones
                    registradas y no es fabricado por una receta. No se puede deshacer.
                </p>
                <div className="mt-2">
                    <ModalConfirmar
                        accion={eliminarInsumo}
                        campos={{ id: insumo.id }}
                        etiqueta={`Eliminar “${insumo.nombre}”`}
                        titulo="Eliminar insumo"
                        descripcion="Solo se permite si no está en recetas ni producciones. No se puede deshacer."
                        confirmar="Eliminar"
                        compacto={false}
                    />
                </div>
            </details>
        </div>
    );
}
