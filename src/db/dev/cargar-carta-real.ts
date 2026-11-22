/**
 * Carga la carta real de Gordo Arepa (CSV `recetas_gordoarepa.csv` +
 * `recetas_gordoarepa.md`, 2026-11-21) y borra los datos de prueba.
 *
 * DESTRUCTIVO: vacía ventas, producciones, gastos, ajustes, abonos,
 * jornadas, clientes y todo el catálogo. Conserva usuarios, configuración,
 * extras y las migraciones.
 *
 * npx tsx --env-file=.env.local src/db/cargar-carta-real.ts
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
    gastos,
    insumos,
    jornadas,
    producciones,
    productos,
    recetas,
    ventas,
} from "../schema";
import type { Unidad } from "../../lib/units";

if (process.env.NODE_ENV === "production") {
    console.error("Script de desarrollo: en producción usa `node scripts/migrar.mjs` y `node scripts/admin.mjs`.");
    process.exit(1);
}


type InsumoSeed = {
    nombre: string;
    categoria: string;
    unidad: Unidad;
    /** Precio por unidad base, tal como viene en la base de producción. */
    precioBase: number;
    marca?: string;
};

/* Precios tomados de recetas_gordoarepa.md (base de producción). */
const INSUMOS: InsumoSeed[] = [
    { nombre: "Masa Preparada", categoria: "Preparados", unidad: "GRAMO", precioBase: 4.5038 },
    { nombre: "Maiz", categoria: "Harinas", unidad: "GRAMO", precioBase: 2.7 },
    { nombre: "Mantequilla", categoria: "Lácteos", unidad: "GRAMO", precioBase: 13 },
    { nombre: "Sal", categoria: "Condimentos", unidad: "GRAMO", precioBase: 1 },
    { nombre: "Leche en polvo", categoria: "Lácteos", unidad: "GRAMO", precioBase: 20 },
    { nombre: "Queso costeño", categoria: "Lácteos", unidad: "GRAMO", precioBase: 25 },
    { nombre: "Chorizo", categoria: "Carnes", unidad: "UNIDAD", precioBase: 3000 },
    { nombre: "Cerdo", categoria: "Carnes", unidad: "GRAMO", precioBase: 13.9 },
    { nombre: "Carne para esmechar", categoria: "Carnes", unidad: "GRAMO", precioBase: 23 },
    { nombre: "Pechuga", categoria: "Carnes", unidad: "GRAMO", precioBase: 10.8 },
    { nombre: "Bolsa de Papa Ripio", categoria: "Papas", unidad: "GRAMO", precioBase: 9 },
    { nombre: "Aceite", categoria: "Aceites", unidad: "MILILITRO", precioBase: 28 },
    { nombre: "Azúcar morena", categoria: "Endulzantes", unidad: "GRAMO", precioBase: 20 },
    { nombre: "Cebolla Larga", categoria: "Verduras", unidad: "GRAMO", precioBase: 5 },
    { nombre: "Mayonesa", categoria: "Salsas", unidad: "GRAMO", precioBase: 34 },
    { nombre: "Mostaza", categoria: "Salsas", unidad: "GRAMO", precioBase: 30 },
    { nombre: "Salsa Piña", categoria: "Salsas", unidad: "GRAMO", precioBase: 0.034 },
    { nombre: "Salsa Tartara", categoria: "Salsas", unidad: "GRAMO", precioBase: 1 },
    { nombre: "Pan", categoria: "Panadería", unidad: "UNIDAD", precioBase: 9900 },
    { nombre: "Elixir", categoria: "Bebidas", unidad: "UNIDAD", precioBase: 14000 },
    { nombre: "Bol", categoria: "Empaque", unidad: "UNIDAD", precioBase: 920 },
    { nombre: "Tenedor", categoria: "Empaque", unidad: "UNIDAD", precioBase: 78 },
    { nombre: "Sticker", categoria: "Empaque", unidad: "UNIDAD", precioBase: 250 },
    { nombre: "Bandeja desechables", categoria: "Empaque", unidad: "UNIDAD", precioBase: 200 },
    { nombre: "Papel para envolver", categoria: "Empaque", unidad: "UNIDAD", precioBase: 7500 },
];

type LineaSeed = [insumo: string, cantidad: number];

type RecetaSeed = {
    nombre: string;
    descripcion: string;
    rendimiento: number | null;
    /** Insumo que produce esta receta (solo la masa). */
    produce?: string;
    lineas: LineaSeed[];
};

/* Líneas exactas del CSV (receta, insumo, cantidad). */
const RECETAS: RecetaSeed[] = [
    {
        nombre: "Masa preparada",
        descripcion: "Masa base de todas las arepas. Rinde 1.046,5 g.",
        rendimiento: 1046.5,
        produce: "Masa Preparada",
        lineas: [
            ["Maiz", 1000],
            ["Sticker", 1],
            ["Mantequilla", 81.4],
            ["Sal", 7],
            ["Leche en polvo", 34.9],
        ],
    },
    {
        nombre: "Tokio costeña",
        descripcion: "Pollo, queso costeño y papita ripio.",
        rendimiento: null,
        lineas: [
            ["Masa Preparada", 73],
            ["Tenedor", 1],
            ["Bol", 1],
            ["Bolsa de Papa Ripio", 70],
            ["Queso costeño", 27],
            ["Pechuga", 80],
            ["Sticker", 1],
        ],
    },
    {
        nombre: "Medellin",
        descripcion: "Chorizo, queso costeño y papita ripio.",
        rendimiento: null,
        lineas: [
            ["Chorizo", 1],
            ["Masa Preparada", 73],
            ["Tenedor", 1],
            ["Bol", 1],
            ["Bolsa de Papa Ripio", 70],
            ["Queso costeño", 47],
            ["Sticker", 1],
        ],
    },
    {
        nombre: "Mixta (Cerdo)",
        descripcion: "Cerdo, carne para esmechar, queso costeño y papita ripio.",
        rendimiento: null,
        lineas: [
            ["Masa Preparada", 73],
            ["Tenedor", 1],
            ["Bol", 1],
            ["Cerdo", 80],
            ["Bolsa de Papa Ripio", 70],
            ["Carne para esmechar", 80],
            ["Queso costeño", 47],
            ["Sticker", 1],
        ],
    },
    {
        nombre: "Gordo Arepa",
        descripcion: "Carne, pollo, cerdo, chorizo, queso costeño y papita ripio.",
        rendimiento: null,
        lineas: [
            ["Chorizo", 1],
            ["Masa Preparada", 73],
            ["Tenedor", 1],
            ["Bol", 1],
            ["Cerdo", 80],
            ["Bolsa de Papa Ripio", 70],
            ["Carne para esmechar", 80],
            ["Queso costeño", 47],
            ["Pechuga", 80],
            ["Sticker", 1],
        ],
    },
];

/** Precios de la carta vigente (nov-2026), en pesos. */
const PRODUCTOS: Array<{ nombre: string; precio: number; receta: string }> = [
    { nombre: "Medellin", precio: 12000, receta: "Medellin" },
    { nombre: "Tokio costeña", precio: 15000, receta: "Tokio costeña" },
    { nombre: "Mixta", precio: 18000, receta: "Mixta (Cerdo)" },
    { nombre: "Gordo Arepa", precio: 25000, receta: "Gordo Arepa" },
];

async function main() {
    await db.transaction(async (tx) => {
        console.log("Borrando datos de prueba…");
        /* Orden hijo → padre por las llaves foráneas. */
        await tx.delete(detalleVentaExtras);
        await tx.delete(abonos);
        await tx.delete(detalleProducciones);
        /* gastos → producciones → ventas: cada uno referencia al siguiente. */
        await tx.delete(gastos);
        await tx.delete(producciones);
        await tx.delete(detalleVentas);
        await tx.delete(ventas);
        await tx.delete(ajustesInventario);
        await tx.delete(detalleRecetas);
        await tx.delete(productos);
        await tx.delete(recetas);
        await tx.delete(insumos);
        await tx.delete(jornadas);
        await tx.delete(clientes);

        console.log("Cargando insumos…");
        const idPorNombre = new Map<string, number>();
        for (const i of INSUMOS) {
            const [fila] = await tx
                .insert(insumos)
                .values({
                    nombre: i.nombre,
                    marca: i.marca ?? "—",
                    categoria: i.categoria,
                    unidadPresentacion: i.unidad,
                    /* El CSV ya viene en unidad base: no se re-convierte. */
                    precioUnidadBase: i.precioBase,
                    stockActual: 0,
                    stockMinimo: null,
                    activo: true,
                })
                .returning({ id: insumos.id });
            idPorNombre.set(i.nombre, fila.id);
        }

        console.log("Cargando recetas…");
        const recetaPorNombre = new Map<string, number>();
        for (const r of RECETAS) {
            const [fila] = await tx
                .insert(recetas)
                .values({
                    nombre: r.nombre,
                    descripcion: r.descripcion,
                    rendimiento: r.rendimiento,
                    insumoProducidoId: r.produce ? (idPorNombre.get(r.produce) ?? null) : null,
                })
                .returning({ id: recetas.id });
            recetaPorNombre.set(r.nombre, fila.id);

            await tx.insert(detalleRecetas).values(
                r.lineas.map(([nombre, cantidad]) => ({
                    recetaId: fila.id,
                    insumoId: idPorNombre.get(nombre)!,
                    cantidad,
                })),
            );
        }

        console.log("Cargando productos…");
        for (const p of PRODUCTOS) {
            await tx.insert(productos).values({
                nombre: p.nombre,
                precioVenta: p.precio,
                stockActual: 0,
                stockMinimo: null,
                activo: true,
                bajoPedido: false,
                controlarStock: true,
                recetaId: recetaPorNombre.get(p.receta)!,
            });
        }
    });

    /* Verificación: costo de cada receta según el precio cargado. */
    const filas = await db
        .select({
            receta: recetas.nombre,
            costo: sql<number>`coalesce(sum(${detalleRecetas.cantidad} * ${insumos.precioUnidadBase}), 0)::float8`,
            rendimiento: recetas.rendimiento,
        })
        .from(recetas)
        .innerJoin(detalleRecetas, eq(detalleRecetas.recetaId, recetas.id))
        .innerJoin(insumos, eq(detalleRecetas.insumoId, insumos.id))
        .groupBy(recetas.id, recetas.nombre, recetas.rendimiento)
        .orderBy(recetas.nombre);

    console.table(
        filas.map((f) => ({
            receta: f.receta,
            costo: Math.round(f.costo),
            rendimiento: f.rendimiento,
            unitario: f.rendimiento ? Math.round(f.costo / f.rendimiento) : null,
        })),
    );

    const total = await db.select({ n: sql<number>`count(*)::int` }).from(productos);
    console.log(`productos activos: ${total[0].n}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
