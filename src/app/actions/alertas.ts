"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { productos } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { round2 } from "@/lib/num";
import { descartarAlerta, recalcularAlertas } from "@/lib/alertas-server";

export async function recalcularAhora() {
    await requireAdmin("/analisis");
    await recalcularAlertas();
    revalidatePath("/");
    revalidatePath("/analisis");
}

export async function descartar(formData: FormData) {
    await requireAdmin("/analisis");
    await descartarAlerta(Number(formData.get("id")));
    revalidatePath("/");
    revalidatePath("/analisis");
}

/** Aplica el precio que propuso el motor (decisión tomada en un clic). */
export async function aplicarPrecioSugerido(formData: FormData) {
    await requireAdmin("/analisis");
    const id = Number(formData.get("productoId"));
    const precio = Number(String(formData.get("precio") ?? "").replace(",", "."));
    if (!Number.isInteger(id) || !Number.isFinite(precio) || precio <= 0) return;

    await db
        .update(productos)
        .set({ precioVenta: round2(precio) })
        .where(eq(productos.id, id));

    await recalcularAlertas();
    revalidatePath("/");
    revalidatePath("/analisis");
    revalidatePath("/productos");
    revalidatePath("/pos");
    revalidatePath("/menu");
}
