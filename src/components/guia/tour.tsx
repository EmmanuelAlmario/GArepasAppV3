"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, HelpCircle, X } from "lucide-react";
import { CLAVE_TOUR, PASOS } from "@/lib/tour";

type Estado = { activo: boolean; paso: number };

const leer = (): Estado => {
    try {
        const crudo = localStorage.getItem(CLAVE_TOUR);
        if (!crudo) return { activo: false, paso: 0 };
        const valor = JSON.parse(crudo) as Estado;
        return {
            activo: Boolean(valor.activo),
            paso: Math.min(Math.max(0, Number(valor.paso) || 0), PASOS.length - 1),
        };
    } catch {
        return { activo: false, paso: 0 };
    }
};

/**
 * Tutorial activable: botón flotante + recorrido por pantallas.
 * Ilumina el elemento del que habla cuando existe; si no, muestra la
 * tarjeta centrada. El avance queda guardado para retomarlo después.
 */
export default function Tour() {
    const router = useRouter();
    const ruta = usePathname();
    const [estado, setEstado] = useState<Estado>({ activo: false, paso: 0 });
    const [rect, setRect] = useState<DOMRect | null>(null);
    const tarjeta = useRef<HTMLDivElement>(null);

    /* Se hidrata después de montar para no romper el SSR. */
    useEffect(() => {
        setEstado(leer());
        const abrir = () => setEstado({ activo: true, paso: 0 });
        window.addEventListener("abrir-tutorial", abrir);
        return () => window.removeEventListener("abrir-tutorial", abrir);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(CLAVE_TOUR, JSON.stringify(estado));
        } catch {
            /* modo privado */
        }
    }, [estado]);

    const paso = PASOS[estado.paso];
    const activo = estado.activo;

    /* Medir el elemento destacado cada vez que cambia el paso o la ruta. */
    useLayoutEffect(() => {
        if (!activo) {
            setRect(null);
            return;
        }

        const medir = () => {
            if (!paso.selector) {
                setRect(null);
                return;
            }
            const candidatos = document.querySelectorAll(paso.selector);
            const el = [...candidatos].find((n) => n.getBoundingClientRect().width > 0) ?? null;
            if (el) {
                const caja = el.getBoundingClientRect();
                /* Si el elemento está fuera de vista, se acerca antes de medir. */
                if (caja.top < 90 || caja.bottom > window.innerHeight - 90) {
                    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
                }
            }
            setRect(el ? el.getBoundingClientRect() : null);
        };

        medir();
        const espera = setTimeout(medir, 420);
        window.addEventListener("resize", medir);
        window.addEventListener("scroll", medir, true);
        return () => {
            clearTimeout(espera);
            window.removeEventListener("resize", medir);
            window.removeEventListener("scroll", medir, true);
        };
    }, [activo, paso.selector, ruta]);

    /* Si el paso vive en otra pantalla, se ofrece ir; nunca navega sola. */
    const enOtraPantalla = activo && paso.href !== ruta;

    const ir = useCallback(
        (indice: number) => {
            const destino = PASOS[indice];
            setEstado({ activo: true, paso: indice });
            if (destino && destino.href !== ruta) router.push(destino.href);
        },
        [router, ruta],
    );

    const cerrar = () => setEstado((s) => ({ activo: false, paso: s.paso }));

    useEffect(() => {
        if (!activo) return;
        tarjeta.current?.focus();
        const alTeclear = (evento: KeyboardEvent) => {
            if (evento.key === "Escape") cerrar();
            if (evento.key === "ArrowRight") ir(Math.min(PASOS.length - 1, estado.paso + 1));
            if (evento.key === "ArrowLeft") ir(Math.max(0, estado.paso - 1));
        };
        window.addEventListener("keydown", alTeclear);
        return () => window.removeEventListener("keydown", alTeclear);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activo, estado.paso]);

    if (!activo) {
        return (
            <button
                type="button"
                onClick={() => setEstado({ activo: true, paso: 0 })}
                aria-label="Abrir el tutorial"
                title="Tutorial"
                className="fixed right-4 bottom-4 z-40 flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 text-[0.8125rem] font-medium text-ink shadow-lg transition-colors hover:bg-surface-muted"
            >
                <HelpCircle size={17} className="text-accent" />
                Tutorial
            </button>
        );
    }

    const esUltimo = estado.paso === PASOS.length - 1;
    const sinElemento = !paso.selector || !rect;

    const posicionTarjeta = (() => {
        if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

        const MARGEN = 14;
        const ancho = 360;
        const alto = 240;
        const cabeDerecha = rect.right + MARGEN + ancho <= window.innerWidth;
        const cabeAbajo = rect.bottom + MARGEN + alto <= window.innerHeight;
        const clampI = (v: number) => Math.max(MARGEN, Math.min(v, window.innerWidth - ancho - MARGEN));
        const clampV = (v: number) => Math.max(MARGEN, Math.min(v, window.innerHeight - alto - MARGEN));

        /* Barra lateral o columna angosta: la tarjeta va al lado, no encima. */
        if (rect.width < window.innerWidth * 0.45 && cabeDerecha) {
            return { top: `${clampV(rect.top)}px`, left: `${rect.right + MARGEN}px` };
        }
        if (cabeAbajo) {
            return { top: `${rect.bottom + MARGEN}px`, left: `${clampI(rect.left)}px` };
        }
        return { top: `${clampV(rect.top - alto - MARGEN)}px`, left: `${clampI(rect.left)}px` };
    })();

    return (
        <>
            {/* Veladura con hueco: el elemento señalado queda legible. */}
            {rect && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed z-40 rounded-lg ring-2 ring-accent transition-all duration-200"
                    style={{
                        top: rect.top - 6,
                        left: rect.left - 6,
                        width: rect.width + 12,
                        height: rect.height + 12,
                        boxShadow: "0 0 0 9999px rgba(10, 8, 6, 0.6)",
                    }}
                />
            )}
            {!rect && (
                <div aria-hidden="true" className="fixed inset-0 z-40 bg-[rgba(10,8,6,0.45)]" />
            )}

            <div
                ref={tarjeta}
                role="dialog"
                aria-modal="false"
                aria-labelledby="tour-titulo"
                tabIndex={-1}
                className="fixed z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-4 shadow-2xl outline-none"
                style={posicionTarjeta}
            >
                <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                        Paso {estado.paso + 1} de {PASOS.length}
                    </p>
                    <button
                        type="button"
                        onClick={cerrar}
                        aria-label="Cerrar tutorial"
                        className="-mt-1 -mr-1 rounded-md p-1 text-ink-faint hover:bg-surface-muted hover:text-ink"
                    >
                        <X size={15} />
                    </button>
                </div>

                <h2 id="tour-titulo" className="mt-1 text-[0.9375rem] font-semibold text-ink">
                    {paso.titulo}
                </h2>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{paso.texto}</p>

                {enOtraPantalla && (
                    <button
                        type="button"
                        onClick={() => router.push(paso.href)}
                        className="mt-2 text-xs font-medium text-accent underline"
                    >
                        Ir a esta pantalla
                    </button>
                )}

                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-muted">
                    <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${((estado.paso + 1) / PASOS.length) * 100}%` }}
                    />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => ir(Math.max(0, estado.paso - 1))}
                        disabled={estado.paso === 0}
                        className="btn btn-ghost btn-sm"
                    >
                        <ArrowLeft size={14} /> Anterior
                    </button>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={cerrar} className="text-xs text-ink-faint hover:text-ink">
                            Saltar
                        </button>
                        <button
                            type="button"
                            onClick={() => (esUltimo ? cerrar() : ir(estado.paso + 1))}
                            className="btn btn-primary btn-sm"
                        >
                            {esUltimo ? "Terminar" : "Siguiente"} <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
