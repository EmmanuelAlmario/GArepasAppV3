type Punto = { etiqueta: string; valor: number };

type Props = {
    datos: Punto[];
    alto?: number;
    formato?: (n: number) => string;
    color?: string;
    titulo: string;
    /** Segunda serie opcional (por ejemplo, media móvil). */
    referencia?: number[];
    etiquetaReferencia?: string;
};

const ANCHO = 720;
const MARGEN = { arriba: 12, abajo: 26, izquierda: 8, derecha: 8 };

/**
 * Serie temporal en SVG puro: se renderiza en el servidor, sin librerías
 * ni JavaScript en el cliente. El detalle exacto vive en <title>.
 */
export default function SerieLinea({
    datos,
    alto = 220,
    formato = (n) => n.toLocaleString("es-CO"),
    color = "var(--ga-accent)",
    titulo,
    referencia,
    etiquetaReferencia,
}: Props) {
    if (datos.length === 0) {
        return (
            <div className="empty">
                <p className="empty-title">Sin datos en el periodo</p>
            </div>
        );
    }

    const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
    const altoUtil = alto - MARGEN.arriba - MARGEN.abajo;
    const maximo = Math.max(1, ...datos.map((d) => d.valor), ...(referencia ?? []));
    const x = (indice: number) =>
        MARGEN.izquierda + (datos.length === 1 ? anchoUtil / 2 : (indice / (datos.length - 1)) * anchoUtil);
    const y = (valor: number) => MARGEN.arriba + altoUtil - (valor / maximo) * altoUtil;

    const linea = datos.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`).join(" ");
    const area = `${linea} L${x(datos.length - 1).toFixed(1)},${(MARGEN.arriba + altoUtil).toFixed(1)} L${x(0).toFixed(1)},${(MARGEN.arriba + altoUtil).toFixed(1)} Z`;
    const lineaRef = referencia
        ?.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join(" ");

    const paso = Math.max(1, Math.ceil(datos.length / 6));
    const idGradiente = `grad-${titulo.replace(/\s+/g, "-").toLowerCase()}`;

    return (
        <figure className="m-0">
            <svg
                viewBox={`0 0 ${ANCHO} ${alto}`}
                className="block h-auto w-full"
                role="img"
                aria-label={titulo}
            >
                <title>{titulo}</title>
                <defs>
                    <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* Rejilla horizontal */}
                {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                    <line
                        key={p}
                        x1={MARGEN.izquierda}
                        x2={ANCHO - MARGEN.derecha}
                        y1={MARGEN.arriba + altoUtil * p}
                        y2={MARGEN.arriba + altoUtil * p}
                        stroke="var(--ga-line)"
                        strokeWidth="1"
                    />
                ))}

                <path d={area} fill={`url(#${idGradiente})`} />
                <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

                {lineaRef && (
                    <path
                        d={lineaRef}
                        fill="none"
                        stroke="var(--ga-ink-faint)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                    />
                )}

                {/* Puntos con su valor exacto */}
                {datos.map((d, i) => (
                    <circle key={d.etiqueta} cx={x(i)} cy={y(d.valor)} r="2.5" fill={color}>
                        <title>{`${d.etiqueta}: ${formato(d.valor)}`}</title>
                    </circle>
                ))}

                {/* Etiquetas del eje X */}
                {datos.map((d, i) =>
                    i % paso === 0 ? (
                        <text
                            key={`x-${d.etiqueta}`}
                            x={x(i)}
                            y={alto - 6}
                            textAnchor="middle"
                            fontSize="10"
                            fill="var(--ga-ink-faint)"
                        >
                            {d.etiqueta.slice(8, 10)}/{d.etiqueta.slice(5, 7)}
                        </text>
                    ) : null,
                )}
            </svg>

            {(referencia || etiquetaReferencia) && (
                <figcaption className="mt-1 flex flex-wrap gap-3 text-[11px] text-ink-faint">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-0.5 w-4 rounded" style={{ background: color }} /> Diario
                    </span>
                    {lineaRef && (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-0.5 w-4 rounded border-t border-dashed border-ink-faint" />
                            {etiquetaReferencia ?? "Media móvil"}
                        </span>
                    )}
                </figcaption>
            )}
        </figure>
    );
}
