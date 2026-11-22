type Props = {
    filas: string[];
    columnas: string[];
    /** valores[fila][columna] */
    valores: number[][];
    titulo: string;
    formato?: (n: number) => string;
};

/**
 * Mapa de calor para descubrir cuándo se vende. El color codifica la
 * intensidad y cada celda expone su valor exacto en <title>.
 */
export default function MapaCalor({
    filas,
    columnas,
    valores,
    titulo,
    formato = (n) => n.toLocaleString("es-CO"),
}: Props) {
    const maximo = Math.max(1, ...valores.flat());
    const media = valores.flat().reduce((a, b) => a + b, 0) / Math.max(1, valores.flat().length);

    return (
        <figure className="m-0 overflow-x-auto">
            <table className="w-full border-separate border-spacing-[3px] text-[11px]">
                <caption className="sr-only">{titulo}</caption>
                <thead>
                    <tr>
                        <th scope="col" className="w-16" />
                        {columnas.map((c) => (
                            <th
                                key={c}
                                scope="col"
                                className="pb-1 text-center font-normal text-ink-faint"
                            >
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filas.map((fila, i) => (
                        <tr key={fila}>
                            <th scope="row" className="pr-2 text-right font-normal text-ink-faint">
                                {fila}
                            </th>
                            {columnas.map((col, j) => {
                                const valor = valores[i]?.[j] ?? 0;
                                const intensidad = valor / maximo;
                                return (
                                    <td key={col} className="p-0">
                                        <div
                                            className="grid h-7 place-items-center rounded-[4px] text-[10px] tabular-nums"
                                            style={{
                                                background:
                                                    valor === 0
                                                        ? "var(--ga-surface-muted)"
                                                        : `color-mix(in srgb, var(--ga-accent) ${Math.round(
                                                              12 + intensidad * 74,
                                                          )}%, transparent)`,
                                                color:
                                                    intensidad > 0.55
                                                        ? "var(--ga-on-accent)"
                                                        : "var(--ga-ink-soft)",
                                            }}
                                            title={`${fila} ${col}: ${formato(valor)}`}
                                        >
                                            {valor === 0
                                                ? ""
                                                : valor >= 1_000_000
                                                  ? `${(valor / 1_000_000).toFixed(1).replace(".", ",")}M`
                                                  : valor >= 1000
                                                    ? `${Math.round(valor / 1000)}k`
                                                    : valor}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <figcaption className="mt-2 text-[11px] text-ink-faint">
                Promedio por celda: {formato(Math.round(media))} · el color más fuerte es el horario que
                más vende.
            </figcaption>
        </figure>
    );
}
