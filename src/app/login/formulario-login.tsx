"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "@/app/actions/auth";

const inicial: EstadoLogin = {};

export default function FormularioLogin({ volver }: { volver: string }) {
    const [estado, accion, pendiente] = useActionState(iniciarSesion, inicial);

    return (
        <form action={accion} className="grid gap-4" noValidate>
            <input type="hidden" name="volver" value={volver} />

            <div>
                <label className="label" htmlFor="username">
                    Usuario
                </label>
                <input
                    className="input"
                    id="username"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    required
                    aria-describedby={estado.error ? "error-login" : undefined}
                />
            </div>

            <div>
                <label className="label" htmlFor="password">
                    Contraseña
                </label>
                <input
                    className="input"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    aria-describedby={estado.error ? "error-login" : undefined}
                />
            </div>

            {estado.error && (
                <p id="error-login" role="alert" className="alert alert-danger">
                    {estado.error}
                </p>
            )}

            <button type="submit" disabled={pendiente} className="btn btn-primary w-full">
                {pendiente ? "Entrando…" : "Entrar"}
            </button>
        </form>
    );
}
