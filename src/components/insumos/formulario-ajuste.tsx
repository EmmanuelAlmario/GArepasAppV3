"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState, useState } from "react";
import { ajustarStockInsumo, type EstadoAjuste } from "@/app/actions/insumos";
import { cantidad as formatCantidad, money } from "@/lib/format";
import { round4 } from "@/lib/num";
import { etiqueta, precioDesdeBase, type Unidad } from "@/lib/units";

const precioBaseFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 6 });

type Props = {
    insumo: {
        id: number;
        nombre: string;
        unidad: Unidad;
        stockActual: number;
        stockMinimo: number | null;
        precioUnidadBase: number;
    };
};

const inicial: EstadoAjuste = {};

export default function FormularioAjuste({ insumo }: Props) {
    const [estado, accion, pendiente] = useActionState(ajustarStockInsumo, inicial);
    const [cantidad, setCantidad] = useState("");
    const error = estado.campos ?? {};

    const numero = Number(cantidad.replace(",", "."));
    const valido = cantidad.trim() !== "" && Number.isFinite(numero) && numero !== 0;
    const resultado = valido ? round4(insumo.stockActual + numero) : insumo.stockActual;
    const valor = valido ? Math.abs(numero) * insumo.precioUnidadBase : 0;
    const unidad = etiqueta(insumo.unidad);
    const unidadBase: Unidad =
        insumo.unidad === "KILOGRAMO"
            ? "GRAMO"
            : insumo.unidad === "LITRO"
              ? "MILILITRO"
              : insumo.unidad;

    return (
        <form action={accion} className="grid max-w-2xl gap-4" noValidate>
            <input type="hidden" name="id" value={insumo.id} />

            <div className="card bg-surface-muted p-4 text-sm">
                <p className="font-medium text-ink">{insumo.nombre}</p>
                <p className="mt-1 text-ink-soft tabular-nums">
                    Stock actual: {formatCantidad(insumo.stockActual)} {unidad}
                    {insumo.stockMinimo !== null && (
                        <> · mínimo {formatCantidad(insumo.stockMinimo)} {unidad}</>
                    )}
                </p>
                <p className="text-ink-faint tabular-nums">
                    ${precioBaseFmt.format(insumo.precioUnidadBase)} / {etiqueta(unidadBase)} ·{" "}
                    {money(precioDesdeBase(insumo.precioUnidadBase, insumo.unidad))} / {unidad}
                </p>
            </div>

            <div>
                <label className="label" htmlFor="cantidad">
                    Cantidad a ajustar ({unidad})
                </label>
                <input
                    className="input min-h-11 tabular-nums"
                    id="cantidad"
                    name="cantidad"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="Ej.: 2,5 o -0,5"
                    required
                    aria-invalid={Boolean(error.cantidad)}
                    aria-describedby={error.cantidad ? "error-cantidad" : "ayuda-cantidad"}
                />
                <p id="ayuda-cantidad" className="mt-1 text-xs text-ink-faint">
                    Positiva repone (compra); negativa consume (merma o consumo directo).
                </p>
                {error.cantidad && (
                    <p id="error-cantidad" className="error" role="alert">
                        {error.cantidad}
                    </p>
                )}
            </div>

            <div>
                <label className="label" htmlFor="motivo">
                    Motivo
                </label>
                <input
                    className="input min-h-11"
                    id="motivo"
                    name="motivo"
                    maxLength={150}
                    defaultValue="Ajuste manual de inventario"
                    aria-invalid={Boolean(error.motivo)}
                    aria-describedby={error.motivo ? "error-motivo" : undefined}
                />
                {error.motivo && (
                    <p id="error-motivo" className="error" role="alert">
                        {error.motivo}
                    </p>
                )}
            </div>

            <div className="card p-4 text-sm">
                <p className="text-ink-soft">Resultado del ajuste</p>
                <p className="mt-1 text-lg font-medium text-ink tabular-nums">
                    {formatCantidad(resultado)} {unidad}
                </p>
                <p className="text-xs text-ink-faint tabular-nums">
                    Valor del movimiento: {money(round4(valor))}
                </p>
                {resultado < 0 && (
                    <p className="error" role="alert">
                        El stock quedaría negativo; no se puede guardar.
                    </p>
                )}
            </div>

            {estado.error && !Object.keys(error).length && (
                <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {estado.error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                    type="submit"
                    disabled={pendiente || resultado < 0}
                    className="btn btn-primary"
                >
                    {pendiente ? "Aplicando…" : "Aplicar ajuste"}
                </button>
                <Cancelar href={"/insumos"} />
            </div>
        </form>
    );
}
