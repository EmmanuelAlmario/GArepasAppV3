/**
 * Clasifica los productos que ya están en la base para que la carta pública
 * los muestre en su sección. Solo rellena lo que está vacío: no toca precios,
 * stock, recetas ni productos que no reconoce.
 *
 *   DATABASE_URL=... node scripts/clasificar-carta.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("Falta DATABASE_URL");
    process.exit(1);
}

const CARTA = {
    "tradicional": ["AREPA", "Queso costeño y papita ripio. La de todos los días."],
    "medellin": ["AREPA", "Chorizo, queso costeño y papita ripio."],
    "tokio costeña": ["AREPA", "Pollo, queso costeño y papita ripio."],
    "tokio costena": ["AREPA", "Pollo, queso costeño y papita ripio."],
    "cerdo bbq": ["AREPA", "Cerdo, queso costeño y papita ripio."],
    "ropa vieja": ["AREPA", "Carne desmechada, queso costeño y papita ripio."],
    "mixta": ["AREPA", "Carne, pollo o cerdo, queso costeño y papita ripio."],
    "choripan": ["AREPA", "Pan artesanal, tres chorizos, queso costeño y papita ripio."],
    "choripán": ["AREPA", "Pan artesanal, tres chorizos, queso costeño y papita ripio."],
    "choripan mixto": ["AREPA", "Pan artesanal, dos chorizos santarosanos, queso costeño y papita ripio."],
    "choripán mixto": ["AREPA", "Pan artesanal, dos chorizos santarosanos, queso costeño y papita ripio."],
    "gordo arepa": ["AREPA", "Carne, pollo, cerdo, chorizo, queso costeño y papita ripio."],
    "bandejas x6": ["CASA", "Seis arepas listas para planchar en casa."],
    "bandeja x6": ["CASA", "Seis arepas listas para planchar en casa."],
    "chorizo artesanal x5": ["CASA", "Cinco chorizos de la casa para asar."],
    "gaseosa personal": ["BEBIDA", ""],
    "gaseosa 1.5 litros": ["BEBIDA", ""],
    "gaseosa 1.5l": ["BEBIDA", ""],
    "agua": ["BEBIDA", ""],
};

const normalizar = (texto) =>
    texto.trim().toLowerCase().replace(/\s+/g, " ");

const sql = postgres(url, { max: 1, prepare: false });

try {
    const productos = await sql`
        select id, nombre, categoria, descripcion from productos order by nombre
    `;

    let tocados = 0;

    for (const p of productos) {
        const nombre = normalizar(p.nombre);
        /* "Arepa Tradicional", "Arepa de queso"… se resuelven por su núcleo. */
        const clave = CARTA[nombre]
            ? nombre
            : CARTA[nombre.replace(/^arepa (de )?/, "")]
              ? nombre.replace(/^arepa (de )?/, "")
              : null;
        const dato = clave ? CARTA[clave] : undefined;
        if (!dato) {
            console.log(`· sin clasificar: ${p.nombre}`);
            continue;
        }
        const [categoria, descripcion] = dato;
        const sinCategoria = !p.categoria || p.categoria === "AREPA";
        const sinDescripcion = !p.descripcion;
        if (!sinDescripcion && categoria === p.categoria) continue;

        await sql`
            update productos set
                categoria = ${categoria},
                descripcion = ${sinDescripcion ? descripcion : p.descripcion}
            where id = ${p.id}
        `;
        tocados += 1;
        console.log(`+ ${p.nombre} → ${categoria}`);
    }

    console.log(`Listo: ${tocados} producto(s) clasificados.`);
} catch (error) {
    console.error("Falló la clasificación:", error.message);
    process.exitCode = 1;
} finally {
    await sql.end({ timeout: 5 });
}
