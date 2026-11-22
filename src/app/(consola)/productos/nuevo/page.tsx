import { asc } from "drizzle-orm";
import { db } from "@/db";
import { recetas } from "@/db/schema";
import FormularioProducto from "@/components/productos/formulario-producto";
import { requireSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo producto" };

export default async function PaginaNuevoProducto() {
    await requireSesion("/productos");
    const lista = await db
        .select({ id: recetas.id, nombre: recetas.nombre })
        .from(recetas)
        .orderBy(asc(recetas.nombre));

    return (
        <div className="page">
            <h1 className="page-title">
                Nuevo producto
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
                Con su receta, el costo y el stock se calculan solos al producir.
            </p>
            <FormularioProducto recetas={lista} />
        </div>
    );
}
