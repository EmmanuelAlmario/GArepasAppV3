"use client";

import CountUp from "@/components/CountUp";
import SpotlightCard from "@/components/SpotlightCard";

type Props = {
    etiqueta: string;
    /** Valor numérico a animar. Si no se pasa, se muestra `texto`. */
    valor?: number;
    texto?: string;
    detalle?: string;
    formato?: "dinero" | "entero" | "decimal";
    sufijo?: string;
    /** Elemento ya renderizado (los iconos son componentes de servidor). */
    icono?: React.ReactNode;
};

/**
 * Métrica del panel. React Bits aporta dos piezas:
 * CountUp anima el número (respetando prefers-reduced-motion) y
 * SpotlightCard ilumina la tarjeta siguiendo el puntero.
 */
export default function StatCard({
    etiqueta,
    valor = 0,
    texto,
    detalle,
    formato = "entero",
    sufijo,
    icono,
}: Props) {
    const esDinero = formato === "dinero";

    return (
        <SpotlightCard
            theme="light"
            intensity={0.4}
            spotlightColor="rgba(166, 61, 18, 0.9)"
            spotlightSize={220}
            softness={0.9}
            borderGlow={0.35}
            proximity={48}
            smoothing={0.35}
            className="!rounded-[10px] !p-0"
            style={
                {
                    "--spotlight-card-surface": "var(--ga-surface)",
                    "--spotlight-card-border": "var(--ga-line)",
                    "--spotlight-card-shadow": "none",
                } as React.CSSProperties
            }
        >
            <div className="grid gap-0.5 p-4">
                <div className="flex items-start justify-between gap-2">
                    <span className="stat-label">{etiqueta}</span>
                    {icono && <span className="mt-0.5 text-ink-faint">{icono}</span>}
                </div>

                <span className="stat-value">
                    {texto ? (
                        texto
                    ) : (
                        <CountUp
                            to={valor}
                            from={0}
                            duration={0.9}
                            easing="expo"
                            trigger="load"
                            prefix={esDinero ? "$ " : ""}
                            separator={esDinero ? "." : "."}
                            decimals={formato === "decimal" ? 1 : 0}
                            suffix={sufijo}
                        />
                    )}
                </span>

                {detalle && <span className="stat-detail">{detalle}</span>}
            </div>
        </SpotlightCard>
    );
}
