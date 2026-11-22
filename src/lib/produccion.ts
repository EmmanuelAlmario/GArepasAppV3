/**
 * Reglas de una producción — espejo de ProduccionService.java.
 *
 * Lógica pura (sin base de datos ni React) para que el cálculo de líneas,
 * stock suficiente y costo total viva en un solo lugar y se pueda probar solo.
 */
import { round4 } from "./num";
import type { Unidad } from "./units";

export type InsumoParaLinea = {
    id: number;
    nombre: string;
    stockActual: number;
    precioUnidadBase: number;
};

export type LineaCalculada = {
    insumoId: number;
    insumoNombre: string;
    cantidadRequerida: number;
    /** 0 cuando falta stock; la requerida cuando alcanza (igual que el backend). */
    cantidadUsada: number;
    precioUnidadBaseSnapshot: number;
    costoLinea: number;
    suficiente: boolean;
};

/** Suma por insumo (la receta puede repetir el mismo insumo en varias líneas). */
export function requeridosPorInsumo(
    detalles: { insumoId: number; cantidad: number }[],
    cantidad: number,
): Map<number, number> {
    const requeridos = new Map<number, number>();
    for (const d of detalles) {
        requeridos.set(d.insumoId, (requeridos.get(d.insumoId) ?? 0) + d.cantidad * cantidad);
    }
    return requeridos;
}

/**
 * Construye las líneas con el stock bloqueado y los precios congelados.
 * `preciosCongelados` solo llega al re-verificar una producción pendiente.
 */
export function construirLineas(
    requeridos: Map<number, number>,
    insumos: Map<number, InsumoParaLinea>,
    preciosCongelados?: Map<number, number | null>,
): LineaCalculada[] {
    const lineas: LineaCalculada[] = [];
    for (const [insumoId, crudo] of requeridos) {
        const insumo = insumos.get(insumoId);
        if (!insumo) throw new Error("La receta apunta a un insumo que ya no existe.");

        const cantidadRequerida = round4(crudo);
        const suficiente = insumo.stockActual >= cantidadRequerida;
        const precioUnidadBaseSnapshot =
            preciosCongelados?.get(insumoId) ?? insumo.precioUnidadBase;

        lineas.push({
            insumoId,
            insumoNombre: insumo.nombre,
            cantidadRequerida,
            cantidadUsada: suficiente ? cantidadRequerida : 0,
            precioUnidadBaseSnapshot,
            costoLinea: round4(cantidadRequerida * precioUnidadBaseSnapshot),
            suficiente,
        });
    }
    return lineas;
}

export const costoTotalDe = (lineas: LineaCalculada[]) =>
    round4(lineas.reduce((suma, l) => suma + l.costoLinea, 0));

export const todasSuficientes = (lineas: LineaCalculada[]) => lineas.every((l) => l.suficiente);

export function mensajeInsumosInsuficientes(producto: string, lineas: LineaCalculada[]) {
    const faltantes = [...new Set(lineas.filter((l) => !l.suficiente).map((l) => l.insumoNombre))];
    return `Insumos insuficientes para '${producto}'. Faltan: ${faltantes.join(", ")}. Reabastece el inventario antes de vender.`;
}

/** Etiqueta de la unidad base (g, ml, u) a partir de la unidad de presentación. */
export function etiquetaBase(unidad: Unidad | null | undefined): string {
    if (unidad === "KILOGRAMO" || unidad === "GRAMO") return "g";
    if (unidad === "LITRO" || unidad === "MILILITRO") return "ml";
    return "u";
}

/* Autochequeo: npx tsx -e "import('./src/lib/produccion').then(m=>console.log(m.autochequeo()))" */
export function autochequeo() {
    const insumo = (id: number, stockActual: number, precio: number): [number, InsumoParaLinea] => [
        id,
        { id, nombre: `insumo-${id}`, stockActual, precioUnidadBase: precio },
    ];
    const receta = [
        { insumoId: 1, cantidad: 50 },
        { insumoId: 1, cantidad: 50 },
        { insumoId: 2, cantidad: 1 },
    ];

    const ok = construirLineas(requeridosPorInsumo(receta, 2), new Map([insumo(1, 500, 10), insumo(2, 5, 100)]));
    if (ok.length !== 2) throw new Error("debe agrupar líneas por insumo");
    if (ok[0].cantidadRequerida !== 200) throw new Error("cantidad × receta");
    if (ok[0].costoLinea !== 2000) throw new Error("costo de línea");
    if (!todasSuficientes(ok) || costoTotalDe(ok) !== 2200) throw new Error("costo total");

    const falta = construirLineas(requeridosPorInsumo(receta, 2), new Map([insumo(1, 199, 10), insumo(2, 5, 100)]));
    if (falta[0].suficiente || falta[0].cantidadUsada !== 0) throw new Error("faltante mal marcado");
    if (!mensajeInsumosInsuficientes("Arepa", falta).includes("insumo-1")) throw new Error("mensaje de faltantes");

    const congelado = construirLineas(new Map([[1, 10]]), new Map([insumo(1, 100, 99)]), new Map([[1, 7]]));
    if (congelado[0].precioUnidadBaseSnapshot !== 7) throw new Error("precio congelado");

    if (etiquetaBase("KILOGRAMO") !== "g" || etiquetaBase("MILILITRO") !== "ml" || etiquetaBase("UNIDAD") !== "u")
        throw new Error("etiqueta de unidad");

    return "producción OK";
}
