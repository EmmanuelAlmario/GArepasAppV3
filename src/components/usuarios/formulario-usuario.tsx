"use client";

import Link from "next/link";
import Cancelar from "@/components/ui/cancelar";
import { useActionState } from "react";
import { guardarUsuario, type EstadoUsuario } from "@/app/actions/usuarios";

type Props = {
    usuario?: {
        id: number;
        username: string;
        rol: "ADMIN" | "VENTAS";
        activo: boolean;
    };
};

const inicial: EstadoUsuario = {};

export default function FormularioUsuario({ usuario }: Props) {
    const [estado, accion, pendiente] = useActionState(guardarUsuario, inicial);
    const error = estado.campos ?? {};
    const esNuevo = !usuario;

    return (
        <form action={accion} className="grid max-w-2xl gap-4" noValidate>
            {usuario && <input type="hidden" name="id" value={usuario.id} />}

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="username">
                        Usuario
                    </label>
                    <input
                        className="input min-h-11"
                        id="username"
                        name="username"
                        defaultValue={usuario?.username}
                        maxLength={50}
                        autoComplete="off"
                        required
                        aria-invalid={Boolean(error.username)}
                        aria-describedby={error.username ? "error-username" : undefined}
                    />
                    {error.username && (
                        <p id="error-username" className="error" role="alert">
                            {error.username}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="password">
                        {esNuevo ? "Contraseña" : "Nueva contraseña (vacía = no cambiar)"}
                    </label>
                    <input
                        className="input min-h-11"
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        maxLength={100}
                        required={esNuevo}
                        aria-invalid={Boolean(error.password)}
                        aria-describedby={error.password ? "error-password" : undefined}
                    />
                    {error.password ? (
                        <p id="error-password" className="error" role="alert">
                            {error.password}
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-ink-faint">
                            Se guarda cifrada con bcrypt; nunca se muestra después.
                        </p>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="rol">
                        Rol
                    </label>
                    <select
                        className="input min-h-11"
                        id="rol"
                        name="rol"
                        defaultValue={usuario?.rol ?? "VENTAS"}
                        required
                        aria-invalid={Boolean(error.rol)}
                    >
                        <option value="ADMIN">Administrador</option>
                        <option value="VENTAS">Registrador de ventas</option>
                    </select>
                    {error.rol && <p className="error" role="alert">{error.rol}</p>}
                </div>

                <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border border-line px-3 text-sm">
                    <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={usuario ? usuario.activo : true}
                        className="size-4 accent-accent"
                    />
                    Activo (puede iniciar sesión)
                </label>
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
                    {pendiente ? "Guardando…" : esNuevo ? "Crear usuario" : "Guardar cambios"}
                </button>
                <Cancelar href={"/usuarios"} />
            </div>
        </form>
    );
}
