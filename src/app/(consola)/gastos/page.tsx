import Link from "next/link";
import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { gastos } from "@/db/schema";
import { fecha, money } from "@/lib/format";
import { requireSesion } from "@/lib/auth";
import Modal from "@/components/ui/modal";
import FormularioGasto from "@/components/gastos/formulario-gasto";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import {
    CATEGORIAS_GASTO,
    ETIQUETAS_CATEGORIA,
    rangoMes,
    type CategoriaGasto,
} from "@/lib/gastos";
import { eliminarGasto } from "@/app/actions/gastos";
import BotonConfirmar from "@/components/consola/boton-confirmar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gastos" };

const MENSAJES: Record<string, string> = {
    guardado: "Gasto guardado correctamente.",
    eliminado: "Gasto eliminado.",
};

export default async function PaginaGastos({
    searchParams,
}: {
    searchParams: Promise<{ categoria?: string; mes?: string; ok?: string; error?: string }>;
}) {
    await requireSesion("/gastos");
    const { categoria: categoriaCruda, mes, ok, error } = await searchParams;

    const categoria = (CATEGORIAS_GASTO as readonly string[]).includes(categoriaCruda ?? "")
        ? (categoriaCruda as CategoriaGasto)
        : undefined;
    const rango = rangoMes(mes);

    const condiciones: SQL[] = [];
    if (categoria) condiciones.push(eq(gastos.categoria, categoria));
    if (rango) condiciones.push(gte(gastos.fecha, rango.desde), lt(gastos.fecha, rango.hasta));

    const filas = await db
        .select({
            id: gastos.id,
            descripcion: gastos.descripcion,
            monto: gastos.monto,
            categoria: gastos.categoria,
            fecha: gastos.fecha,
            produccionId: gastos.produccionId,
        })
        .from(gastos)
        .where(and(...condiciones))
        .orderBy(desc(gastos.fecha));

    const total = filas.reduce((suma, g) => suma + Number(g.monto), 0);
    const hayFiltro = Boolean(categoria || rango);

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        Gastos
                    </h1>
                    <p className="text-sm text-ink-soft">
                        Gastos operativos del negocio. Los generados por una producción se gestionan
                        desde la producción.
                    </p>
                </div>
                <Modal
                    etiqueta="Registrar gasto"
                    titulo="Nuevo gasto"
                    descripcion="Afecta la utilidad del periodo."
                    icono={<Plus size={15} />}
                >
                    <FormularioGasto />
                </Modal>
            </header>

            {ok && MENSAJES[ok] && (
                <p role="status" className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink">
                    {MENSAJES[ok]}
                </p>
            )}
            {error && (
                <p role="alert" className="mb-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}

            <form method="get" className="filters">
                <div className="min-w-44">
                    <label className="label" htmlFor="categoria">
                        Categoría
                    </label>
                    <select
                        className="input min-h-11"
                        id="categoria"
                        name="categoria"
                        defaultValue={categoria ?? ""}
                    >
                        <option value="">Todas</option>
                        {CATEGORIAS_GASTO.map((c) => (
                            <option key={c} value={c}>
                                {ETIQUETAS_CATEGORIA[c]}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label" htmlFor="mes">
                        Mes
                    </label>
                    <input
                        className="input min-h-11"
                        id="mes"
                        name="mes"
                        type="month"
                        defaultValue={mes ?? ""}
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-secondary"
                >
                    Filtrar
                </button>
                {hayFiltro && (
                    <Link href="/gastos" className="btn btn-ghost btn-sm">
                        Limpiar
                    </Link>
                )}
                <p className="ml-auto text-sm text-ink-soft">
                    {filas.length} gasto{filas.length === 1 ? "" : "s"} ·{" "}
                    <span className="font-medium tabular-nums text-ink">{money(total)}</span>
                </p>
            </form>

            {filas.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    {hayFiltro
                        ? "No hay gastos para ese filtro."
                        : "No hay gastos registrados. Registra servicios, transporte u otros gastos para que los reportes reflejen la utilidad real."}
                </p>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="table">
                        <caption className="sr-only">
                            Gastos registrados, de la fecha más reciente a la más antigua
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Descripción</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Categoría</th>
                                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                                    Origen
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Monto</th>
                                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                                    Fecha
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((g) => (
                                <tr key={g.id}>
                                    <td className="px-4 py-2.5">
                                        <span className="font-medium text-ink">
                                            {g.descripcion}
                                        </span>
                                        <div className="text-[11px] text-ink-faint md:hidden">
                                            {fecha(g.fecha)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">
                                        {ETIQUETAS_CATEGORIA[g.categoria]}
                                    </td>
                                    <td className="hidden px-4 py-2.5 sm:table-cell">
                                        {g.produccionId !== null ? (
                                            <Link
                                                href={`/producciones/${g.produccionId}`}
                                                className="badge hover:underline"
                                            >
                                                Producción #{g.produccionId}
                                            </Link>
                                        ) : (
                                            <span className="text-xs text-ink-faint">Manual</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">{money(g.monto)}</td>
                                    <td className="hidden px-4 py-2.5 whitespace-nowrap text-ink-soft md:table-cell">
                                        {fecha(g.fecha)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-end gap-1">
                                            {g.produccionId === null ? (
                                                <>
                                                    <Modal
                                                        etiqueta="Editar"
                                                        titulo="Editar gasto"
                                                        ancho="sm"
                                                        variante="ghost"
                                                        compacto
                                                    >
                                                        <FormularioGasto
                                                            gasto={{
                                                                id: g.id,
                                                                descripcion: g.descripcion,
                                                                monto: Number(g.monto),
                                                                categoria: g.categoria,
                                                            }}
                                                        />
                                                    </Modal>
                                                    <ModalConfirmar
                                                        accion={eliminarGasto}
                                                        campos={{ id: g.id }}
                                                        etiqueta="Eliminar"
                                                        titulo="Eliminar este gasto"
                                                        descripcion="Se borra del historial y deja de restar en la utilidad del periodo."
                                                        confirmar="Eliminar"
                                                    />
                                                </>
                                            ) : (
                                                <span className="text-xs text-ink-faint">
                                                    Gestionado por la producción
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
