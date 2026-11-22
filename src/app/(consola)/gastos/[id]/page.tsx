import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { gastos } from "@/db/schema";
import { fecha, money } from "@/lib/format";
import { requireSesion } from "@/lib/auth";
import { ETIQUETAS_CATEGORIA, type CategoriaGasto } from "@/lib/gastos";
import FormularioGasto from "@/components/gastos/formulario-gasto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gasto" };

export default async function PaginaGasto({ params }: { params: Promise<{ id: string }> }) {
    await requireSesion("/gastos");
    const { id } = await params;
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [gasto] = await db.select().from(gastos).where(eq(gastos.id, numero)).limit(1);
    if (!gasto) notFound();

    const automatico = gasto.produccionId !== null;

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        {automatico ? "Gasto de producción" : "Editar gasto"}
                    </h1>
                    <p className="text-sm text-ink-soft">
                        {gasto.descripcion} · {fecha(gasto.fecha)}
                    </p>
                </div>
                <Link
                    href="/gastos"
                    className="btn btn-secondary"
                >
                    <ArrowLeft size={15} /> Volver al listado
                </Link>
            </header>

            {automatico ? (
                <div className="card grid max-w-2xl gap-4 p-5">
                    <p className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
                        Este gasto fue generado automáticamente por una producción y no se puede
                        editar. Para revertirlo, elimina la producción.
                    </p>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-ink-soft">Categoría</dt>
                            <dd className="text-ink">
                                {ETIQUETAS_CATEGORIA[gasto.categoria as CategoriaGasto]}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-ink-soft">Monto</dt>
                            <dd className="tabular-nums text-ink">{money(gasto.monto)}</dd>
                        </div>
                        <div className="sm:col-span-2">
                            <dt className="text-ink-soft">Producción</dt>
                            <dd>
                                <Link
                                    href={`/producciones/${gasto.produccionId}`}
                                    className="font-medium text-accent hover:underline"
                                >
                                    Ver producción #{gasto.produccionId}
                                </Link>
                            </dd>
                        </div>
                    </dl>
                </div>
            ) : (
                <FormularioGasto
                    gasto={{
                        id: gasto.id,
                        descripcion: gasto.descripcion,
                        monto: Number(gasto.monto),
                        categoria: gasto.categoria as CategoriaGasto,
                    }}
                />
            )}
        </div>
    );
}
