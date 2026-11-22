"use client";

import { useActionState } from "react";
import { guardarConfiguracion, type EstadoConfiguracion } from "@/app/actions/configuracion";

export type ConfiguracionFormulario = {
    nombreComercial: string;
    identificacionFiscal: string | null;
    telefono: string | null;
    direccion: string | null;
    impuestoPorcentaje: number;
    comisionAppPct: number;
    objetivoFoodCost: number;
    metaTicket: number;
    mensajeRecibo: string | null;
    logoUrl: string | null;
};

const inicial: EstadoConfiguracion = {};

export default function FormularioConfiguracion({ config }: { config: ConfiguracionFormulario }) {
    const [estado, accion, pendiente] = useActionState(guardarConfiguracion, inicial);
    const error = estado.campos ?? {};

    return (
        <form action={accion} className="grid max-w-3xl gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="nombreComercial">
                        Nombre comercial
                    </label>
                    <input
                        className="input min-h-11"
                        id="nombreComercial"
                        name="nombreComercial"
                        defaultValue={config.nombreComercial}
                        maxLength={80}
                        required
                        aria-invalid={Boolean(error.nombreComercial)}
                        aria-describedby={error.nombreComercial ? "error-nombreComercial" : undefined}
                    />
                    {error.nombreComercial && (
                        <p id="error-nombreComercial" className="error" role="alert">
                            {error.nombreComercial}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="identificacionFiscal">
                        Identificación fiscal
                    </label>
                    <input
                        className="input min-h-11"
                        id="identificacionFiscal"
                        name="identificacionFiscal"
                        defaultValue={config.identificacionFiscal ?? ""}
                        maxLength={40}
                        placeholder="Ej. NIT 900123456-7"
                    />
                    {error.identificacionFiscal && (
                        <p className="error" role="alert">{error.identificacionFiscal}</p>
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
                        defaultValue={config.telefono ?? ""}
                        maxLength={30}
                        placeholder="Opcional"
                    />
                    {error.telefono && (
                        <p className="error" role="alert">{error.telefono}</p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="direccion">
                        Dirección
                    </label>
                    <input
                        className="input min-h-11"
                        id="direccion"
                        name="direccion"
                        defaultValue={config.direccion ?? ""}
                        maxLength={150}
                        placeholder="Opcional"
                    />
                    {error.direccion && (
                        <p className="error" role="alert">{error.direccion}</p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="impuestoPorcentaje">
                        Impuesto (%)
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="impuestoPorcentaje"
                        name="impuestoPorcentaje"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={config.impuestoPorcentaje}
                        required
                        aria-invalid={Boolean(error.impuestoPorcentaje)}
                    />
                    {error.impuestoPorcentaje ? (
                        <p className="error" role="alert">{error.impuestoPorcentaje}</p>
                    ) : (
                        <p className="mt-1 text-xs text-ink-faint">Se aplica a cada venta registrada.</p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="objetivoFoodCost">
                        Food cost objetivo (%)
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="objetivoFoodCost"
                        name="objetivoFoodCost"
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="1"
                        max="80"
                        defaultValue={config.objetivoFoodCost}
                    />
                    <p className="mt-1 text-xs text-ink-faint">
                        El motor de alertas avisa cuando un producto lo supera.
                    </p>
                    {error.objetivoFoodCost && (
                        <p className="error" role="alert">
                            {error.objetivoFoodCost}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="metaTicket">
                        Meta de ticket promedio
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="metaTicket"
                        name="metaTicket"
                        type="number"
                        inputMode="decimal"
                        step="500"
                        min="0"
                        defaultValue={config.metaTicket}
                    />
                    {error.metaTicket && (
                        <p className="error" role="alert">
                            {error.metaTicket}
                        </p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="comisionAppPct">
                        Comisión de la app de domicilios (%)
                    </label>
                    <input
                        className="input min-h-11 tabular-nums"
                        id="comisionAppPct"
                        name="comisionAppPct"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max="60"
                        defaultValue={config.comisionAppPct}
                    />
                    <p className="mt-1 text-xs text-ink-faint">
                        Se descuenta del margen cuando el pedido entra por el canal APP.
                    </p>
                    {error.comisionAppPct && (
                        <p className="error" role="alert">{error.comisionAppPct}</p>
                    )}
                </div>

                <div>
                    <label className="label" htmlFor="logoUrl">
                        Ruta del logo
                    </label>
                    <input
                        className="input min-h-11"
                        id="logoUrl"
                        name="logoUrl"
                        defaultValue={config.logoUrl ?? ""}
                        maxLength={250}
                        placeholder="Opcional"
                    />
                    {error.logoUrl ? (
                        <p className="error" role="alert">{error.logoUrl}</p>
                    ) : (
                        <p className="mt-1 text-xs text-ink-faint">Ruta dentro de /images o URL externa.</p>
                    )}
                </div>
            </div>

            <div>
                <label className="label" htmlFor="mensajeRecibo">
                    Mensaje del recibo
                </label>
                <textarea
                    className="input min-h-11"
                    id="mensajeRecibo"
                    name="mensajeRecibo"
                    defaultValue={config.mensajeRecibo ?? ""}
                    maxLength={250}
                    rows={2}
                    placeholder="Opcional"
                />
                {error.mensajeRecibo ? (
                    <p className="error" role="alert">{error.mensajeRecibo}</p>
                ) : (
                    <p className="mt-1 text-xs text-ink-faint">Texto que aparece al pie de cada recibo.</p>
                )}
            </div>

            {estado.error && !Object.keys(error).length && (
                <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
                    {estado.error}
                </p>
            )}

            <div className="pt-1">
                <button
                    type="submit"
                    disabled={pendiente}
                    className="btn btn-primary"
                >
                    {pendiente ? "Guardando…" : "Guardar configuración"}
                </button>
            </div>
        </form>
    );
}
