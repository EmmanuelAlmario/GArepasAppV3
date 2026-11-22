"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

type Props = {
    /** Server action que se ejecuta al confirmar. */
    accion: (formData: FormData) => void | Promise<void>;
    /** Campos ocultos que necesita la action (id, etc.). */
    campos?: Record<string, string | number>;
    etiqueta: string;
    titulo: string;
    descripcion: string;
    confirmar?: string;
    peligro?: boolean;
    compacto?: boolean;
};

/**
 * Confirmación para acciones destructivas. Reemplaza window.confirm:
 * el usuario ve qué va a pasar y la action recibe el formulario completo.
 */
export default function ModalConfirmar({
    accion,
    campos = {},
    etiqueta,
    titulo,
    descripcion,
    confirmar = "Sí, continuar",
    peligro = true,
    compacto = true,
}: Props) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialogo = ref.current;
        if (!dialogo) return;
        const alEnviar = () => requestAnimationFrame(() => dialogo.close());
        dialogo.addEventListener("submit", alEnviar, true);
        return () => dialogo.removeEventListener("submit", alEnviar, true);
    }, []);

    return (
        <>
            <button
                type="button"
                onClick={() => ref.current?.showModal()}
                className={compacto ? "btn btn-ghost btn-sm text-danger" : "btn btn-danger"}
            >
                {etiqueta}
            </button>

            <dialog
                ref={ref}
                aria-labelledby="confirmar-titulo"
                className="w-[min(92vw,26rem)] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50 open:fixed open:inset-0 open:m-auto open:h-max"
                onClick={(e) => {
                    if (e.target === ref.current) ref.current?.close();
                }}
            >
                <div className="w-full">
                    <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
                        <div className="flex gap-2.5">
                            <span
                                className={[
                                    "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                                    peligro
                                        ? "bg-danger-tint text-danger"
                                        : "bg-warning-tint text-warning",
                                ].join(" ")}
                            >
                                <AlertTriangle size={16} />
                            </span>
                            <div>
                                <h2 id="confirmar-titulo" className="section-title">
                                    {titulo}
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">{descripcion}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => ref.current?.close()}
                            aria-label="Cerrar"
                            className="rounded-md p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
                        >
                            <X size={16} />
                        </button>
                    </header>

                    <form action={accion} className="flex flex-wrap justify-end gap-2 px-5 py-4">
                        {Object.entries(campos).map(([nombre, valor]) => (
                            <input key={nombre} type="hidden" name={nombre} value={valor} />
                        ))}
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => ref.current?.close()}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={peligro ? "btn btn-primary !bg-danger" : "btn btn-primary"}
                        >
                            {confirmar}
                        </button>
                    </form>
                </div>
            </dialog>
        </>
    );
}
