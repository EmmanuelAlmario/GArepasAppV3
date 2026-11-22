"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type Props = {
    /** Texto del botón que abre el diálogo. */
    etiqueta: string;
    titulo: string;
    descripcion?: string;
    /** Variante del disparador. */
    variante?: "primary" | "secondary" | "ghost";
    icono?: React.ReactNode;
    ancho?: "sm" | "md" | "lg";
    /** Para acciones dentro de una tabla (botón pequeño). */
    compacto?: boolean;
    children: React.ReactNode;
};

const ANCHOS = {
    sm: "w-[min(92vw,24rem)]",
    md: "w-[min(92vw,34rem)]",
    lg: "w-[min(94vw,46rem)]",
};

/**
 * Diálogo nativo (<dialog>): foco atrapado, Esc para cerrar y fondo inerte
 * sin dependencias. El formulario de adentro es server-safe: al guardar,
 * la action redirige y el diálogo desaparece con la navegación.
 */
export default function Modal({
    etiqueta,
    titulo,
    descripcion,
    variante = "primary",
    icono,
    ancho = "md",
    compacto = false,
    children,
}: Props) {
    const ref = useRef<HTMLDialogElement>(null);
    const cuerpo = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const dialogo = ref.current;
        const contenido = cuerpo.current;
        if (!dialogo) return;

        /* Al guardar se cierra de inmediato (la action redirige). Si el
         * servidor devuelve un error, el diálogo se reabre con el mensaje. */
        const alEnviar = (evento: Event) => {
            const formulario = evento.target as HTMLFormElement;
            if (!formulario.checkValidity?.()) return;
            requestAnimationFrame(() => dialogo.close());
        };

        const observar = new MutationObserver(() => {
            const falla = contenido?.querySelector(
                '[role="alert"], .error, [aria-invalid="true"]',
            );
            if (!dialogo.open && falla) {
                dialogo.showModal();
            }
        });

        dialogo.addEventListener("submit", alEnviar, true);
        if (contenido) {
            observar.observe(contenido, { childList: true, subtree: true, characterData: true });
        }

        return () => {
            dialogo.removeEventListener("submit", alEnviar, true);
            observar.disconnect();
        };
    }, []);

    function abrir() {
        const dialogo = ref.current;
        if (!dialogo) return;
        dialogo.showModal();
        // El primer campo del formulario recibe el foco: se puede escribir ya.
        requestAnimationFrame(() => {
            const campo = cuerpo.current?.querySelector<HTMLElement>(
                "input:not([type=hidden]), select, textarea",
            );
            campo?.focus();
        });
    }

    return (
        <>
            <button
                type="button"
                onClick={abrir}
                className={
                    compacto
                        ? "btn btn-ghost btn-sm"
                        : variante === "primary"
                          ? "btn btn-primary"
                          : variante === "secondary"
                            ? "btn btn-secondary"
                            : "btn btn-ghost"
                }
            >
                {icono}
                {etiqueta}
            </button>

            <dialog
                ref={ref}
                aria-labelledby="modal-titulo"
                className={`${ANCHOS[ancho]} rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40 open:fixed open:inset-0 open:m-auto open:h-max open:max-h-[calc(100dvh-4rem)]`}
                onClick={(e) => {
                    // Clic fuera del contenido = cerrar.
                    if (e.target === ref.current) ref.current?.close();
                }}
            >
                <div className="w-full">
                    <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
                        <div>
                            <h2 id="modal-titulo" className="section-title">
                                {titulo}
                            </h2>
                            {descripcion && (
                                <p className="mt-0.5 text-xs text-ink-soft">{descripcion}</p>
                            )}
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

                    <div
                        ref={cuerpo}
                        className="dialogo-cuerpo max-h-[calc(100dvh-10rem)] overflow-y-auto px-5 py-4"
                    >
                        {children}
                    </div>
                </div>
            </dialog>
        </>
    );
}
