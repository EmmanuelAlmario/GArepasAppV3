import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { insumos } from "@/db/schema";
import FormularioReceta from "@/components/recetas/formulario-receta";
import { requireSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva receta" };

export default async function PaginaNuevaReceta() {
    await requireSesion("/recetas");

    const opciones = await db
        .select({
            id: insumos.id,
            nombre: insumos.nombre,
            unidadPresentacion: insumos.unidadPresentacion,
            precioUnidadBase: insumos.precioUnidadBase,
        })
        .from(insumos)
        .where(eq(insumos.activo, true))
        .orderBy(asc(insumos.nombre));

    return (
        <div className="page">
            <h1 className="page-title">
                Nueva receta
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
                Agrega los insumos y sus cantidades; el costo se calcula con los precios actuales.
            </p>
            <FormularioReceta insumos={opciones} />
        </div>
    );
}
