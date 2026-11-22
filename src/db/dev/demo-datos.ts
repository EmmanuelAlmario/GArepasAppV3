/**
 * Datos de demostración para revisar la app con volumen real:
 * 30 días de operación, ~1.000 ventas, producciones, gastos, ajustes,
 * abonos y cartera. NO toca el catálogo real (insumos, recetas, productos)
 * ni usuarios, configuración o extras.
 *
 * DESTRUCTIVO sobre movimientos: borra ventas, producciones, gastos,
 * jornadas, clientes y ajustes antes de regenerarlos.
 *
 * npx tsx --env-file=.env.local src/db/demo-datos.ts
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../index";
import {
    abonos,
    ajustesInventario,
    clientes,
    detalleProducciones,
    detalleRecetas,
    detalleVentaExtras,
    detalleVentas,
    extras,
    gastos,
    insumos,
    jornadas,
    producciones,
    productos,
    recetas,
    ventas,
} from "../schema";
import { round2, round4 } from "../../lib/num";

if (process.env.NODE_ENV === "production") {
    console.error("Script de desarrollo: en producción usa `node scripts/migrar.mjs` y `node scripts/admin.mjs`.");
    process.exit(1);
}


const DIAS = 30;
const HOY = new Date();
const BOGOTA_OFFSET = 5 * 60 * 60 * 1000;

/* Generador determinista: la demo se puede repetir y comparar. */
let semilla = 20261121;
function azar() {
    semilla = (semilla * 1103515245 + 12345) % 2 ** 31;
    return semilla / 2 ** 31;
}
const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
const elegir = <T,>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)];

/* Fecha local de Bogotá → instante UTC. */
function fechaBogota(diasAtras: number, hora: number, minuto: number) {
    const base = new Date(HOY.getTime() - diasAtras * 24 * 60 * 60 * 1000);
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    const d = base.getUTCDate();
    return new Date(Date.UTC(y, m, d, hora, minuto) + BOGOTA_OFFSET);
}

const CLAVE_DIA = (fecha: Date) => fecha.toISOString().slice(0, 10);

const NOMBRES = [
    "María Fernanda Ospina", "Jorge Luis Barrios", "Carolina Pájaro", "Andrés Mercado",
    "Luisa Fernanda Torres", "Rafael Escobar", "Yeison Padilla", "Daniela Cardona",
    "Óscar Romero", "Milena Vargas", "Jhon Jairo Baldiris", "Sofía Arrieta",
    "Eduardo Narváez", "Paola Buelvas", "Cristian Salgado", "Natalia Therán",
];
const BARRIOS = ["Getsemaní", "Manga", "Bocagrande", "Centro", "Crespo", "El Bosque", "Torices"];

const NOTAS = ["Sin queso", "Extra queso", "Bien asada", "Sin salsa", "Para llevar"];
const CATEGORIAS_GASTO = ["MATERIA_PRIMA", "SERVICIOS", "TRANSPORTE", "EQUIPAMIENTO", "MANTENIMIENTO", "OTROS"] as const;
const GASTOS_TEXTO: Record<(typeof CATEGORIAS_GASTO)[number], string[]> = {
    MATERIA_PRIMA: ["Queso costeño", "Carne", "Pollo", "Papa ripio", "Chorizo"],
    SERVICIOS: ["Luz", "Agua", "Internet", "Gas", "Plan de datos"],
    TRANSPORTE: ["Domicilios del día", "Gasolina moto", "Mototaxi insumos"],
    EQUIPAMIENTO: ["Gramera", "Sellador de bolsas", "Nevera portátil"],
    MANTENIMIENTO: ["Reparación de plancha", "Limpieza de extractor"],
    OTROS: ["Publicidad Instagram", "Empaques", "Varios"],
};

const CANALES = ["MOSTRADOR", "MOSTRADOR", "MOSTRADOR", "WHATSAPP", "WHATSAPP", "APP", "EVENTO"] as const;
const PAGOS = ["EFECTIVO", "EFECTIVO", "EFECTIVO", "EFECTIVO", "TARJETA", "TARJETA", "TRANSFERENCIA", "CREDITO"] as const;

async function main() {
    const catalogo = await db.select().from(productos).where(eq(productos.activo, true));
    if (catalogo.length === 0) throw new Error("No hay productos: carga primero la carta.");

    const listaExtras = await db.select().from(extras).where(eq(extras.activo, true));

    const recetasPorId = new Map<number, { insumoId: number; cantidad: number; precio: number; nombre: string }[]>();
    const filasReceta = await db
        .select({
            recetaId: detalleRecetas.recetaId,
            insumoId: detalleRecetas.insumoId,
            cantidad: detalleRecetas.cantidad,
            precio: insumos.precioUnidadBase,
            nombre: insumos.nombre,
        })
        .from(detalleRecetas)
        .innerJoin(insumos, eq(detalleRecetas.insumoId, insumos.id));
    for (const f of filasReceta) {
        const lista = recetasPorId.get(f.recetaId) ?? [];
        lista.push({ insumoId: f.insumoId, cantidad: Number(f.cantidad), precio: Number(f.precio), nombre: f.nombre });
        recetasPorId.set(f.recetaId, lista);
    }

    await db.transaction(async (tx) => {
        console.log("Limpiando movimientos anteriores…");
        await tx.delete(detalleVentaExtras);
        await tx.delete(abonos);
        await tx.delete(detalleProducciones);
        await tx.delete(gastos);
        await tx.delete(producciones);
        await tx.delete(detalleVentas);
        await tx.delete(ventas);
        await tx.delete(ajustesInventario);
        await tx.delete(jornadas);
        await tx.delete(clientes);

        /* ---------- Stock con pinta de operación real ---------- */
        const listaInsumos = await tx.select().from(insumos);
        for (const i of listaInsumos) {
            const esUnidad = i.unidadPresentacion === "UNIDAD";
            const minimo = esUnidad ? entre(10, 40) : entre(800, 4000);
            await tx
                .update(insumos)
                .set({
                    stockMinimo: minimo,
                    stockActual: round4(minimo * (1.2 + azar() * 2.5)),
                })
                .where(eq(insumos.id, i.id));
        }
        for (const p of catalogo) {
            await tx
                .update(productos)
                .set({ stockActual: entre(20, 90), stockMinimo: entre(8, 15) })
                .where(eq(productos.id, p.id));
        }

        /* ---------- Clientes ---------- */
        console.log("Clientes…");
        const clientesCreados = await tx
            .insert(clientes)
            .values(
                NOMBRES.map((nombre, indice) => ({
                    nombre,
                    telefono: `300 ${entre(100, 999)} ${entre(1000, 9999)}`,
                    direccion: `${elegir(BARRIOS)}`,
                    notas: indice % 4 === 0 ? "Pide sin salsa" : null,
                    activo: indice % 7 !== 0,
                    creadoEn: fechaBogota(entre(DIAS, 200), 10, 0),
                })),
            )
            .returning({ id: clientes.id, nombre: clientes.nombre });

        /* ---------- Jornadas ---------- */
        console.log("Jornadas y arqueos…");
        const jornadasCreadas: { id: number; dia: string }[] = [];
        for (let i = DIAS - 1; i >= 0; i--) {
            const apertura = fechaBogota(i, 9, entre(0, 40));
            const abierta = i === 0;
            const [j] = await tx
                .insert(jornadas)
                .values({
                    fechaApertura: apertura,
                    fechaCierre: abierta ? null : fechaBogota(i, 21, entre(0, 50)),
                    activa: abierta,
                    abiertaPor: azar() > 0.5 ? "admin" : "cajero",
                    fondoInicial: 50000,
                    retiros: abierta ? 0 : azar() > 0.6 ? 100000 : 0,
                    efectivoContado: abierta ? null : null,
                    notas: abierta ? null : "Cierre del día",
                    cerradaPor: abierta ? null : "admin",
                })
                .returning({ id: jornadas.id });
            jornadasCreadas.push({ id: j.id, dia: CLAVE_DIA(apertura) });
        }
        const jornadaPorDia = new Map(jornadasCreadas.map((j) => [j.dia.substring(0, 10), j.id]));

        /* ---------- Ventas ---------- */
        console.log("1.000 ventas con detalle, extras y abonos…");
        const totalVentas = 1000;
        const ventasPorDia = new Map<string, number>();
        const creadas: {
            id: number;
            dia: string;
            total: number;
            saldo: number;
            formaPago: string;
            credito: boolean;
        }[] = [];

        for (let i = 0; i < totalVentas; i += 200) {
            const lote = Math.min(200, totalVentas - i);
            const filas = Array.from({ length: lote }, () => {
                const dias = entre(0, DIAS - 1);
                const fecha = fechaBogota(dias, entre(11, 20), entre(0, 59));
                const dia = CLAVE_DIA(fecha);
                ventasPorDia.set(dia, (ventasPorDia.get(dia) ?? 0) + 1);

                const formaPago = elegir(PAGOS);
                const canal = elegir(CANALES);
                const lineas = entre(1, 3);
                const productosElegidos = Array.from({ length: lineas }, () => elegir(catalogo));

                let subtotal = 0;
                for (const p of productosElegidos) {
                    const cantidad = entre(1, 3);
                    subtotal = round2(subtotal + Number(p.precioVenta) * cantidad);
                    const extrasLinea = azar() > 0.7 ? listaExtras.slice(0, entre(1, listaExtras.length)) : [];
                    for (const e of extrasLinea) subtotal = round2(subtotal + Number(e.precio));
                }

                const anulada = azar() < 0.015;
                const credito = formaPago === "CREDITO" && !anulada;
                const conCliente = credito || azar() > 0.75;
                const cliente = conCliente ? elegir(clientesCreados) : null;
                const recibido = formaPago === "EFECTIVO" ? Math.ceil(subtotal / 1000) * 1000 : null;

                return {
                    fecha,
                    dia,
                    subtotal,
                    total: subtotal,
                    saldo: anulada ? 0 : credito ? subtotal : 0,
                    formaPago,
                    canal,
                    credito,
                    anulada,
                    clienteId: cliente?.id ?? null,
                    nombreCliente: cliente?.nombre ?? (azar() > 0.6 ? elegir(NOMBRES).split(" ")[0] : null),
                    efectivoRecibido: recibido,
                    cambio: recibido !== null ? round2(recibido - subtotal) : null,
                };
            });

            const insertadas = await tx
                .insert(ventas)
                .values(
                    filas.map((f) => ({
                        fecha: f.fecha,
                        subtotal: f.subtotal,
                        impuestos: 0,
                        total: f.total,
                        saldo: f.anulada ? 0 : f.credito ? f.total : 0,
                        formaPago: f.formaPago as (typeof PAGOS)[number],
                        estado: f.anulada ? ("ANULADA" as const) : ("ACTIVA" as const),
                        canal: f.canal,
                        comisionPct: f.canal === "APP" ? 28 : 0,
                        jornadaId: jornadaPorDia.get(f.dia.substring(0, 10)) ?? null,
                        clienteId: f.clienteId,
                        nombreCliente: f.nombreCliente,
                        efectivoRecibido: f.efectivoRecibido,
                        cambio: f.cambio,
                        fechaVencimiento: f.credito
                            ? new Date(f.fecha.getTime() + 15 * 24 * 60 * 60 * 1000)
                            : null,
                    })),
                )
                .returning({ id: ventas.id });

            /* Detalle por venta */
            const detalles: (typeof detalleVentas.$inferInsert)[] = [];
            const extrasPorDetalle: { indice: number; extraId: number; precio: number }[] = [];

            insertadas.forEach((v, indice) => {
                const f = filas[indice];
                const lineas = entre(1, 3);
                let restante = f.total;
                for (let l = 0; l < lineas; l++) {
                    const p = elegir(catalogo);
                    const cantidad = entre(1, 2);
                    const esUltima = l === lineas - 1;
                    const base = round2(Number(p.precioVenta) * cantidad);
                    const valor = esUltima ? round2(Math.max(0, restante)) : Math.min(base, restante);
                    restante = round2(restante - valor);
                    const idx = detalles.length;
                    detalles.push({
                        ventaId: v.id,
                        productoId: p.id,
                        cantidad,
                        precioUnitario: Number(p.precioVenta),
                        subtotal: valor,
                        nota: azar() > 0.8 ? elegir(NOTAS) : null,
                    });
                    if (listaExtras.length > 0 && azar() > 0.75) {
                        const e = elegir(listaExtras);
                        extrasPorDetalle.push({ indice: idx, extraId: e.id, precio: Number(e.precio) });
                    }
                }
                creadas.push({
                    id: v.id,
                    dia: f.dia,
                    total: f.total,
                    saldo: f.saldo,
                    formaPago: f.formaPago,
                    credito: f.credito,
                });
            });

            const detalleCreado = await tx
                .insert(detalleVentas)
                .values(detalles)
                .returning({ id: detalleVentas.id });

            const filasExtras = extrasPorDetalle.map((e) => ({
                detalleVentaId: detalleCreado[e.indice].id,
                extraId: e.extraId,
                cantidad: 1,
                precioUnitario: e.precio,
            }));
            if (filasExtras.length > 0) await tx.insert(detalleVentaExtras).values(filasExtras);
        }

        /* ---------- Abonos de las ventas a crédito ---------- */
        console.log("Abonos de cartera…");
        const creditos = creadas.filter((v) => v.credito && v.saldo > 0);
        const abonosFilas: (typeof abonos.$inferInsert)[] = [];
        for (const v of creditos) {
            const pagado = azar();
            if (pagado < 0.35) continue;
            const abono = pagado > 0.8 ? v.total : round2(v.total * (0.3 + azar() * 0.5));
            abonosFilas.push({
                ventaId: v.id,
                monto: round2(Math.min(abono, v.total)),
                fecha: fechaBogota(entre(0, 10), entre(10, 19), entre(0, 59)),
                metodo: elegir(["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const),
                nota: pagado > 0.8 ? "Abono total" : "Abono parcial",
            });
        }
        if (abonosFilas.length) {
            await tx.insert(abonos).values(abonosFilas);
            for (const a of abonosFilas) {
                await tx
                    .update(ventas)
                    .set({ saldo: sql`greatest(0, ${ventas.saldo} - ${a.monto})` })
                    .where(eq(ventas.id, a.ventaId));
            }
        }

        /* ---------- Producciones + gasto de materia prima ---------- */
        console.log("Producciones…");
        const conReceta = catalogo.filter((p) => p.recetaId);
        for (let i = 0; i < 60; i++) {
            const producto = elegir(conReceta);
            const lineas = recetasPorId.get(producto.recetaId!) ?? [];
            if (lineas.length === 0) continue;
            const cantidad = entre(6, 18);
            const fecha = fechaBogota(entre(0, DIAS - 1), entre(8, 10), entre(0, 59));
            const costoTotal = round4(
                lineas.reduce((s, l) => s + l.cantidad * l.precio, 0) * cantidad,
            );

            const [prod] = await tx
                .insert(producciones)
                .values({
                    fecha,
                    cantidad,
                    costoTotal,
                    estado: "COMPLETADA",
                    productoId: producto.id,
                })
                .returning({ id: producciones.id });

            await tx.insert(detalleProducciones).values(
                lineas.map((l) => ({
                    produccionId: prod.id,
                    insumoId: l.insumoId,
                    cantidadRequerida: round4(l.cantidad * cantidad),
                    cantidadUsada: round4(l.cantidad * cantidad),
                    costoLinea: round4(l.cantidad * l.precio * cantidad),
                    precioUnidadBaseSnapshot: l.precio,
                    suficiente: true,
                })),
            );

            await tx.insert(gastos).values({
                fecha,
                monto: round2(costoTotal),
                categoria: "MATERIA_PRIMA",
                descripcion: `Materia prima - ${producto.nombre} x${cantidad}`,
                produccionId: prod.id,
            });
        }

        /* ---------- Gastos operativos ---------- */
        console.log("Gastos…");
        const gastosFilas: (typeof gastos.$inferInsert)[] = [];
        for (let d = 0; d < DIAS; d++) {
            const cuantos = entre(2, 4);
            for (let g = 0; g < cuantos; g++) {
                const categoria = elegir(CATEGORIAS_GASTO.filter((c) => c !== "MATERIA_PRIMA"));
                gastosFilas.push({
                    fecha: fechaBogota(d, entre(9, 20), entre(0, 59)),
                    monto: round2(entre(15, 400) * 1000),
                    categoria,
                    descripcion: elegir(GASTOS_TEXTO[categoria]),
                });
            }
        }
        await tx.insert(gastos).values(gastosFilas);

        /* ---------- Ajustes de inventario ---------- */
        console.log("Ajustes de inventario…");
        const listaAjustes = await tx.select().from(insumos);
        const ajustesFilas: (typeof ajustesInventario.$inferInsert)[] = [];
        for (let i = 0; i < 18; i++) {
            const insumo = elegir(listaAjustes);
            const delta = round4((azar() > 0.5 ? 1 : -1) * entre(50, 400));
            ajustesFilas.push({
                insumoId: insumo.id,
                delta,
                stockResultante: round4(Number(insumo.stockActual) + delta),
                valor: round2(Math.abs(delta) * Number(insumo.precioUnidadBase)),
                motivo: elegir(["Conteo físico", "Producto vencido", "Derrame", "Compra no registrada"]),
                usuario: azar() > 0.5 ? "admin" : "cajero",
                fecha: fechaBogota(entre(0, DIAS - 1), entre(9, 18), entre(0, 59)),
            });
        }
        await tx.insert(ajustesInventario).values(ajustesFilas);

        /* ---------- Arqueo de los días cerrados ---------- */
        console.log("Cuadrando arqueos…");
        const efectivoPorDia = new Map<string, number>();
        for (const v of creadas) {
            if (v.formaPago !== "EFECTIVO" || v.dia.length === 0) continue;
            efectivoPorDia.set(v.dia, round2((efectivoPorDia.get(v.dia) ?? 0) + v.total));
        }
        for (const j of jornadasCreadas) {
            const dia = j.dia.substring(0, 10);
            const [fila] = await tx.select().from(jornadas).where(eq(jornadas.id, j.id));
            if (!fila.activa) {
                const esperado = round2(50000 + (efectivoPorDia.get(dia) ?? 0) - Number(fila.retiros));
                const descuadre = azar() < 0.2 ? entre(-20, 20) * 500 : 0;
                await tx
                    .update(jornadas)
                    .set({ efectivoContado: round2(esperado + descuadre), diferencia: descuadre })
                    .where(eq(jornadas.id, j.id));
            }
        }
    });

    const resumen = await db.execute(sql`
        select
            (select count(*) from ventas) ventas,
            (select count(*) from detalle_ventas) lineas,
            (select count(*) from detalle_venta_extras) extras,
            (select count(*) from abonos) abonos,
            (select count(*) from producciones) producciones,
            (select count(*) from gastos) gastos,
            (select count(*) from clientes) clientes,
            (select count(*) from ajustes_inventario) ajustes,
            (select round(sum(total)) from ventas where estado='ACTIVA') vendido
    `);
    console.table(resumen);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
