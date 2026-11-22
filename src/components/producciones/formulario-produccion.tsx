"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState } from "react";
import {
    registrarProduccion,
    type EstadoFormularioProduccion,
} from "@/app/actions/producciones";

type Producto = { id: number; nombre: string; receta: string | null };

const inicial: EstadoFormularioProduccion = {};

export default function FormularioProduccion({ productos }: { productos: Producto[] }) {
    const [estado, accion, pendiente] = useActionState(registrarProduccion, inicial);
    const error = estado.campos ?? {};

    return (
        <form action={accion} className="card grid max-w-2xl gap-4 p-5" noValidate>
            <p className="text-sm text-ink-soft">
                Solo aparecen productos activos con receta. Si faltan insumos, la producción queda{" "}
                <strong className="text-ink">pendiente</strong>: no descuenta stock ni registra
                gasto, y puedes re-verificarla cuando repongas el inventario.
            </p>

            {productos.length === 0 ? (
                <p className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning" role="alert">
                    No hay productos activos con receta. Para poder producir,{" "}
                    <Link href="/recetas/nuevo" className="underline">
                        crea una receta
                    </Link>{" "}
                    y{" "}
                    <Link href="/productos/nuevo" className="underline">
                        asígnala a un producto
                    </Link>
                    .
                </p>
            ) : null}

            <div>
                <label className="label" htmlFor="productoId">
                    Producto
                </label>
                <select
                    className="input min-h-11"
                    id="productoId"
                    name="productoId"
                    defaultValue=""
                    required
                    aria-invalid={Boolean(error.productoId)}
                    aria-describedby={error.productoId ? "error-productoId" : undefined}
                >
                    <option value="">Selecciona un producto…</option>
                    {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.receta && p.receta !== p.nombre ? `${p.nombre} · ${p.receta}` : p.nombre}
                        </option>
                    ))}
                </select>
                {error.productoId && (
                    <p id="error-productoId" className="error" role="alert">
                        {error.productoId}
                    </p>
                )}
            </div>

            <div className="max-w-56">
                <label className="label" htmlFor="cantidad">
                    Cantidad a producir
                </label>
                <input
                    className="input min-h-11 tabular-nums"
                    id="cantidad"
                    name="cantidad"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    defaultValue="1"
                    required
                    aria-invalid={Boolean(error.cantidad)}
                    aria-describedby={error.cantidad ? "error-cantidad" : undefined}
                />
                {error.cantidad && (
                    <p id="error-cantidad" className="error" role="alert">
                        {error.cantidad}
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
                    disabled={pendiente || productos.length === 0}
                    className="btn btn-primary"
                >
                    {pendiente ? "Registrando…" : "Registrar producción"}
                </button>
                <Cancelar href={"/producciones"} />
            </div>
        </form>
    );
}
