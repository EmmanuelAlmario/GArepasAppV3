import Link from "next/link";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { Plus, Search } from "lucide-react";
import { db } from "@/db";
import { insumos } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import FormularioInsumo from "@/components/insumos/formulario-insumo";
import Modal from "@/components/ui/modal";
import FormularioAjuste from "@/components/insumos/formulario-ajuste";
import { cantidad as formatCantidad, money } from "@/lib/format";
import { round2, round4 } from "@/lib/num";
import { desdeBase, etiqueta, factor, precioDesdeBase, type Unidad } from "@/lib/units";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insumos" };

const precioBaseFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 6 });

export default async function PaginaInsumos({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; filtro?: string; error?: string }>;
}) {
    await requireSesion("/insumos");
    const { q, filtro, error } = await searchParams;
    const busqueda = q?.trim() ?? "";

    const filas = await db
        .select()
        .from(insumos)
        .where(
            and(
                busqueda
                    ? or(
                          ilike(insumos.nombre, `%${busqueda}%`),
                          ilike(insumos.categoria, `%${busqueda}%`),
                          ilike(insumos.marca, `%${busqueda}%`),
                      )
                    : undefined,
                filtro === "bajo"
                    ? and(
                          eq(insumos.activo, true),
                          sql`${insumos.stockMinimo} is not null`,
                          sql`${insumos.stockActual} <= ${insumos.stockMinimo}`,
                      )
                    : undefined,
            ),
        )
        .orderBy(asc(insumos.nombre));

    /* Reposición sugerida: lo que está bajo el mínimo, en unidad de compra. */
    const faltantes = filas
        .filter(
            (i) =>
                i.activo &&
                i.stockMinimo !== null &&
                Number(i.stockActual) <= Number(i.stockMinimo),
        )
        .map((i) => {
            const unidad = i.unidadPresentacion as Unidad;
            const objetivo = Number(i.stockMinimo) * 2;
            const faltaBase = Math.max(0, objetivo - Number(i.stockActual));
            return {
                id: i.id,
                nombre: i.nombre,
                falta: `${formatCantidad(desdeBase(faltaBase, unidad))} ${etiqueta(unidad)}`,
                tiene: `${formatCantidad(desdeBase(Number(i.stockActual), unidad))} ${etiqueta(unidad)}`,
            };
        });

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        Insumos
                    </h1>
                    <p className="max-w-2xl text-sm text-ink-soft">
                        Materia prima del negocio. El stock y el precio se muestran en la unidad con
                        la que compras (kg, L, u); el sistema los guarda en unidad base (g, ml, u).
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {faltantes.length > 0 && (
                        <Modal
                            etiqueta={`Lista de compra (${faltantes.length})`}
                            titulo="Qué falta reponer"
                            descripcion="Calculado con el stock mínimo de cada insumo."
                            variante="secondary"
                            ancho="md"
                        >
                            <div className="grid gap-3">
                                <ul className="divide-y divide-line">
                                    {faltantes.map((f) => (
                                        <li
                                            key={f.id}
                                            className="flex items-baseline justify-between gap-3 py-2 text-sm"
                                        >
                                            <span className="text-ink">{f.nombre}</span>
                                            <span className="text-right text-xs text-ink-soft">
                                                faltan{" "}
                                                <span className="font-medium text-ink num">
                                                    {f.falta}
                                                </span>{" "}
                                                · tienes {f.tiene}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    className="btn btn-primary w-full"
                                    href={`https://wa.me/?text=${encodeURIComponent(
                                        "Lista de compra - Gordo Arepas:\n" +
                                            faltantes
                                                .map((f) => `- ${f.nombre}: ${f.falta}`)
                                                .join("\n"),
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Enviar por WhatsApp
                                </a>
                                <p className="text-xs text-ink-faint">
                                    En el mínimo se repone hasta el doble del mínimo; ajústalo en
                                    cada insumo si tu proveedor maneja otra presentación.
                                </p>
                            </div>
                        </Modal>
                    )}

                <Modal
                    etiqueta="Nuevo insumo"
                    titulo="Nuevo insumo"
                    descripcion="Precio y stock se guardan en unidad base."
                    icono={<Plus size={15} />}
                >
                    <FormularioInsumo />
                </Modal>
                </div>
            </header>

            {error && (
                <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="segmented mb-3">
                <Link href="/insumos" aria-current={filtro !== "bajo" ? "page" : undefined}>
                    Todos
                </Link>
                <Link
                    href="/insumos?filtro=bajo"
                    aria-current={filtro === "bajo" ? "page" : undefined}
                >
                    Bajo mínimo
                </Link>
            </div>

            <form method="get" className="filters" role="search">
                <div>
                    <label className="label" htmlFor="q">
                        Buscar insumo
                    </label>
                    <input
                        className="input"
                        id="q"
                        name="q"
                        type="search"
                        defaultValue={busqueda}
                        placeholder="Nombre, categoría o marca…"
                    />
                </div>
                <button type="submit" className="btn btn-secondary">
                    <Search size={15} /> Buscar
                </button>
                {busqueda !== "" && (
                    <Link
                        href="/insumos"
                        className="btn btn-secondary"
                    >
                        Limpiar
                    </Link>
                )}
            </form>

            {busqueda !== "" && (
                <p className="mb-2 text-sm text-ink-soft">
                    {filas.length} resultado(s) para “{busqueda}”.
                </p>
            )}

            {filas.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    {busqueda !== ""
                        ? "Ningún insumo coincide con la búsqueda. Prueba con otro nombre, categoría o marca."
                        : "No hay insumos registrados. Agrega el primero para poder crear recetas."}
                </p>
            ) : (
                <div className="card overflow-hidden" data-tour="insumos">
                    <table className="table">
                        <caption className="sr-only">
                            Insumos registrados con su stock y costo por unidad base
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Insumo</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Stock</th>
                                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                                    Precio base
                                </th>
                                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                                    Precio presentación
                                </th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((i) => {
                                const unidad = i.unidadPresentacion;
                                const bajo = i.stockMinimo !== null && i.stockActual <= i.stockMinimo;
                                const base =
                                    unidad === "KILOGRAMO"
                                        ? "GRAMO"
                                        : unidad === "LITRO"
                                          ? "MILILITRO"
                                          : unidad;
                                return (
                                    <tr key={i.id} className={i.activo ? "" : "opacity-60"}>
                                        <td className="px-4 py-2.5">
                                            <Link
                                                href={`/insumos/${i.id}`}
                                                className="font-medium text-ink hover:text-accent hover:underline"
                                            >
                                                {i.nombre}
                                            </Link>
                                            <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-ink-faint">
                                                <span>{i.categoria}</span>
                                                <span aria-hidden>·</span>
                                                <span>{i.marca}</span>
                                                {!i.activo && (
                                                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-ink-soft">
                                                        Inactivo
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            <span className={bajo ? "font-medium text-danger" : ""}>
                                                {formatCantidad(
                                                    round4(desdeBase(i.stockActual, unidad)),
                                                )}{" "}
                                                {etiqueta(unidad)}
                                            </span>
                                            {i.stockMinimo !== null && (
                                                <span className="block text-xs text-ink-faint">
                                                    mín.{" "}
                                                    {formatCantidad(
                                                        round4(desdeBase(i.stockMinimo, unidad)),
                                                    )}{" "}
                                                    {etiqueta(unidad)}
                                                </span>
                                            )}
                                            {bajo && (
                                                <span className="badge badge-danger mt-1">
                                                    Bajo mínimo
                                                </span>
                                            )}
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-right whitespace-nowrap text-ink-soft tabular-nums md:table-cell">
                                            ${precioBaseFmt.format(i.precioUnidadBase)} / {etiqueta(base)}
                                        </td>
                                        <td className="hidden px-4 py-2.5 text-right whitespace-nowrap tabular-nums sm:table-cell">
                                            {money(precioDesdeBase(i.precioUnidadBase, unidad))} /{" "}
                                            {etiqueta(unidad)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <Modal
                                                    etiqueta="Editar"
                                                    titulo="Editar insumo"
                                                    ancho="md"
                                                    variante="ghost"
                                                    compacto
                                                >
                                                    <FormularioInsumo
                                                        insumo={{
                                                            id: i.id,
                                                            nombre: i.nombre,
                                                            categoria: i.categoria,
                                                            marca: i.marca,
                                                            unidadMedida: i.unidadPresentacion as Unidad,
                                                            stockActual: round4(
                                                                desdeBase(i.stockActual, i.unidadPresentacion as Unidad),
                                                            ),
                                                            stockMinimo:
                                                                i.stockMinimo === null
                                                                    ? null
                                                                    : round4(
                                                                          desdeBase(
                                                                              i.stockMinimo,
                                                                              i.unidadPresentacion as Unidad,
                                                                          ),
                                                                      ),
                                                            precioCompra: round2(
                                                                precioDesdeBase(
                                                                    i.precioUnidadBase,
                                                                    i.unidadPresentacion as Unidad,
                                                                ),
                                                            ),
                                                            activo: i.activo,
                                                        }}
                                                    />
                                                </Modal>
                                                <Modal
                                                    etiqueta="Ajustar"
                                                    titulo="Ajustar stock"
                                                    ancho="sm"
                                                    variante="ghost"
                                                    compacto
                                                >
                                                    <FormularioAjuste
                                                        insumo={{
                                                            id: i.id,
                                                            nombre: i.nombre,
                                                            unidad: i.unidadPresentacion as Unidad,
                                                            stockActual: round4(
                                                                desdeBase(i.stockActual, i.unidadPresentacion as Unidad),
                                                            ),
                                                            stockMinimo:
                                                                i.stockMinimo === null
                                                                    ? null
                                                                    : round4(
                                                                          desdeBase(
                                                                              i.stockMinimo,
                                                                              i.unidadPresentacion as Unidad,
                                                                          ),
                                                                      ),
                                                            precioUnidadBase: i.precioUnidadBase,
                                                        }}
                                                    />
                                                </Modal>
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
