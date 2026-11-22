import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ajustesInventario, insumos } from "@/db/schema";
import FormularioAjuste from "@/components/insumos/formulario-ajuste";
import { requireSesion } from "@/lib/auth";
import { cantidad as formatCantidad, fechaHoraCorta, money } from "@/lib/format";
import { round4 } from "@/lib/num";
import { desdeBase, etiqueta } from "@/lib/units";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustar stock" };

export default async function PaginaAjusteStock({
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

    const movimientos = await db
        .select()
        .from(ajustesInventario)
        .where(eq(ajustesInventario.insumoId, numero))
        .orderBy(desc(ajustesInventario.fecha))
        .limit(10);

    const unidad = insumo.unidadPresentacion;

    return (
        <div className="page">
            <header className="mb-5">
                <h1 className="page-title">
                    Ajustar stock
                </h1>
                <p className="text-sm text-ink-soft">
                    Reponer compras, registrar mermas o consumo directo de {insumo.nombre}.
                </p>
            </header>

            <FormularioAjuste
                insumo={{
                    id: insumo.id,
                    nombre: insumo.nombre,
                    unidad,
                    stockActual: round4(desdeBase(insumo.stockActual, unidad)),
                    stockMinimo:
                        insumo.stockMinimo === null
                            ? null
                            : round4(desdeBase(insumo.stockMinimo, unidad)),
                    precioUnidadBase: insumo.precioUnidadBase,
                }}
            />

            <section className="mt-8 max-w-3xl">
                <h2 className="section-title">Últimos movimientos</h2>
                {movimientos.length === 0 ? (
                    <p className="card p-6 text-sm text-ink-faint">
                        Este insumo todavía no tiene ajustes de inventario.
                    </p>
                ) : (
                    <div className="card overflow-hidden">
                        <table className="table">
                            <caption className="sr-only">Últimos ajustes de inventario del insumo</caption>
                            <thead>
                                <tr>
                                    <th scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
                                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Ajuste</th>
                                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Stock</th>
                                    <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                                        Valor
                                    </th>
                                    <th scope="col" className="px-4 py-2.5 font-medium">Motivo / usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movimientos.map((m) => (
                                    <tr key={m.id}>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">
                                            {fechaHoraCorta(m.fecha)}
                                        </td>
                                        <td
                                            className={`px-4 py-2.5 text-right tabular-nums ${
                                                m.delta < 0 ? "text-danger" : "text-success"
                                            }`}
                                        >
                                            {m.delta > 0 ? "+" : ""}
                                            {formatCantidad(round4(desdeBase(m.delta, unidad)))}{" "}
                                            {etiqueta(unidad)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {formatCantidad(
                                                round4(desdeBase(m.stockResultante, unidad)),
                                            )}{" "}
                                            {etiqueta(unidad)}
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">
                                            {money(m.valor)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="text-ink">{m.motivo}</p>
                                            <p className="text-xs text-ink-faint">{m.usuario}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <Link
                href="/insumos"
                className="btn btn-secondary"
            >
                Volver al listado
            </Link>
        </div>
    );
}
