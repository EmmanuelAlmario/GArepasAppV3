import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productos, recetas } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import FormularioProduccion from "@/components/producciones/formulario-produccion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registrar producción" };

export default async function PaginaNuevaProduccion() {
    await requireSesion("/producciones");

    const lista = await db
        .select({ id: productos.id, nombre: productos.nombre, receta: recetas.nombre })
        .from(productos)
        .innerJoin(recetas, eq(productos.recetaId, recetas.id))
        .where(eq(productos.activo, true))
        .orderBy(asc(productos.nombre));

    return (
        <div className="page">
            <h1 className="page-title">
                Registrar producción
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
                Se descuentan los insumos de la receta y se suma stock del producto.
            </p>
            <FormularioProduccion productos={lista} />
        </div>
    );
}
