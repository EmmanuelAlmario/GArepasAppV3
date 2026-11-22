/** Gastos — categorías, validación del formulario y filtro por mes. */
import { z } from "zod";
import { CATEGORIAS_GASTO } from "@/db/schema";

export { CATEGORIAS_GASTO };
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

/** Etiquetas de domain/enums/CategoriaGasto.java. */
export const ETIQUETAS_CATEGORIA: Record<CategoriaGasto, string> = {
    MATERIA_PRIMA: "Materia prima",
    SERVICIOS: "Servicios",
    TRANSPORTE: "Transporte",
    EQUIPAMIENTO: "Equipamiento",
    MANTENIMIENTO: "Mantenimiento",
    OTROS: "Otros",
};

export const esquemaGasto = z.object({
    descripcion: z
        .string()
        .trim()
        .min(1, "La descripción es obligatoria")
        .max(150, "La descripción no puede superar los 150 caracteres"),
    monto: z.coerce
        .number({ error: "El monto debe ser un número" })
        .positive("El monto debe ser mayor que cero")
        .int("El monto debe ser un valor en pesos, sin decimales")
        .max(99_999_999_999, "Monto demasiado alto"),
    categoria: z.enum(CATEGORIAS_GASTO, { error: "Selecciona una categoría" }),
});

export type DatosGasto = z.infer<typeof esquemaGasto>;

export function planoGasto(formData: FormData) {
    return {
        descripcion: String(formData.get("descripcion") ?? ""),
        monto: String(formData.get("monto") ?? ""),
        categoria: String(formData.get("categoria") ?? ""),
    };
}

/**
 * Mes `YYYY-MM` → rango [desde, hasta) en UTC. Bogotá es UTC-5 todo el año:
 * las 00:00 locales del día 1 son las 05:00 UTC.
 */
export function rangoMes(mes: string | undefined): { desde: Date; hasta: Date } | null {
    if (!mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return null;
    const [anio, numero] = mes.split("-").map(Number);
    return {
        desde: new Date(Date.UTC(anio, numero - 1, 1, 5)),
        hasta: new Date(Date.UTC(anio, numero, 1, 5)),
    };
}

export function autochequeo() {
    const r = rangoMes("2026-02");
    if (!r) throw new Error("mes válido rechazado");
    if (r.desde.toISOString() !== "2026-02-01T05:00:00.000Z") throw new Error("inicio de mes");
    if (r.hasta.toISOString() !== "2026-03-01T05:00:00.000Z") throw new Error("fin de mes");
    if (rangoMes("2026-13") || rangoMes("febrero")) throw new Error("mes inválido aceptado");
    if (esquemaGasto.safeParse({ descripcion: "", monto: "0", categoria: "OTROS" }).success)
        throw new Error("gasto vacío aceptado");
    return "gastos OK";
}
