"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import {
    actualizarPrecioExtra,
    alternarExtra,
    guardarExtra,
    type EstadoExtra,
} from "@/app/actions/extras";

type Extra = { id: number; nombre: string; precio: number; activo: boolean };

const inicial: EstadoExtra = {};

/** Extras con precio: queso, papita, salsa. Lo que antes era "al ojo". */
export default function ExtrasCarta({ extras }: { extras: Extra[] }) {
    const [estado, accion, pendiente] = useActionState(guardarExtra, inicial);

    return (
        <section className="card mt-4" aria-labelledby="extras-carta">
            <div className="panel-head">
                <h2 id="extras-carta" className="section-title">
                    Extras
                </h2>
                <span className="text-xs text-ink-faint">Se cobran aparte en el POS</span>
            </div>

            <ul className="divide-y divide-line">
                {extras.map((extra) => (
                    <li
                        key={extra.id}
                        className={`flex flex-wrap items-center gap-2 px-4 py-2 ${
                            extra.activo ? "" : "opacity-55"
                        }`}
                    >
                        <span className="min-w-32 flex-1 text-[0.8125rem] text-ink">
                            {extra.nombre}
                        </span>

                        <form action={actualizarPrecioExtra} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={extra.id} />
                            <input
                                className="input h-8 w-24 min-h-0 py-0 text-right text-xs num"
                                name="precio"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="100"
                                defaultValue={extra.precio}
                                aria-label={`Precio de ${extra.nombre}`}
                            />
                            <button type="submit" className="btn btn-ghost btn-sm">
                                Guardar precio
                            </button>
                        </form>

                        <form action={alternarExtra}>
                            <input type="hidden" name="id" value={extra.id} />
                            <button type="submit" className="btn btn-secondary btn-sm">
                                {extra.activo ? "Desactivar" : "Activar"}
                            </button>
                        </form>
                    </li>
                ))}
            </ul>

            <form action={accion} className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
                <div className="min-w-40 flex-1">
                    <label className="label" htmlFor="extra-nombre">
                        Nuevo extra
                    </label>
                    <input
                        className="input"
                        id="extra-nombre"
                        name="nombre"
                        maxLength={40}
                        placeholder="Ej. Queso extra"
                        required
                    />
                </div>
                <div>
                    <label className="label" htmlFor="extra-precio">
                        Precio
                    </label>
                    <input
                        className="input w-28 text-right num"
                        id="extra-precio"
                        name="precio"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="100"
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={pendiente}>
                    <Plus size={15} /> {pendiente ? "Guardando…" : "Agregar"}
                </button>
                {estado.error && (
                    <p role="alert" className="w-full text-xs text-danger">
                        {estado.error}
                    </p>
                )}
            </form>

            <p className="px-4 pb-3 text-xs text-ink-faint">
                Precio actual: {extras.filter((e) => e.activo).length} activos ·{" "}
                {extras.length} en total. Los pedidos viejos conservan el precio del momento.
            </p>
        </section>
    );
}
