import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productos, recetas } from "@/db/schema";
import FormularioProducto from "@/components/productos/formulario-producto";
import { requireSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar producto" };

export default async function PaginaEditarProducto({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireSesion("/productos");
    const { id } = await params;
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [[producto], lista] = await Promise.all([
        db.select().from(productos).where(eq(productos.id, numero)).limit(1),
        db.select({ id: recetas.id, nombre: recetas.nombre }).from(recetas).orderBy(asc(recetas.nombre)),
    ]);

    if (!producto) notFound();

    return (
        <div className="page">
            <h1 className="page-title">
                Editar producto
            </h1>
            <p className="mb-6 text-sm text-ink-soft">{producto.nombre}</p>
            <FormularioProducto producto={producto} recetas={lista} />
        </div>
    );
}
