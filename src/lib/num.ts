/** Redondeos de dinero y cantidades (espejo de BigDecimal.setScale del backend). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10_000) / 10_000;

/** Convierte texto de formulario a número, o lanza con mensaje legible. */
export function toNumber(value: FormDataEntryValue | null, campo: string): number {
    const n = typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
    if (!Number.isFinite(n)) throw new Error(`${campo}: valor numérico inválido`);
    return n;
}
