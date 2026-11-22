"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { configuracionNegocio } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export type EstadoConfiguracion = { error?: string; campos?: Record<string, string> };

export async function guardarConfiguracion(
    _estado: EstadoConfiguracion,
    formData: FormData,
): Promise<EstadoConfiguracion> {
    await requireAdmin("/configuracion");

    const campos: Record<string, string> = {};

    const nombreComercial = String(formData.get("nombreComercial") ?? "").trim();
    if (nombreComercial === "") {
        campos.nombreComercial = "El nombre comercial es obligatorio.";
    } else if (nombreComercial.length > 80) {
        campos.nombreComercial = "Máximo 80 caracteres.";
    }

    /** Texto opcional: vacío se guarda como NULL, igual que el servicio Java. */
    const opcional = (clave: string, max: number, etiqueta: string) => {
        const valor = String(formData.get(clave) ?? "").trim();
        if (valor.length > max) campos[clave] = `${etiqueta}: máximo ${max} caracteres.`;
        return valor === "" ? null : valor;
    };

    const identificacionFiscal = opcional("identificacionFiscal", 40, "Identificación");
    const telefono = opcional("telefono", 30, "Teléfono");
    const direccion = opcional("direccion", 150, "Dirección");
    const mensajeRecibo = opcional("mensajeRecibo", 250, "Mensaje");
    const logoUrl = opcional("logoUrl", 250, "Ruta del logo");

    const impuestoCrudo = String(formData.get("impuestoPorcentaje") ?? "").trim().replace(",", ".");
    const impuestoPorcentaje = Number(impuestoCrudo);
    if (impuestoCrudo === "" || !Number.isFinite(impuestoPorcentaje)) {
        campos.impuestoPorcentaje = "El impuesto es obligatorio.";
    } else if (impuestoPorcentaje < 0) {
        campos.impuestoPorcentaje = "El impuesto no puede ser negativo.";
    } else if (impuestoPorcentaje > 100) {
        campos.impuestoPorcentaje = "El impuesto no puede superar 100%.";
    }

    const objetivoCrudo = String(formData.get("objetivoFoodCost") ?? "").trim().replace(",", ".");
    const objetivoFoodCost = objetivoCrudo === "" ? 35 : Number(objetivoCrudo);
    if (!Number.isFinite(objetivoFoodCost) || objetivoFoodCost <= 0 || objetivoFoodCost > 80) {
        campos.objetivoFoodCost = "El objetivo debe estar entre 1 y 80%.";
    }

    const metaCruda = String(formData.get("metaTicket") ?? "").trim().replace(",", ".");
    const metaTicket = metaCruda === "" ? 0 : Number(metaCruda);
    if (!Number.isFinite(metaTicket) || metaTicket < 0) {
        campos.metaTicket = "La meta de ticket no es válida.";
    }

    const comisionCrudo = String(formData.get("comisionAppPct") ?? "").trim().replace(",", ".");
    const comisionAppPct = comisionCrudo === "" ? 0 : Number(comisionCrudo);
    if (!Number.isFinite(comisionAppPct) || comisionAppPct < 0 || comisionAppPct > 60) {
        campos.comisionAppPct = "La comisión debe estar entre 0 y 60%.";
    }

    if (Object.keys(campos).length > 0) {
        return { error: "Revisa los campos marcados.", campos };
    }

    const fila = {
        nombreComercial,
        identificacionFiscal,
        telefono,
        direccion,
        impuestoPorcentaje,
        comisionAppPct,
        objetivoFoodCost,
        metaTicket,
        mensajeRecibo,
        logoUrl,
        actualizadoEn: new Date(),
    };

    try {
        const [actual] = await db
            .select({ id: configuracionNegocio.id })
            .from(configuracionNegocio)
            .orderBy(asc(configuracionNegocio.id))
            .limit(1);

        if (actual) {
            await db
                .update(configuracionNegocio)
                .set(fila)
                .where(eq(configuracionNegocio.id, actual.id));
        } else {
            await db.insert(configuracionNegocio).values(fila);
        }
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : "No se pudo guardar la configuración.",
        };
    }

    revalidatePath("/configuracion");
    revalidatePath("/menu");
    redirect("/configuracion?guardado=1");
}
