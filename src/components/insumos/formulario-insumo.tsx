"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState } from "react";
import { guardarInsumo, type EstadoInsumo } from "@/app/actions/insumos";
import { UNIDADES, etiqueta, type Unidad } from "@/lib/units";

type Props = {
    insumo?: {
        id: number;
        nombre: string;
        categoria: string;
        marca: string;
        unidadMedida: Unidad;
        stockActual: number;
        stockMinimo: number | null;
        precioCompra: number;
        activo: boolean;
    };
};

const inicial: EstadoInsumo = {};

export default function FormularioInsumo({ insumo }: Props) {
    const [estado, accion, pendiente] = useActionState(guardarInsumo, inicial);
    const error = estado.campos ?? {};

    return (
        <form action={accion} className="grid max-w-2xl gap-4" noValidate>
            {insumo && <input type="hidden" name="id" value={insumo.id} />}

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="nombre">
                        Nombre
                    </label>
                    <input
                        className="input min-h-11"
                        id="nombre"
                        name="nombre"
                        defaultValue={insumo?.nombre}
                        maxLength={60}
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
                    <label className="label" htmlFor="marca">
                        Marca
                    </label>
                    <input
                        className="input min-h-11"
                        id="marca"
                        name="marca"
                        defaultValue={insumo?.marca}
                        maxLength={30}
                        required
                        aria-invalid={Boolean(error.marca)}
                        aria-describedby={error.marca ? "error-marca" : undefined}
                    />
                    {error.marca && (
                        <p id="error-marca" className="error" role="alert">
                            {error.marca}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="categoria">
                        Categoría
                    </label>
                    <input
                        className="input min-h-11"
                        id="categoria"
                        name="categoria"
                        defaultValue={insumo?.categoria}
                        maxLength={30}
                        placeholder="Ej.: lácteos, harinas"
                        required
                        aria-invalid={Boolean(error.categoria)}
                        aria-describedby={error.categoria ? "error-categoria" : undefined}
                    />
                    {error.categoria && (
                        <p id="error-categoria" className="error" role="alert">
                            {error.categoria}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="unidadMedida">
                        Unidad de presentación
                    </label>
                    <select
                        className="input min-h-11"
                        id="unidadMedida"
                        name="unidadMedida"
                        defaultValue={insumo?.unidadMedida ?? "KILOGRAMO"}
                        required
                        aria-invalid={Boolean(error.unidadMedida)}
                        aria-describedby={error.unidadMedida ? "error-unidadMedida" : "ayuda-unidadMedida"}
                    >
                        {UNIDADES.map((u) => (
                            <option key={u} value={u}>
                                {etiqueta(u)}
                            </option>
                        ))}
                    </select>
                    <p id="ayuda-unidadMedida" className="mt-1 text-xs text-ink-faint">
                        Cómo lo compras (kg, L, unidad). El sistema guarda g, ml o unidad.
                    </p>
                    {error.unidadMedida && (
                        <p id="error-unidadMedida" className="error" role="alert">
                            {error.unidadMedida}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div>
                    <label className="label" htmlFor="stockActual">
                        Stock actual
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="stockActual"
                        name="stockActual"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        defaultValue={insumo?.stockActual ?? 0}
                        required
                        aria-invalid={Boolean(error.stockActual)}
                        aria-describedby={error.stockActual ? "error-stockActual" : undefined}
                    />
                    {error.stockActual && (
                        <p id="error-stockActual" className="error" role="alert">
                            {error.stockActual}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="stockMinimo">
                        Stock mínimo
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="stockMinimo"
                        name="stockMinimo"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        defaultValue={insumo?.stockMinimo ?? ""}
                        placeholder="Opcional"
                        aria-invalid={Boolean(error.stockMinimo)}
                        aria-describedby={error.stockMinimo ? "error-stockMinimo" : "ayuda-stockMinimo"}
                    />
                    <p id="ayuda-stockMinimo" className="mt-1 text-xs text-ink-faint">
                        Aviso de reposición (misma unidad).
                    </p>
                    {error.stockMinimo && (
                        <p id="error-stockMinimo" className="error" role="alert">
                            {error.stockMinimo}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="precioCompra">
                        Precio de compra por unidad
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="precioCompra"
                        name="precioCompra"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        defaultValue={insumo?.precioCompra ?? ""}
                        required
                        aria-invalid={Boolean(error.precioCompra)}
                        aria-describedby={error.precioCompra ? "error-precioCompra" : "ayuda-precioCompra"}
                    />
                    <p id="ayuda-precioCompra" className="mt-1 text-xs text-ink-faint">
                        Por kg, L o unidad según la presentación.
                    </p>
                    {error.precioCompra && (
                        <p id="error-precioCompra" className="error" role="alert">
                            {error.precioCompra}
                        </p>
                    )}
                </div>
            </div>

            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm">
                <input
                    type="checkbox"
                    name="activo"
                    defaultChecked={insumo ? insumo.activo : true}
                    className="size-4 accent-accent"
                />
                Activo (disponible para recetas)
            </label>

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
                    {pendiente ? "Guardando…" : "Guardar insumo"}
                </button>
                <Cancelar href={"/insumos"} />
            </div>
        </form>
    );
}
