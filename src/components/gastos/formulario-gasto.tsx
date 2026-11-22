"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState } from "react";
import { guardarGasto, type EstadoGasto } from "@/app/actions/gastos";
import {
    CATEGORIAS_GASTO,
    ETIQUETAS_CATEGORIA,
    type CategoriaGasto,
} from "@/lib/gastos";

type GastoEditable = {
    id: number;
    descripcion: string;
    monto: number;
    categoria: CategoriaGasto;
};

const inicial: EstadoGasto = {};

export default function FormularioGasto({ gasto }: { gasto?: GastoEditable }) {
    const [estado, accion, pendiente] = useActionState(guardarGasto, inicial);
    const error = estado.campos ?? {};

    return (
        <form action={accion} className="card grid max-w-2xl gap-4 p-5" noValidate>
            {gasto && <input type="hidden" name="id" value={gasto.id} />}

            <div>
                <label className="label" htmlFor="descripcion">
                    Descripción
                </label>
                <input
                    className="input min-h-11"
                    id="descripcion"
                    name="descripcion"
                    defaultValue={gasto?.descripcion}
                    maxLength={150}
                    required
                    aria-invalid={Boolean(error.descripcion)}
                    aria-describedby={error.descripcion ? "error-descripcion" : undefined}
                />
                {error.descripcion && (
                    <p id="error-descripcion" className="error" role="alert">
                        {error.descripcion}
                    </p>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="monto">
                        Monto (pesos)
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="monto"
                        name="monto"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        defaultValue={gasto ? Math.round(Number(gasto.monto)) : ""}
                        required
                        aria-invalid={Boolean(error.monto)}
                        aria-describedby={error.monto ? "error-monto" : undefined}
                    />
                    {error.monto && (
                        <p id="error-monto" className="error" role="alert">
                            {error.monto}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="categoria">
                        Categoría
                    </label>
                    <select
                        className="input min-h-11"
                        id="categoria"
                        name="categoria"
                        defaultValue={gasto?.categoria ?? ""}
                        required
                        aria-invalid={Boolean(error.categoria)}
                        aria-describedby={error.categoria ? "error-categoria" : undefined}
                    >
                        <option value="">Selecciona una categoría…</option>
                        {CATEGORIAS_GASTO.map((c) => (
                            <option key={c} value={c}>
                                {ETIQUETAS_CATEGORIA[c]}
                            </option>
                        ))}
                    </select>
                    {error.categoria && (
                        <p id="error-categoria" className="error" role="alert">
                            {error.categoria}
                        </p>
                    )}
                </div>
            </div>

            <p className="text-xs text-ink-faint">
                {gasto
                    ? "La fecha original del gasto no cambia al editarlo."
                    : "La fecha se registra automáticamente al guardar."}
            </p>

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
                    {pendiente ? "Guardando…" : "Guardar gasto"}
                </button>
                <Cancelar href={"/gastos"} />
            </div>
        </form>
    );
}
