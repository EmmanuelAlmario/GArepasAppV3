/**
 * Costos de recetas y productos — espejo de domain/service/CostoService.java.
 *
 * Todo se calcula con cantidades en unidad base (g, ml, unidad) y precios
 * por unidad base. Regla del negocio: costo = cantidad × precioUnidadBase,
 * redondeado a 4 decimales.
 */
import { round4 } from "./num";

export type LineaCosto = {
    /** Cantidad en unidad base (gramo, mililitro o unidad). */
    cantidad: number;
    /** Precio por gramo, mililitro o unidad. */
    precioUnidadBase: number | null | undefined;
};

export const costoLinea = ({ cantidad, precioUnidadBase }: LineaCosto) =>
    cantidad * (precioUnidadBase ?? 0);

/** Costo total de una receta (suma de sus líneas), redondeado a 4. */
export function costoReceta(lineas: readonly LineaCosto[]): number {
    return round4(lineas.reduce((total, linea) => total + costoLinea(linea), 0));
}

/** Rendimiento de un lote; 1 cuando no aplica o viene inválido. */
export function rendimientoDe(rendimiento: number | null | undefined): number {
    return rendimiento != null && rendimiento > 0 ? rendimiento : 1;
}

/** Costo por unidad producida (costo total ÷ rendimiento), redondeado a 4. */
export function costoUnitario(costoTotal: number, rendimiento?: number | null): number {
    return round4(costoTotal / rendimientoDe(rendimiento));
}

/** Costo unitario de un producto a partir de las líneas de su receta. */
export function costoProducto(
    lineas: readonly LineaCosto[],
    rendimiento?: number | null,
): number {
    return costoUnitario(costoReceta(lineas), rendimiento);
}

/* Autochequeo: `npm run test:units` cubre units.ts; este se corre con
 * `npx tsx -e "import('./src/lib/costos.ts').then(m => m.autochequeoCostos())"`. */
export function autochequeoCostos() {
    const lineas = [
        { cantidad: 2500, precioUnidadBase: 12 },
        { cantidad: 3, precioUnidadBase: 1000 },
        { cantidad: 1, precioUnidadBase: null },
    ];
    if (costoReceta(lineas) !== 33_000) throw new Error("costo de receta");
    if (rendimientoDe(0) !== 1 || rendimientoDe(null) !== 1) throw new Error("rendimiento por defecto");
    if (costoUnitario(33_000, 10) !== 3_300) throw new Error("costo unitario");
    if (costoProducto(lineas, null) !== 33_000) throw new Error("costo de producto");
    if (round4(costoReceta([{ cantidad: 1, precioUnidadBase: 0.00005 }])) !== 0.0001)
        throw new Error("redondeo a 4");
    return "costos OK";
}
