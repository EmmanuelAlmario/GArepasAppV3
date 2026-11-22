"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, X } from "lucide-react";
import { abrirJornada, cerrarJornada, type EstadoJornada } from "@/app/actions/jornada";
import { money } from "@/lib/format";
import { round2 } from "@/lib/num";

const inicial: EstadoJornada = {};

type Props = {
    abierta: { abiertaPor: string; desde: string; fondo: number; ventasEfectivo: number } | null;
};

export default function ControlJornada({ abierta }: Props) {
    const router = useRouter();
    const [abrir, accionAbrir, abriendo] = useActionState(abrirJornada, inicial);
    const [cerrar, accionCerrar, cerrando] = useActionState(cerrarJornada, inicial);
    const [retiros, setRetiros] = useState(0);
    const dialogoAbrir = useRef<HTMLDialogElement>(null);
    const dialogoCerrar = useRef<HTMLDialogElement>(null);

    const esperado = abierta ? round2(abierta.fondo + abierta.ventasEfectivo - retiros) : 0;

    useEffect(() => {
        if (!abrir.ok) return;
        dialogoAbrir.current?.close();
        router.refresh();
    }, [abrir.ok, router]);

    useEffect(() => {
        if (!cerrar.ok && !cerrar.error) return;
        if (cerrar.ok) {
            dialogoCerrar.current?.close();
            router.refresh();
        }
    }, [cerrar.ok, cerrar.error, router]);

    return (
        <section
            aria-label="Jornada de caja"
            data-tour="jornada"
            className="card mb-4 px-4 py-2.5"
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {abierta ? (
                    <>
                        <span className="badge badge-success">Jornada abierta</span>
                        <p className="min-w-0 flex-1 text-xs text-ink-soft">
                            Desde {abierta.desde} · abrió{" "}
                            <span className="font-medium text-ink">{abierta.abiertaPor}</span>
                            {" · "}fondo <span className="num">{money(abierta.fondo)}</span>
                            {" · "}efectivo vendido{" "}
                            <span className="num">{money(abierta.ventasEfectivo)}</span>
                        </p>
                        <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => dialogoCerrar.current?.showModal()}
                        >
                            <Lock size={13} /> Cerrar caja
                        </button>
                    </>
                ) : (
                    <>
                        <span className="badge badge-warning">Jornada cerrada</span>
                        <p className="min-w-0 flex-1 text-xs text-ink-soft">
                            Abre el día con el fondo con el que arranca la caja.
                        </p>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => dialogoAbrir.current?.showModal()}
                        >
                            <LockOpen size={13} /> Abrir jornada
                        </button>
                    </>
                )}
            </div>

            {(abrir.ok || cerrar.ok || cerrar.error || abrir.error) && (
                <p
                    role="status"
                    className={`mt-2 text-xs ${cerrar.error || abrir.error ? "text-danger" : "text-success"}`}
                >
                    {abrir.error ?? cerrar.error ?? cerrar.ok ?? abrir.ok}
                </p>
            )}

            {/* Abrir: fondo inicial. */}
            <dialog
                ref={dialogoAbrir}
                aria-labelledby="titulo-abrir"
                className="w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-line bg-surface p-0 backdrop:bg-black/40 open:fixed open:inset-0 open:m-auto open:h-max"
            >
                <div className="w-full">
                    <header className="flex items-start justify-between border-b border-line px-5 py-3.5">
                        <div>
                            <h2 id="titulo-abrir" className="section-title">
                                Abrir jornada
                            </h2>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                El fondo inicial se usa para calcular el arqueo al cerrar.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => dialogoAbrir.current?.close()}
                            className="rounded-md p-1.5 text-ink-faint hover:bg-surface-muted"
                            aria-label="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </header>

                    <form action={accionAbrir} className="grid gap-4 px-5 py-4">
                        <div>
                            <label className="label" htmlFor="fondoInicial">
                                Fondo inicial (efectivo en caja)
                            </label>
                            <input
                                className="input"
                                id="fondoInicial"
                                name="fondoInicial"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="100"
                                defaultValue={0}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={abriendo}>
                            {abriendo ? "Abriendo…" : "Abrir día"}
                        </button>
                    </form>
                </div>
            </dialog>

            {/* Cerrar: arqueo. */}
            <dialog
                ref={dialogoCerrar}
                aria-labelledby="titulo-cerrar"
                className="w-[calc(100vw-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 backdrop:bg-black/40 open:fixed open:inset-0 open:m-auto open:h-max"
            >
                <div className="w-full">
                    <header className="flex items-start justify-between border-b border-line px-5 py-3.5">
                        <div>
                            <h2 id="titulo-cerrar" className="section-title">
                                Cerrar caja
                            </h2>
                            <p className="mt-0.5 text-xs text-ink-soft">
                                Cuenta el efectivo y compara con lo que debería haber.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => dialogoCerrar.current?.close()}
                            className="rounded-md p-1.5 text-ink-faint hover:bg-surface-muted"
                            aria-label="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </header>

                    <form action={accionCerrar} className="grid gap-4 px-5 py-4">
                        <dl className="grid grid-cols-2 gap-y-1 rounded-lg bg-surface-muted px-3 py-2 text-xs">
                            <dt className="text-ink-soft">Fondo inicial</dt>
                            <dd className="text-right num">{money(abierta?.fondo ?? 0)}</dd>
                            <dt className="text-ink-soft">Ventas en efectivo</dt>
                            <dd className="text-right num">{money(abierta?.ventasEfectivo ?? 0)}</dd>
                            <dt className="font-medium text-ink">Esperado en caja</dt>
                            <dd className="text-right font-medium num">{money(esperado)}</dd>
                        </dl>

                        <div>
                            <label className="label" htmlFor="efectivoContado">
                                Efectivo contado
                            </label>
                            <input
                                className="input"
                                id="efectivoContado"
                                name="efectivoContado"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="100"
                                required
                            />
                            <p className="hint">
                                Cuenta billetes y monedas de la caja, sin el fondo de la casa.
                            </p>
                        </div>

                        <div>
                            <label className="label" htmlFor="retiros">
                                Retiros durante el día
                            </label>
                            <input
                                className="input"
                                id="retiros"
                                name="retiros"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="100"
                                defaultValue={0}
                                onChange={(e) => setRetiros(Number(e.target.value) || 0)}
                            />
                        </div>

                        <div>
                            <label className="label" htmlFor="notas">
                                Notas del cierre
                            </label>
                            <input
                                className="input"
                                id="notas"
                                name="notas"
                                maxLength={250}
                                placeholder="Opcional: faltante, propina, compra…"
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={cerrando}>
                            {cerrando ? "Cerrando…" : "Cerrar y guardar arqueo"}
                        </button>
                    </form>
                </div>
            </dialog>
        </section>
    );
}
