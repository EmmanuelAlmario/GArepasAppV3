/**
 * Semilla de desarrollo — espejo de UsuarioSeeder + DataSeeder del backend.
 * Idempotente: se puede correr varias veces.
 *
 * npx tsx --env-file=.env.local src/db/seed.ts
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../index";
import {
    configuracionNegocio,
    detalleRecetas,
    insumos,
    productos,
    recetas,
    usuarios,
} from "../schema";
import { precioABase, type Unidad } from "../../lib/units";

if (process.env.NODE_ENV === "production") {
    console.error("Script de desarrollo: en producción usa `node scripts/migrar.mjs` y `node scripts/admin.mjs`.");
    process.exit(1);
}


const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const CAJERO_PASSWORD = process.env.CAJERO_PASSWORD ?? "cajero123";

async function usuario(username: string, password: string, rol: "ADMIN" | "VENTAS") {
    const existente = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.username, username));
    if (existente.length > 0) return;
    await db.insert(usuarios).values({
        username,
        password: await bcrypt.hash(password, 10),
        rol,
        activo: true,
    });
    console.log(`usuario ${username} (${rol}) creado`);
}

type InsumoSeed = {
    nombre: string;
    marca: string;
    categoria: string;
    unidad: Unidad;
    /** Precio de la presentación completa (ej. bulto de 1 kg). */
    precioPresentacion: number;
    stock: number;
    minimo: number;
};

const INSUMOS: InsumoSeed[] = [
    { nombre: "Harina de maíz precocida", marca: "Pan", categoria: "Harinas", unidad: "KILOGRAMO", precioPresentacion: 6200, stock: 12000, minimo: 2000 },
    { nombre: "Queso campesino", marca: "Local", categoria: "Lácteos", unidad: "KILOGRAMO", precioPresentacion: 18000, stock: 5000, minimo: 1000 },
    { nombre: "Huevo", marca: "Kike", categoria: "Huevos", unidad: "UNIDAD", precioPresentacion: 600, stock: 60, minimo: 12 },
    { nombre: "Mantequilla", marca: "Colanta", categoria: "Lácteos", unidad: "GRAMO", precioPresentacion: 1, stock: 900, minimo: 200 },
    { nombre: "Aceite de girasol", marca: "Premier", categoria: "Aceites", unidad: "LITRO", precioPresentacion: 12000, stock: 3000, minimo: 500 },
    { nombre: "Sal refinada", marca: "Refisal", categoria: "Condimentos", unidad: "KILOGRAMO", precioPresentacion: 2500, stock: 1000, minimo: 250 },
    { nombre: "Chocolate en polvo", marca: "Corona", categoria: "Bebidas", unidad: "GRAMO", precioPresentacion: 1, stock: 800, minimo: 200 },
    { nombre: "Azúcar", marca: "Incauca", categoria: "Endulzantes", unidad: "KILOGRAMO", precioPresentacion: 4200, stock: 2000, minimo: 500 },
];

async function main() {
    await usuario("admin", ADMIN_PASSWORD, "ADMIN");
    await usuario("cajero", CAJERO_PASSWORD, "VENTAS");

    const [config] = await db.select({ id: configuracionNegocio.id }).from(configuracionNegocio).limit(1);
    if (!config) {
        await db.insert(configuracionNegocio).values({
            nombreComercial: "Gordo Arepas",
            impuestoPorcentaje: 0,
            mensajeRecibo: "Gracias por tu compra. Te esperamos pronto.",
            logoUrl: "/images/logo-gordo-arepas.png",
            actualizadoEn: new Date(),
        });
        console.log("configuración del negocio creada");
    }

    const idPorInsumo = new Map<string, number>();
    for (const i of INSUMOS) {
        const [fila] = await db
            .insert(insumos)
            .values({
                nombre: i.nombre,
                marca: i.marca,
                categoria: i.categoria,
                unidadPresentacion: i.unidad,
                precioUnidadBase: precioABase(i.precioPresentacion, i.unidad),
                stockActual: i.stock,
                stockMinimo: i.minimo,
                activo: true,
            })
            .onConflictDoNothing({ target: insumos.nombre })
            .returning({ id: insumos.id });

        if (fila) {
            idPorInsumo.set(i.nombre, fila.id);
        } else {
            const [existente] = await db
                .select({ id: insumos.id })
                .from(insumos)
                .where(eq(insumos.nombre, i.nombre));
            idPorInsumo.set(i.nombre, existente.id);
        }
    }

    const recetaSeed = async (
        nombre: string,
        descripcion: string,
        rendimiento: number,
        lineas: Array<[string, number]>,
    ) => {
        const [existe] = await db.select({ id: recetas.id }).from(recetas).where(eq(recetas.nombre, nombre));
        if (existe) return existe.id;

        const [receta] = await db
            .insert(recetas)
            .values({ nombre, descripcion, rendimiento })
            .returning({ id: recetas.id });

        await db.insert(detalleRecetas).values(
            lineas.map(([insumo, cantidad]) => ({
                recetaId: receta.id,
                insumoId: idPorInsumo.get(insumo)!,
                cantidad,
            })),
        );
        console.log(`receta ${nombre} creada`);
        return receta.id;
    };

    const rQueso = await recetaSeed("Arepa de queso asada", "Gruesa, asada en plancha.", 1, [
        ["Harina de maíz precocida", 120],
        ["Queso campesino", 60],
        ["Mantequilla", 10],
        ["Sal refinada", 2],
    ]);
    const rPlana = await recetaSeed("Arepa plana", "La clásica delgada.", 1, [
        ["Harina de maíz precocida", 100],
        ["Aceite de girasol", 8],
        ["Sal refinada", 2],
    ]);
    const rHuevo = await recetaSeed("Arepa de huevo", "Rellena de huevo y queso.", 1, [
        ["Harina de maíz precocida", 110],
        ["Huevo", 1],
        ["Queso campesino", 30],
        ["Aceite de girasol", 40],
        ["Sal refinada", 2],
    ]);
    const rChocolate = await recetaSeed("Chocolate caliente", "Espesito, a fuego lento.", 1, [
        ["Chocolate en polvo", 25],
        ["Azúcar", 10],
    ]);

    const productosSeed: Array<[string, number, number, number, number]> = [
        ["Arepa de queso asada", 4500, 20, 5, rQueso],
        ["Arepa plana", 3000, 25, 5, rPlana],
        ["Arepa de huevo", 6000, 12, 4, rHuevo],
        ["Chocolate caliente", 3500, 15, 4, rChocolate],
    ];

    for (const [nombre, precio, stock, minimo, recetaId] of productosSeed) {
        await db
            .insert(productos)
            .values({
                nombre,
                precioVenta: precio,
                stockActual: stock,
                stockMinimo: minimo,
                activo: true,
                bajoPedido: false,
                recetaId,
            })
            .onConflictDoNothing({ target: productos.nombre });
    }

    console.log("semilla lista");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
