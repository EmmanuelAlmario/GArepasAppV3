/**
 * Completa la carta pública con precio, sección y la línea que se lee en el
 * menú. No crea recetas: son productos de venta (dirección), no de producción.
 *
 * npx tsx --env-file=.env.local src/db/carta-publica.ts
 */
import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import { productos } from "./schema";

type Item = {
    nombre: string;
    precio: number;
    categoria: "AREPA" | "CASA" | "BEBIDA";
    descripcion: string;
    bajoPedido?: boolean;
    controlarStock?: boolean;
};

const CARTA: Item[] = [
    {
        nombre: "Tradicional",
        precio: 7000,
        categoria: "AREPA",
        descripcion: "Queso costeño y papita ripio. La de todos los días.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Medellin",
        precio: 12000,
        categoria: "AREPA",
        descripcion: "Chorizo, queso costeño y papita ripio.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Tokio costeña",
        precio: 15000,
        categoria: "AREPA",
        descripcion: "Pollo, queso costeño y papita ripio.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Cerdo BBQ",
        precio: 15000,
        categoria: "AREPA",
        descripcion: "Cerdo, queso costeño y papita ripio.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Ropa Vieja",
        precio: 15000,
        categoria: "AREPA",
        descripcion: "Carne desmechada, queso costeño y papita ripio.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Mixta",
        precio: 18000,
        categoria: "AREPA",
        descripcion: "Carne, pollo o cerdo, queso costeño y papita ripio.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Choripán",
        precio: 15000,
        categoria: "AREPA",
        descripcion: "Pan artesanal, tres chorizos, queso costeño y papita ripio.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Choripán Mixto",
        precio: 20000,
        categoria: "AREPA",
        descripcion: "Pan artesanal, dos chorizos santarosanos, queso costeño y papita ripio.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Gordo Arepa",
        precio: 25000,
        categoria: "AREPA",
        descripcion: "Carne, pollo, cerdo, chorizo, queso costeño y papita ripio. La de la casa.",
        bajoPedido: true,
        controlarStock: false,
    },
    {
        nombre: "Bandejas x6",
        precio: 18000,
        categoria: "CASA",
        descripcion: "Seis arepas listas para planchar en casa.",
        controlarStock: false,
    },
    {
        nombre: "Chorizo artesanal x5",
        precio: 18000,
        categoria: "CASA",
        descripcion: "Cinco chorizos de la casa para asar.",
        controlarStock: false,
    },
    {
        nombre: "Gaseosa personal",
        precio: 5000,
        categoria: "BEBIDA",
        descripcion: "",
        bajoPedido: true,
        controlarStock: false,
    },
    { nombre: "Gaseosa 1.5 litros", precio: 10000, categoria: "BEBIDA", descripcion: "" },
    { nombre: "Agua", precio: 2000, categoria: "BEBIDA", descripcion: "" },
];

async function main() {
    for (const item of CARTA) {
        const [existente] = await db
            .select({ id: productos.id })
            .from(productos)
            .where(eq(productos.nombre, item.nombre))
            .limit(1);

        const datos = {
            categoria: item.categoria,
            descripcion: item.descripcion,
            precioVenta: item.precio,
            activo: true,
            ...(item.bajoPedido !== undefined ? { bajoPedido: item.bajoPedido } : {}),
            ...(item.controlarStock !== undefined ? { controlarStock: item.controlarStock } : {}),
        };

        if (existente) {
            await db.update(productos).set(datos).where(eq(productos.id, existente.id));
        } else {
            await db.insert(productos).values({
                ...datos,
                nombre: item.nombre,
                stockActual: 0,
                stockMinimo: null,
                bajoPedido: item.bajoPedido ?? false,
                controlarStock: item.controlarStock ?? true,
            });
        }
    }

    const filas = await db
        .select({
            nombre: productos.nombre,
            categoria: productos.categoria,
            precio: productos.precioVenta,
        })
        .from(productos)
        .orderBy(asc(productos.categoria), asc(productos.nombre));

    console.table(filas);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
