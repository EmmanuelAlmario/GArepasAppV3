/**
 * Unidades de medida — espejo de domain/enums/UnidadMedida.java.
 *
 * Único lugar donde se sabe cuánto es un kilo en gramos. Todo lo que se
 * guarda en la base está en unidad base (g, ml, unidad).
 */
export const UNIDADES = ["GRAMO", "KILOGRAMO", "MILILITRO", "LITRO", "UNIDAD"] as const;
export type Unidad = (typeof UNIDADES)[number];

const ETIQUETAS: Record<Unidad, string> = {
    KILOGRAMO: "kg",
    GRAMO: "g",
    LITRO: "L",
    MILILITRO: "ml",
    UNIDAD: "unidad",
};

const FACTORES: Record<Unidad, number> = {
    KILOGRAMO: 1000,
    GRAMO: 1,
    LITRO: 1000,
    MILILITRO: 1,
    UNIDAD: 1,
};

const MAGNITUD: Record<Unidad, "masa" | "volumen" | "unidad"> = {
    KILOGRAMO: "masa",
    GRAMO: "masa",
    LITRO: "volumen",
    MILILITRO: "volumen",
    UNIDAD: "unidad",
};

export const etiqueta = (u: Unidad) => ETIQUETAS[u];
export const factor = (u: Unidad) => FACTORES[u];
export const magnitud = (u: Unidad) => MAGNITUD[u];

export const aBase = (cantidad: number, u: Unidad) => cantidad * FACTORES[u];
export const desdeBase = (cantidadBase: number, u: Unidad) => cantidadBase / FACTORES[u];

/** Precio de una presentación (1 kg) a precio por unidad base (1 g). */
export const precioABase = (precioPorPresentacion: number, u: Unidad) =>
    precioPorPresentacion / FACTORES[u];

/** Precio por unidad base a precio de la presentación completa. */
export const precioDesdeBase = (precioUnidadBase: number, u: Unidad) =>
    precioUnidadBase * FACTORES[u];

export function compatible(a: Unidad, b: Unidad): boolean {
    return MAGNITUD[a] === MAGNITUD[b];
}

/** Costo de una línea de receta: cantidad (en unidad base) × precio base. */
export const costoLinea = (cantidadBase: number, precioUnidadBase: number) =>
    cantidadBase * precioUnidadBase;

/* Autochequeo: `npx tsx src/lib/units.test.ts` */
export function autochequeo() {
    if (aBase(1, "KILOGRAMO") !== 1000) throw new Error("kg→g");
    if (precioDesdeBase(1, "KILOGRAMO") !== 1000) throw new Error("precio 1g→1kg");
    if (Math.abs(precioABase(12000, "KILOGRAMO") - 12) > 1e-9) throw new Error("precio kg→g");
    if (compatible("GRAMO", "LITRO")) throw new Error("masa/volumen");
    if (!compatible("UNIDAD", "UNIDAD")) throw new Error("unidad/unidad");
    if (Math.abs(desdeBase(2500, "KILOGRAMO") - 2.5) > 1e-9) throw new Error("g→kg");
    return "unidades OK";
}
