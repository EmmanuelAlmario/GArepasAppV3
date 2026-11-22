"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { guardarReceta, type EstadoReceta } from "@/app/actions/recetas";
import { costoReceta, costoUnitario } from "@/lib/costos";
import { aBase, etiqueta, UNIDADES, type Unidad } from "@/lib/units";

export type InsumoOpcion = {
    id: number;
    nombre: string;
    unidadPresentacion: Unidad;
    precioUnidadBase: number;
};

type Detalle = { insumoId: number; cantidad: number; unidad: Unidad };
type Linea = { insumoId: string; cantidad: string; unidad: Unidad | "" };

type Props = {
    receta?: {
        id: number;
        nombre: string;
        descripcion: string | null;
        insumoProducidoId: number | null;
        rendimiento: number | null;
        detalles: Detalle[];
    };
    insumos: InsumoOpcion[];
};

const inicial: EstadoReceta = {};
const lineaVacia = (): Linea => ({ insumoId: "", cantidad: "", unidad: "" });

const costoFmt = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
});

export default function FormularioReceta({ receta, insumos }: Props) {
    const [estado, accion, pendiente] = useActionState(guardarReceta, inicial);
    const [lineas, setLineas] = useState<Linea[]>(() =>
        receta && receta.detalles.length > 0
            ? receta.detalles.map((d) => ({
                  insumoId: String(d.insumoId),
                  cantidad: String(d.cantidad),
                  unidad: d.unidad,
              }))
            : [lineaVacia()],
    );
    const [producido, setProducido] = useState(
        receta?.insumoProducidoId ? String(receta.insumoProducidoId) : "",
    );
    const [rendimiento, setRendimiento] = useState(
        receta?.rendimiento != null ? String(receta.rendimiento) : "",
    );
    const error = estado.campos ?? {};

    const actualizar = (indice: number, cambio: Partial<Linea>) =>
        setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...cambio } : l)));

    const elegirInsumo = (indice: number, valor: string) => {
        const insumo = insumos.find((i) => i.id === Number(valor));
        actualizar(indice, {
            insumoId: valor,
            ...(insumo ? { unidad: insumo.unidadPresentacion } : {}),
        });
    };

    const costos = lineas.flatMap((l) => {
        const insumo = insumos.find((i) => i.id === Number(l.insumoId));
        const numero = Number(l.cantidad.replace(",", "."));
        if (!insumo || !l.unidad || !Number.isFinite(numero) || numero <= 0) return [];
        return [{ cantidad: aBase(numero, l.unidad), precioUnidadBase: insumo.precioUnidadBase }];
    });
    const costoTotal = costoReceta(costos);
    const rendimientoNum = Number(rendimiento.replace(",", "."));
    const costoPorUnidad = costoUnitario(
        costoTotal,
        Number.isFinite(rendimientoNum) ? rendimientoNum : null,
    );

    return (
        <form action={accion} className="grid max-w-3xl gap-4" noValidate>
            {receta && <input type="hidden" name="id" value={receta.id} />}

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="nombre">
                        Nombre
                    </label>
                    <input
                        className="input min-h-11"
                        id="nombre"
                        name="nombre"
                        defaultValue={receta?.nombre}
                        maxLength={50}
                        required
                        aria-invalid={Boolean(error.nombre)}
                        aria-describedby={error.nombre ? "error-nombre" : undefined}
                    />
                    {error.nombre && (
                        <p id="error-nombre" className="error" role="alert">
                            {error.nombre}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="descripcion">
                        Descripción
                    </label>
                    <input
                        className="input min-h-11"
                        id="descripcion"
                        name="descripcion"
                        defaultValue={receta?.descripcion ?? ""}
                        maxLength={150}
                        placeholder="Opcional"
                        aria-invalid={Boolean(error.descripcion)}
                        aria-describedby={error.descripcion ? "error-descripcion" : undefined}
                    />
                    {error.descripcion && (
                        <p id="error-descripcion" className="error" role="alert">
                            {error.descripcion}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="insumoProducidoId">
                        Insumo que fabrica (opcional)
                    </label>
                    <select
                        className="input min-h-11"
                        id="insumoProducidoId"
                        name="insumoProducidoId"
                        value={producido}
                        onChange={(e) => setProducido(e.target.value)}
                    >
                        <option value="">Ninguno (receta de producto)</option>
                        {insumos.map((i) => (
                            <option key={i.id} value={i.id}>
                                {i.nombre}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-ink-faint">
                        Si la receta fabrica un insumo, su precio se calcula solo.
                    </p>
                </div>

                <div>
                    <label className="label" htmlFor="rendimiento">
                        Rinde (g, ml o unidades por lote)
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="rendimiento"
                        name="rendimiento"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0.0001"
                        value={rendimiento}
                        onChange={(e) => setRendimiento(e.target.value)}
                        placeholder={producido ? "Obligatorio" : "1"}
                        aria-invalid={Boolean(error.rendimiento)}
                        aria-describedby={error.rendimiento ? "error-rendimiento" : "ayuda-rendimiento"}
                    />
                    <p id="ayuda-rendimiento" className="mt-1 text-xs text-ink-faint">
                        {producido
                            ? "Cuánto rinde un lote del insumo fabricado."
                            : "Opcional en recetas de producto; por defecto 1."}
                    </p>
                    {error.rendimiento && (
                        <p id="error-rendimiento" className="error" role="alert">
                            {error.rendimiento}
                        </p>
                    )}
                </div>
            </div>

            <fieldset className="card p-4">
                <legend className="label mb-0 px-1">Insumos de la receta</legend>
                <p className="mb-3 text-xs text-ink-faint">
                    La cantidad se convierte a la unidad base del insumo (g, ml o unidad) al guardar.
                </p>

                <div className="grid gap-3">
                    {lineas.map((linea, i) => {
                        const insumo = insumos.find((x) => x.id === Number(linea.insumoId));
                        return (
                            <div
                                key={i}
                                className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end"
                            >
                                <div>
                                    <label className="label" htmlFor={`insumo-${i}`}>
                                        Insumo
                                    </label>
                                    <select
                                        className="input min-h-11"
                                        id={`insumo-${i}`}
                                        name="insumoId"
                                        value={linea.insumoId}
                                        onChange={(e) => elegirInsumo(i, e.target.value)}
                                    >
                                        <option value="">Selecciona un insumo…</option>
                                        {insumos.map((opcion) => (
                                            <option key={opcion.id} value={opcion.id}>
                                                {opcion.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    {insumo && (
                                        <p className="mt-1 text-xs text-ink-faint">
                                            Base:{" "}
                                            {etiqueta(
                                                insumo.unidadPresentacion === "KILOGRAMO"
                                                    ? "GRAMO"
                                                    : insumo.unidadPresentacion === "LITRO"
                                                      ? "MILILITRO"
                                                      : insumo.unidadPresentacion,
                                            )}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="label" htmlFor={`cantidad-${i}`}>
                                        Cantidad
                                    </label>
                                    <input
                                        className="input min-h-11 tabular-nums"
                                        id={`cantidad-${i}`}
                                        name="cantidad"
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        min="0"
                                        value={linea.cantidad}
                                        onChange={(e) => actualizar(i, { cantidad: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <label className="label" htmlFor={`unidad-${i}`}>
                                        Unidad
                                    </label>
                                    <select
                                        className="input min-h-11"
                                        id={`unidad-${i}`}
                                        name="unidad"
                                        value={linea.unidad}
                                        onChange={(e) =>
                                            actualizar(i, { unidad: e.target.value as Unidad })
                                        }
                                    >
                                        <option value="">Unidad…</option>
                                        {UNIDADES.map((u) => (
                                            <option key={u} value={u}>
                                                {etiqueta(u)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setLineas((prev) => prev.filter((_, indice) => indice !== i))
                                    }
                                    disabled={lineas.length === 1}
                                    aria-label="Quitar insumo"
                                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong px-3 text-danger hover:bg-danger-tint disabled:opacity-40"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => setLineas((prev) => [...prev, lineaVacia()])}
                    className="btn btn-secondary"
                >
                    <Plus size={16} /> Agregar insumo
                </button>
            </fieldset>

            <div className="card bg-surface-muted p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-ink-soft">Costo estimado del lote</span>
                    <span className="text-lg font-medium text-ink tabular-nums">
                        {costoFmt.format(costoTotal)}
                    </span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-ink-soft">Costo por unidad producida</span>
                    <span className="text-ink tabular-nums">
                        {costoFmt.format(costoPorUnidad)}
                    </span>
                </div>
            </div>

            {estado.error && !Object.keys(error).length && (
                <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {estado.error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                    type="submit"
                    disabled={pendiente}
                    className="btn btn-primary"
                >
                    {pendiente ? "Guardando…" : "Guardar receta"}
                </button>
                <Cancelar href={"/recetas"} />
            </div>
        </form>
    );
}
