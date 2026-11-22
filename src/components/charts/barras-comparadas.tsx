type Fila = { etiqueta: string; a: number; b: number };

type Props = {
    datos: Fila[];
    titulo: string;
    etiquetaA: string;
    etiquetaB: string;
    formato?: (n: number) => string;
};

const ANCHO = 720;
const ALTO = 220;
const MARGEN = { arriba: 12, abajo: 26, izquierda: 8, derecha: 8 };

/** Barras agrupadas (ingresos vs gastos) en SVG, renderizadas en servidor. */
export default function BarrasComparadas({
    datos,
    titulo,
    etiquetaA,
    etiquetaB,
    formato = (n) => n.toLocaleString("es-CO"),
}: Props) {
    if (datos.length === 0) {
        return (
            <div className="empty">
                <p className="empty-title">Sin datos en el periodo</p>
            </div>
        );
    }

    const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
    const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
    const maximo = Math.max(1, ...datos.flatMap((d) => [d.a, d.b]));
    const anchoGrupo = anchoUtil / datos.length;
    const anchoBarra = Math.max(2, Math.min(14, anchoGrupo * 0.32));
    const paso = Math.max(1, Math.ceil(datos.length / 8));

    return (
        <figure className="m-0">
            <svg
                viewBox={`0 0 ${ANCHO} ${ALTO}`}
                className="block h-auto w-full"
                role="img"
                aria-label={titulo}
            >
                <title>{titulo}</title>
                {[0, 0.5, 1].map((p) => (
                    <line
                        key={p}
                        x1={MARGEN.izquierda}
                        x2={ANCHO - MARGEN.derecha}
                        y1={MARGEN.arriba + altoUtil * p}
                        y2={MARGEN.arriba + altoUtil * p}
                        stroke="var(--ga-line)"
                    />
                ))}

                {datos.map((d, i) => {
                    const centro = MARGEN.izquierda + anchoGrupo * i + anchoGrupo / 2;
                    const altoA = (d.a / maximo) * altoUtil;
                    const altoB = (d.b / maximo) * altoUtil;
                    return (
                        <g key={d.etiqueta}>
                            <rect
                                x={centro - anchoBarra - 1}
                                y={MARGEN.arriba + altoUtil - altoA}
                                width={anchoBarra}
                                height={altoA}
                                rx="2"
                                fill="var(--ga-chart)"
                            >
                                <title>{`${d.etiqueta} · ${etiquetaA}: ${formato(d.a)}`}</title>
                            </rect>
                            <rect
                                x={centro + 1}
                                y={MARGEN.arriba + altoUtil - altoB}
                                width={anchoBarra}
                                height={altoB}
                                rx="2"
                                fill="var(--ga-chart-alt)"
                                opacity="0.55"
                            >
                                <title>{`${d.etiqueta} · ${etiquetaB}: ${formato(d.b)}`}</title>
                            </rect>
                            {i % paso === 0 && (
                                <text
                                    x={centro}
                                    y={ALTO - 6}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="var(--ga-ink-faint)"
                                >
                                    {d.etiqueta.slice(8, 10)}/{d.etiqueta.slice(5, 7)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            <figcaption className="mt-1 flex flex-wrap gap-3 text-[11px] text-ink-faint">
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm" style={{ background: "var(--ga-chart)" }} />
                    {etiquetaA}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2 rounded-sm opacity-60"
                        style={{ background: "var(--ga-chart-alt)" }}
                    />
                    {etiquetaB}
                </span>
            </figcaption>
        </figure>
    );
}
