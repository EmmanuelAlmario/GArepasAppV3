import { notFound } from "next/navigation";
import { asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { detalleRecetas, insumos, recetas } from "@/db/schema";
import FormularioReceta from "@/components/recetas/formulario-receta";
import { requireSesion } from "@/lib/auth";
import { round4 } from "@/lib/num";
import { desdeBase } from "@/lib/units";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar receta" };

export default async function PaginaEditarReceta({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireSesion("/recetas");
    const { id } = await params;
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [receta] = await db.select().from(recetas).where(eq(recetas.id, numero)).limit(1);
    if (!receta) notFound();

    const detalles = await db
        .select({
            insumoId: detalleRecetas.insumoId,
            cantidad: detalleRecetas.cantidad,
            unidadPresentacion: insumos.unidadPresentacion,
        })
        .from(detalleRecetas)
        .innerJoin(insumos, eq(detalleRecetas.insumoId, insumos.id))
        .where(eq(detalleRecetas.recetaId, numero))
        .orderBy(asc(insumos.nombre));

    const usados = detalles.map((d) => d.insumoId);

    // Insumos activos + los que ya usa la receta (aunque estén inactivos),
    // para no perder líneas al editar.
    const opciones = await db
        .select({
            id: insumos.id,
            nombre: insumos.nombre,
            unidadPresentacion: insumos.unidadPresentacion,
            precioUnidadBase: insumos.precioUnidadBase,
        })
        .from(insumos)
        .where(
            usados.length > 0
                ? or(eq(insumos.activo, true), inArray(insumos.id, usados))
                : eq(insumos.activo, true),
        )
        .orderBy(asc(insumos.nombre));

    return (
        <div className="page">
            <h1 className="page-title">
                Editar receta
            </h1>
            <p className="mb-6 text-sm text-ink-soft">{receta.nombre}</p>
            <FormularioReceta
                receta={{
                    id: receta.id,
                    nombre: receta.nombre,
                    descripcion: receta.descripcion,
                    insumoProducidoId: receta.insumoProducidoId,
                    rendimiento: receta.rendimiento,
                    detalles: detalles.map((d) => ({
                        insumoId: d.insumoId,
                        cantidad: round4(desdeBase(d.cantidad, d.unidadPresentacion)),
                        unidad: d.unidadPresentacion,
                    })),
                }}
                insumos={opciones}
            />
        </div>
    );
}
