"use server";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { jornadas, ventas } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import { round2 } from "@/lib/num";

export type EstadoJornada = { error?: string; ok?: string };

function revalidarJornada() {
    revalidatePath("/");
    revalidatePath("/pos");
    revalidatePath("/ventas");
    revalidatePath("/reportes");
}

const numero = (formData: FormData, clave: string, defecto = 0) => {
    const crudo = String(formData.get(clave) ?? "").trim().replace(",", ".");
    if (crudo === "") return defecto;
    const valor = Number(crudo);
    return Number.isFinite(valor) ? round2(valor) : defecto;
};

/** Efectivo que debería haber en la caja: fondo + ventas en efectivo − retiros. */
async function efectivoEsperado(jornadaId: number, fondo: number, retiros: number) {
    const [fila] = await db
        .select({ total: sql<number>`coalesce(sum(${ventas.total}), 0)::float8` })
        .from(ventas)
        .where(
            and(
                eq(ventas.jornadaId, jornadaId),
                eq(ventas.estado, "ACTIVA"),
                eq(ventas.formaPago, "EFECTIVO"),
            ),
        );

    return round2(fondo + Number(fila.total) - retiros);
}

export async function abrirJornada(
    _estado: EstadoJornada,
    formData: FormData,
): Promise<EstadoJornada> {
    const sesion = await requireSesion("/pos");
    const fondo = numero(formData, "fondoInicial");
    if (fondo < 0) return { error: "El fondo inicial no puede ser negativo." };

    const abierta = await db.transaction(async (tx) => {
        /* ponytail: check + insert no es atómico entre dos cajas; el esquema no
         * tiene índice único parcial. Si el doble día aparece, crear
         * unique index on jornadas(activa) where activa. */
        const [activa] = await tx
            .select({ id: jornadas.id })
            .from(jornadas)
            .where(eq(jornadas.activa, true))
            .limit(1);
        if (activa) return false;

        await tx.insert(jornadas).values({
            fechaApertura: new Date(),
            activa: true,
            abiertaPor: (sesion.username || "usuario").slice(0, 60),
            fondoInicial: fondo,
        });
        return true;
    });

    if (!abierta) return { error: "Ya hay una jornada abierta." };

    revalidarJornada();
    return { ok: "Día abierto." };
}

export async function cerrarJornada(
    _estado: EstadoJornada,
    formData: FormData,
): Promise<EstadoJornada> {
    const sesion = await requireSesion("/pos");
    const contado = numero(formData, "efectivoContado", -1);
    const retiros = numero(formData, "retiros");
    const notas = String(formData.get("notas") ?? "").trim().slice(0, 250);

    if (contado < 0) return { error: "Escribe cuánto efectivo contaste en la caja." };
    if (retiros < 0) return { error: "Los retiros no pueden ser negativos." };

    const [activa] = await db
        .select()
        .from(jornadas)
        .where(eq(jornadas.activa, true))
        .orderBy(desc(jornadas.fechaApertura))
        .limit(1);

    if (!activa) return { error: "No hay una jornada abierta." };

    const esperado = await efectivoEsperado(
        activa.id,
        Number(activa.fondoInicial),
        retiros,
    );
    const diferencia = round2(contado - esperado);

    await db
        .update(jornadas)
        .set({
            fechaCierre: new Date(),
            activa: false,
            efectivoContado: contado,
            retiros,
            diferencia,
            notas: notas === "" ? null : notas,
            cerradaPor: (sesion.username || "usuario").slice(0, 60),
        })
        .where(eq(jornadas.id, activa.id));

    revalidarJornada();

    const signo = diferencia === 0 ? "cuadra" : diferencia > 0 ? "sobra" : "falta";
    return {
        ok:
            diferencia === 0
                ? "Jornada cerrada. La caja cuadra."
                : `Jornada cerrada. ${signo === "sobra" ? "Sobran" : "Faltan"} $${Math.abs(diferencia).toLocaleString("es-CO")}.`,
    };
}

/** Últimos cierres con su diferencia, para el panel y los reportes. */
export async function ultimosCierres(limite = 5) {
    await requireSesion("/pos");
    return db
        .select({
            id: jornadas.id,
            fechaCierre: jornadas.fechaCierre,
            cerradaPor: jornadas.cerradaPor,
            fondoInicial: jornadas.fondoInicial,
            retiros: jornadas.retiros,
            efectivoContado: jornadas.efectivoContado,
            diferencia: jornadas.diferencia,
            notas: jornadas.notas,
        })
        .from(jornadas)
        .where(eq(jornadas.activa, false))
        .orderBy(desc(jornadas.fechaCierre))
        .limit(limite);
}

/** Cierres dentro de un rango (para /reportes). */
export async function cierresEnRango(desde: Date, hasta: Date) {
    await requireSesion("/reportes");
    return db
        .select({
            id: jornadas.id,
            fechaCierre: jornadas.fechaCierre,
            cerradaPor: jornadas.cerradaPor,
            diferencia: jornadas.diferencia,
            efectivoContado: jornadas.efectivoContado,
            notas: jornadas.notas,
        })
        .from(jornadas)
        .where(and(eq(jornadas.activa, false), gte(jornadas.fechaCierre, desde), lte(jornadas.fechaCierre, hasta)))
        .orderBy(desc(jornadas.fechaCierre))
        .limit(50);
}
