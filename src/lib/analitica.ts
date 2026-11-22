/**
 * Cálculos de analítica del negocio. Puro: sin base de datos ni React,
 * para poder probarlo y reutilizarlo desde servidor o scripts.
 */

export type Punto = { etiqueta: string; valor: number };
export const suma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);

export const promedio = (valores: number[]) =>
    valores.length === 0 ? 0 : suma(valores) / valores.length;

/** Variación relativa en %; null si no hay base de comparación. */
export function variacion(actual: number, previo: number): number | null {
    if (previo === 0) return null;
    return ((actual - previo) / previo) * 100;
}

/** Media móvil simple: los primeros puntos usan las observaciones disponibles. */
export function mediaMovil(valores: number[], ventana = 7): number[] {
    return valores.map((_, indice) => {
        const desde = Math.max(0, indice - ventana + 1);
        return promedio(valores.slice(desde, indice + 1));
    });
}

export const foodCost = (costo: number, precio: number) =>
    precio <= 0 ? 0 : (costo / precio) * 100;

/** Precio para alcanzar un food cost objetivo, redondeado a los $500. */
export function precioSugerido(costo: number, objetivo = 0.32): number {
    const crudo = costo / objetivo;
    return Math.ceil(crudo / 500) * 500;
}

/** Deja los días sin ventas en cero para que la serie no tenga huecos. */
export function completarSerie(
    filas: Array<{ dia: string; total: number }>,
    desde: Date,
    hasta: Date,
): Punto[] {
    const porDia = new Map(filas.map((f) => [f.dia, Number(f.total)]));
    const puntos: Punto[] = [];
    const cursor = new Date(`${desde.toISOString().slice(0, 10)}T12:00:00Z`);
    const fin = new Date(`${hasta.toISOString().slice(0, 10)}T12:00:00Z`);
    while (cursor <= fin) {
        const clave = cursor.toISOString().slice(0, 10);
        puntos.push({ etiqueta: clave, valor: porDia.get(clave) ?? 0 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return puntos;
}

/** Edad de la deuda en tramos para la cartera. */
export function tramosCartera(
    filas: Array<{ saldo: number; vence: Date | null }>,
    hoy = new Date(),
) {
    const tramos = { corriente: 0, porVencer: 0, vencida: 0, critica: 0 };
    for (const f of filas) {
        /* Sin fecha de vencimiento no se considera vencida. */
        if (!f.vence) {
            tramos.corriente += f.saldo;
            continue;
        }
        const dias = Math.floor((hoy.getTime() - f.vence.getTime()) / 86_400_000);
        if (dias > 30) tramos.critica += f.saldo;
        else if (dias > 0) tramos.vencida += f.saldo;
        else if (dias > -8) tramos.porVencer += f.saldo;
        else tramos.corriente += f.saldo;
    }
    return tramos;
}

/** Concentración: qué porcentaje del saldo aportan los N mayores deudores. */
export function concentracion(saldos: number[], top = 3): number {
    const total = suma(saldos);
    if (total === 0) return 0;
    const mayores = [...saldos].sort((a, b) => b - a).slice(0, top);
    return (suma(mayores) / total) * 100;
}

/* Autochequeo: `npx tsx src/lib/analitica.test.ts` */
export function autochequeo() {
    if (variacion(120, 100) !== 20) throw new Error("variación");
    if (variacion(50, 0) !== null) throw new Error("sin base");
    const mm = mediaMovil([10, 20, 30, 40], 2);
    if (mm[1] !== 15 || mm[3] !== 35) throw new Error("media móvil");
    if (precioSugerido(10000, 0.4) !== 25000) throw new Error("precio sugerido");
    if (Math.round(foodCost(3200, 10000)) !== 32) throw new Error("food cost");
    if (concentracion([100, 50, 30, 20], 2) !== 75) throw new Error("concentración");
    const tramos = tramosCartera(
        [
            { saldo: 100, vence: new Date("2026-01-01") },
            { saldo: 50, vence: null },
        ],
        new Date("2026-03-01"),
    );
    if (tramos.critica !== 100 || tramos.corriente !== 50) throw new Error("tramos");
    return "analítica OK";
}
