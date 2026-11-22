"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState } from "react";
import { guardarProducto, type EstadoProducto } from "@/app/actions/productos";

type Receta = { id: number; nombre: string };

type Props = {
    producto?: {
        id: number;
        nombre: string;
        precioVenta: number;
        stockActual: number;
        stockMinimo: number | null;
        recetaId: number | null;
        activo: boolean;
        bajoPedido: boolean | null;
        controlarStock: boolean;
    };
    recetas: Receta[];
};

const inicial: EstadoProducto = {};

export default function FormularioProducto({ producto, recetas }: Props) {
    const [estado, accion, pendiente] = useActionState(guardarProducto, inicial);
    const error = estado.campos ?? {};

    return (
        <form action={accion} className="grid max-w-2xl gap-4" noValidate>
            {producto && <input type="hidden" name="id" value={producto.id} />}

            <div>
                <label className="label" htmlFor="nombre">
                    Nombre
                </label>
                <input
                    className="input"
                    id="nombre"
                    name="nombre"
                    defaultValue={producto?.nombre}
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

            <div className="grid gap-4 sm:grid-cols-3">
                <div>
                    <label className="label" htmlFor="precioVenta">
                        Precio de venta
                    </label>
                    <input
                        className="input tabular-nums"
                        id="precioVenta"
                        name="precioVenta"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        defaultValue={producto?.precioVenta ?? ""}
                        required
                        aria-invalid={Boolean(error.precioVenta)}
                    />
                    {error.precioVenta && (
                        <p className="error" role="alert">{error.precioVenta}</p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="stockActual">
                        Stock actual
                    </label>
                    <input
                        className="input tabular-nums"
                        id="stockActual"
                        name="stockActual"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        defaultValue={producto?.stockActual ?? 0}
                        required
                    />
                    {error.stockActual && (
                        <p className="error" role="alert">{error.stockActual}</p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="stockMinimo">
                        Stock mínimo
                    </label>
                    <input
                        className="input tabular-nums"
                        id="stockMinimo"
                        name="stockMinimo"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        defaultValue={producto?.stockMinimo ?? ""}
                        placeholder="opcional"
                    />
                </div>
            </div>

            <div>
                <label className="label" htmlFor="recetaId">
                    Receta asociada
                </label>
                <select
                    className="input"
                    id="recetaId"
                    name="recetaId"
                    defaultValue={producto?.recetaId ?? ""}
                >
                    <option value="">Sin receta</option>
                    {recetas.map((r) => (
                        <option key={r.id} value={r.id}>
                            {r.nombre}
                        </option>
                    ))}
                </select>
            </div>

            <fieldset className="grid gap-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-xs tracking-wide text-ink-soft uppercase">
                    Estado
                </legend>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={producto ? producto.activo : true}
                        className="size-4 accent-accent"
                    />
                    Se muestra en la carta y se puede vender
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        name="bajoPedido"
                        defaultChecked={Boolean(producto?.bajoPedido)}
                        className="size-4 accent-accent"
                    />
                    Solo bajo pedido (se prepara al momento)
                </label>
                <label className="flex items-start gap-2 text-sm">
                    <input
                        type="checkbox"
                        name="controlarStock"
                        defaultChecked={producto ? producto.controlarStock : true}
                        className="mt-0.5 size-4 accent-accent"
                    />
                    <span>
                        Descontar stock al vender
                        <span className="block text-xs text-ink-soft">
                            Si lo desmarcas, el POS permite vender sin stock y el inventario puede
                            quedar negativo.
                        </span>
                    </span>
                </label>
            </fieldset>

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
                    {pendiente ? "Guardando…" : "Guardar producto"}
                </button>
                <Cancelar href={"/productos"} />
            </div>
        </form>
    );
}
