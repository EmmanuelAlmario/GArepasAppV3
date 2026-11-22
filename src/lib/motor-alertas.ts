import { foodCost, precioSugerido, concentracion, variacion } from "./analitica";

export type NivelAlerta = "alto" | "medio" | "info";

export type AlertaCalculada = {
    clave: string;
    nivel: NivelAlerta;
    titulo: string;
    detalle: string;
    accion: string;
    href?: string;
    metricas?: Record<string, number | string>;
};

export type ContextoAlertas = {
    /** Umbrales configurables por el dueño. */
    objetivoFoodCost: number;
    metaTicket: number;

    ventasActual: number;
    ventasPrevio: number;
    diasActual: number;
    diasPrevio: number;
    ticketActual: number;
    anuladas: number;

    margenPorProducto: Array<{
        id: number;
        nombre: string;
        precio: number;
        costo: number;
        unidades: number;
    }>;
    canales: Array<{ canal: string; vendido: number; comision: number }>;
    porDiaSemana: number[];
    cartera: { corriente: number; porVencer: number; vencida: number; critica: number };
    saldosClientes: number[];
    stockBajo: number;
    produccionPendiente: number;
};

const pesos = (n: number) => Math.round(n).toLocaleString("es-CO");

/**
 * Reglas del negocio convertidas en alertas. Cada una trae su clave estable
 * para poder actualizarse en vez de duplicarse, y las cifras que la originan.
 */
export function calcularAlertas(ctx: ContextoAlertas): AlertaCalculada[] {
    const salida: AlertaCalculada[] = [];
    const objetivo = ctx.objetivoFoodCost > 0 ? ctx.objetivoFoodCost / 100 : 0.35;

    /* ---------- Margen por producto ---------- */
    /* Un punto de tolerancia para no alertar por redondeos. */
    const conProblema = ctx.margenPorProducto
        .filter(
            (p) =>
                p.unidades > 0 &&
                foodCost(p.costo, p.precio) > ctx.objetivoFoodCost + 1,
        )
        .sort((a, b) => foodCost(b.costo, b.precio) - foodCost(a.costo, a.precio));

    for (const p of conProblema.slice(0, 3)) {
        const fc = foodCost(p.costo, p.precio);
        const sugerido = precioSugerido(p.costo, objetivo);
        const salto = (sugerido - p.precio) / Math.max(1, p.precio);
        salida.push({
            clave: `food-cost:${p.id}`,
            nivel: fc > ctx.objetivoFoodCost + 10 ? "alto" : "medio",
            titulo: `${p.nombre}: food cost ${fc.toFixed(0)}%`,
            detalle: `Cuesta $${pesos(p.costo)} y se vende a $${pesos(p.precio)}. El objetivo es ${ctx.objetivoFoodCost}%. Con ${p.unidades} unidades del periodo deja $${pesos((p.precio - p.costo) * p.unidades)} de margen bruto.`,
            accion:
                salto > 0.25
                    ? `Revisar porción: para ${ctx.objetivoFoodCost}% habría que cobrar $${pesos(sugerido)}`
                    : `Aplicar precio de $${pesos(sugerido)}`,
            href: "/productos",
            metricas: {
                productoId: p.id,
                precioActual: p.precio,
                precioSugerido: sugerido,
                foodCost: Math.round(fc),
                unidades: p.unidades,
                aplicable: salto <= 0.25 ? 1 : 0,
            },
        });
    }

    /* ---------- Canal con comisión ---------- */
    const app = ctx.canales.find((c) => c.canal === "APP");
    if (app && app.vendido > 0) {
        const pct = (app.comision / app.vendido) * 100;
        salida.push({
            clave: "canal:app",
            nivel: pct > 20 ? "medio" : "info",
            titulo: `La app se lleva ${pct.toFixed(0)}% del canal`,
            detalle: `De $${pesos(app.vendido)} vendidos por app, la comisión es $${pesos(app.comision)}. Neto antes de empaque y domicilio: $${pesos(app.vendido - app.comision)}.`,
            accion: "Subir el precio de ese canal o mover pedidos a WhatsApp",
            href: "/analisis",
            metricas: { comisionPct: Math.round(pct), vendido: Math.round(app.vendido) },
        });
    }

    /* ---------- Tendencia ---------- */
    const vs = variacion(ctx.ventasActual / ctx.diasActual, ctx.ventasPrevio / ctx.diasPrevio);
    if (vs !== null && Math.abs(vs) >= 8) {
        salida.push({
            clave: "tendencia",
            nivel: vs < -8 ? "alto" : "info",
            titulo: vs < 0 ? "Las ventas diarias cayeron" : "Las ventas diarias subieron",
            detalle: `Promedio diario $${pesos(ctx.ventasActual / ctx.diasActual)} contra $${pesos(ctx.ventasPrevio / ctx.diasPrevio)} del periodo anterior (${vs > 0 ? "+" : ""}${vs.toFixed(0)}%).`,
            accion: vs < 0 ? "Revisar horarios flojos y reactivar clientes" : "Sostener y cuidar el stock",
            href: "/ventas",
            metricas: { variacion: Math.round(vs) },
        });
    }

    /* ---------- Día flojo ---------- */
    const promedios = ctx.porDiaSemana;
    const totalSemana = promedios.reduce((a, b) => a + b, 0);
    if (totalSemana > 0) {
        const peor = promedios.indexOf(Math.min(...promedios));
        const mejor = promedios.indexOf(Math.max(...promedios));
        const brecha = ((promedios[mejor] - promedios[peor]) / promedios[mejor]) * 100;
        const nombres = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
        if (brecha > 25) {
            salida.push({
                clave: "dia-flojo",
                nivel: "medio",
                titulo: `${nombres[peor].charAt(0).toUpperCase() + nombres[peor].slice(1)} vende ${brecha.toFixed(0)}% menos`,
                detalle: `$${pesos(promedios[peor])} al día contra $${pesos(promedios[mejor])} del ${nombres[mejor]}. Concentra la producción donde ya hay demanda y prueba un combo ese día.`,
                accion: `Promoción de ${nombres[peor]}`,
                href: "/analisis",
                metricas: { brecha: Math.round(brecha), peorDia: nombres[peor] },
            });
        }
    }

    /* ---------- Cartera ---------- */
    const totalCartera =
        ctx.cartera.corriente + ctx.cartera.porVencer + ctx.cartera.vencida + ctx.cartera.critica;
    if (ctx.cartera.vencida > 0) {
        salida.push({
            clave: "cartera:vencida",
            nivel: "medio",
            titulo: `$${pesos(ctx.cartera.vencida)} de cartera vencida`,
            detalle: `De $${pesos(totalCartera)} por cobrar, $${pesos(ctx.cartera.vencida)} ya pasó la fecha y $${pesos(ctx.cartera.critica)} tiene más de 30 días.`,
            accion: "Cobrar esta semana",
            href: "/clientes",
            metricas: { vencida: Math.round(ctx.cartera.vencida) },
        });
    }
    if (ctx.cartera.critica > 0) {
        salida.push({
            clave: "cartera:critica",
            nivel: "alto",
            titulo: `$${pesos(ctx.cartera.critica)} con más de 30 días`,
            detalle: `Los 3 mayores deudores concentran ${concentracion(ctx.saldosClientes).toFixed(0)}% del saldo. La deuda vieja se cobra peor cada semana.`,
            accion: "Llamar a los 3 mayores deudores",
            href: "/clientes",
            metricas: { critica: Math.round(ctx.cartera.critica) },
        });
    }

    /* ---------- Ticket ---------- */
    if (ctx.metaTicket > 0 && ctx.ticketActual > 0 && ctx.ticketActual < ctx.metaTicket) {
        const brecha = ((ctx.metaTicket - ctx.ticketActual) / ctx.metaTicket) * 100;
        salida.push({
            clave: "ticket",
            nivel: brecha > 25 ? "medio" : "info",
            titulo: `Ticket $${pesos(ctx.ticketActual)} contra meta de $${pesos(ctx.metaTicket)}`,
            detalle: `Falta ${brecha.toFixed(0)}% para la meta. Un extra o una bebida en la mitad de los pedidos cierra la brecha sin tocar el precio de la arepa.`,
            accion: "Ofrecer combo y extras en el POS",
            href: "/pos",
            metricas: { ticket: Math.round(ctx.ticketActual), meta: ctx.metaTicket },
        });
    }

    /* ---------- Operación ---------- */
    if (ctx.stockBajo > 0) {
        salida.push({
            clave: "stock:bajo",
            nivel: ctx.stockBajo > 3 ? "alto" : "medio",
            titulo: `${ctx.stockBajo} insumos bajo el mínimo`,
            detalle: "La próxima producción puede quedar pendiente por falta de materia prima.",
            accion: "Revisar la lista de compra",
            href: "/insumos?filtro=bajo",
            metricas: { insumos: ctx.stockBajo },
        });
    }
    if (ctx.produccionPendiente > 0) {
        salida.push({
            clave: "produccion:pendiente",
            nivel: "medio",
            titulo: `${ctx.produccionPendiente} producciones pendientes`,
            detalle: "No descontaron insumos porque faltaba stock. Al reponer se re-verifican y se completan.",
            accion: "Reponer insumos y re-verificar",
            href: "/producciones?estado=PENDIENTE",
            metricas: { producciones: ctx.produccionPendiente },
        });
    }
    if (ctx.anuladas > 0) {
        const tasa = (ctx.anuladas / Math.max(1, ctx.ventasActual + ctx.anuladas)) * 100;
        if (tasa > 2) {
            salida.push({
                clave: "anuladas",
                nivel: "medio",
                titulo: `Anulaciones en ${tasa.toFixed(1)}%`,
                detalle: `${ctx.anuladas} ventas anuladas en el periodo. Suele ser error de captura o cobro antes de confirmar.`,
                accion: "Revisar el flujo de cobro",
                href: "/ventas",
                metricas: { tasa: Math.round(tasa), anuladas: ctx.anuladas },
            });
        }
    }

    if (salida.length === 0) {
        salida.push({
            clave: "sin-alertas",
            nivel: "info",
            titulo: "Sin alertas en el periodo",
            detalle: "Márgenes, cartera, ticket y stock están dentro de los umbrales configurados.",
            accion: "Seguir registrando todo para afinar el análisis",
        });
    }

    return salida;
}

/* Autochequeo: `npx tsx src/lib/motor-alertas.test.ts` */
export function autochequeoAlertas() {
    const base: ContextoAlertas = {
        objetivoFoodCost: 35,
        metaTicket: 25000,
        ventasActual: 3000000,
        ventasPrevio: 3000000,
        diasActual: 30,
        diasPrevio: 30,
        ticketActual: 30000,
        anuladas: 0,
        margenPorProducto: [],
        canales: [],
        porDiaSemana: [10, 10, 10, 10, 10, 10, 10],
        cartera: { corriente: 0, porVencer: 0, vencida: 0, critica: 0 },
        saldosClientes: [],
        stockBajo: 0,
        produccionPendiente: 0,
    };

    const sinNada = calcularAlertas(base);
    if (sinNada.length !== 1 || sinNada[0].clave !== "sin-alertas") throw new Error("sin alertas");

    const conProducto = calcularAlertas({
        ...base,
        margenPorProducto: [{ id: 1, nombre: "Prueba", precio: 10000, costo: 6000, unidades: 10 }],
        stockBajo: 2,
    });
    if (!conProducto.some((a) => a.clave === "food-cost:1")) throw new Error("food cost");
    if (!conProducto.some((a) => a.clave === "stock:bajo" && a.nivel === "medio"))
        throw new Error("stock bajo");
    return "alertas OK";
}
