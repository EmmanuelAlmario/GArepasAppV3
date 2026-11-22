"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState } from "react";
import { guardarCliente, type EstadoCliente } from "@/app/actions/clientes";

type ClienteFormulario = {
    id: number;
    nombre: string;
    telefono: string | null;
    direccion: string | null;
    notas: string | null;
    activo: boolean;
};

const inicial: EstadoCliente = {};

export default function FormularioCliente({
    cliente,
    compacto = false,
}: {
    cliente?: ClienteFormulario;
    compacto?: boolean;
}) {
    const [estado, accion, pendiente] = useActionState(guardarCliente, inicial);
    const error = estado.campos ?? {};
    const volver = cliente ? `/clientes/${cliente.id}` : "/clientes";

    return (
        <form action={accion} className="grid gap-4" noValidate>
            {cliente && <input type="hidden" name="id" value={cliente.id} />}

            <div className={compacto ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
                <div>
                    <label className="label" htmlFor="nombre">
                        Nombre
                    </label>
                    <input
                        className="input min-h-11"
                        id="nombre"
                        name="nombre"
                        defaultValue={cliente?.nombre}
                        maxLength={80}
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
                    <label className="label" htmlFor="telefono">
                        Teléfono
                    </label>
                    <input
                        className="input min-h-11"
                        id="telefono"
                        name="telefono"
                        type="tel"
                        maxLength={30}
                        placeholder="Opcional"
                        defaultValue={cliente?.telefono ?? ""}
                        aria-invalid={Boolean(error.telefono)}
                    />
                    {error.telefono && (
                        <p className="error" role="alert">{error.telefono}</p>
                    )}
                </div>
            </div>

            <div>
                <label className="label" htmlFor="direccion">
                    Dirección
                </label>
                <input
                    className="input min-h-11"
                    id="direccion"
                    name="direccion"
                    maxLength={150}
                    placeholder="Opcional"
                    defaultValue={cliente?.direccion ?? ""}
                    aria-invalid={Boolean(error.direccion)}
                />
                {error.direccion && (
                    <p className="error" role="alert">{error.direccion}</p>
                )}
            </div>

            <div>
                <label className="label" htmlFor="notas">
                    Notas
                </label>
                <textarea
                    className="input min-h-22"
                    id="notas"
                    name="notas"
                    maxLength={250}
                    rows={3}
                    placeholder="Acuerdos de pago, referencias u observaciones"
                    defaultValue={cliente?.notas ?? ""}
                    aria-invalid={Boolean(error.notas)}
                />
                {error.notas && <p className="error" role="alert">{error.notas}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    name="activo"
                    defaultChecked={cliente ? cliente.activo : true}
                    className="size-4 accent-accent"
                />
                Activo (puede fiar y comprar)
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
                    {pendiente ? "Guardando…" : "Guardar cliente"}
                </button>
                <Cancelar href={volver} />
            </div>
        </form>
    );
}
