import { z } from "zod";

const texto = (min: number, max: number, etiqueta: string) =>
    z
        .string()
        .trim()
        .min(min, `${etiqueta}: mínimo ${min} caracteres`)
        .max(max, `${etiqueta}: máximo ${max} caracteres`);

const numero = (etiqueta: string, minimo = 0) =>
    z.coerce
        .number({ error: `${etiqueta}: debe ser un número` })
        .min(minimo, `${etiqueta}: no puede ser negativo`);

export const esquemaProducto = z.object({
    nombre: texto(3, 50, "Nombre"),
    precioVenta: numero("Precio").max(99_999_999, "Precio demasiado alto"),
    stockActual: numero("Stock").int("Stock: debe ser entero"),
    stockMinimo: numero("Stock mínimo").int("Stock mínimo: debe ser entero").optional(),
    recetaId: z.coerce.number().int().positive().optional(),
    activo: z.coerce.boolean().default(true),
    bajoPedido: z.coerce.boolean().default(false),
    controlarStock: z.coerce.boolean().default(true),
});

export type DatosProducto = z.infer<typeof esquemaProducto>;

/** FormData → objeto plano, con checkboxes ausentes como false. */
export function plano(formData: FormData) {
    const opcional = (clave: string) => {
        const v = String(formData.get(clave) ?? "").trim();
        return v === "" ? undefined : v;
    };
    return {
        nombre: String(formData.get("nombre") ?? ""),
        precioVenta: String(formData.get("precioVenta") ?? ""),
        stockActual: String(formData.get("stockActual") ?? "0"),
        stockMinimo: opcional("stockMinimo"),
        recetaId: opcional("recetaId"),
        activo: formData.get("activo") !== null,
        bajoPedido: formData.get("bajoPedido") !== null,
        controlarStock: formData.get("controlarStock") !== null,
    };
}
