"use client";

import Cancelar from "@/components/ui/cancelar";

import Link from "next/link";
import { useActionState } from "react";
import { registrarAbono, type EstadoVentaAccion } from "@/app/actions/ventas";
import { money } from "@/lib/format";

type Props = { ventaId: number; saldo: number; puedeCobrar: boolean };

const inicial: EstadoVentaAccion = {};

export default function FormularioCobro({ ventaId, saldo, puedeCobrar }: Props) {
    const [estado, accion, pendiente] = useActionState(registrarAbono, inicial);

    return (
        <form action={accion} className="grid gap-4" noValidate>
            <input type="hidden" name="ventaId" value={ventaId} />

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="monto">
                        Monto del cobro
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="monto"
                        name="monto"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        max={saldo}
                        defaultValue={saldo}
                        required
                        disabled={!puedeCobrar}
                    />
                    <p className="mt-1 text-xs text-ink-faint">
                        Deuda actual: {money(saldo)}. Puedes cobrar una parte.
                    </p>
                </div>

                <div>
                    <label className="label" htmlFor="metodo">
                        Método de pago
                    </label>
                    <select
                        className="input min-h-11"
                        id="metodo"
                        name="metodo"
                        defaultValue="EFECTIVO"
                        disabled={!puedeCobrar}
                    >
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TARJETA">Tarjeta</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="label" htmlFor="nota">
                    Nota (opcional)
                </label>
                <input
                    className="input min-h-11"
                    id="nota"
                    name="nota"
                    maxLength={150}
                    placeholder="Cómo se recibió el dinero"
                    disabled={!puedeCobrar}
                />
            </div>

            {estado.error && (
                <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {estado.error}
                </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
                <button
                    type="submit"
                    disabled={!puedeCobrar || pendiente}
                    className="btn btn-primary"
                >
                    {pendiente ? "Registrando…" : "Registrar cobro"}
                </button>
                <Cancelar href={`/ventas/${ventaId}`} />
            </div>
        </form>
    );
}
