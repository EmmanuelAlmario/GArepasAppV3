import postgres from "postgres";

/**
 * Avisos de cambio vía Postgres NOTIFY. Se instalan una sola vez desde la
 * app (idempotente) para no depender de un paso manual al desplegar.
 *
 * El canal es único ('garepas'); el payload dice qué tabla cambió.
 */
const TABLAS: Array<{ tabla: string; eventos: string }> = [
    { tabla: "ventas", eventos: "insert or update of estado, saldo" },
    { tabla: "detalle_ventas", eventos: "insert" },
    { tabla: "productos", eventos: "update of stock_actual, activo, precio_venta" },
    { tabla: "insumos", eventos: "update of stock_actual, precio_unidad_base" },
    { tabla: "jornadas", eventos: "insert or update of activa" },
    { tabla: "producciones", eventos: "insert or update of estado" },
    { tabla: "abonos", eventos: "insert" },
    { tabla: "gastos", eventos: "insert or update" },
];

let listo: Promise<void> | null = null;

async function instalar() {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
        await sql`
            create or replace function notificar_cambio() returns trigger as $$
            begin
              perform pg_notify('garepas', TG_TABLE_NAME);
              return null;
            end;
            $$ language plpgsql
        `;

        for (const { tabla, eventos } of TABLAS) {
            await sql.unsafe(`drop trigger if exists trg_${tabla}_cambio on ${tabla}`);
            await sql.unsafe(
                `create trigger trg_${tabla}_cambio after ${eventos} on ${tabla}
                 for each row execute function notificar_cambio()`,
            );
        }
    } finally {
        await sql.end({ timeout: 5 });
    }
}

/** Instala los triggers la primera vez que se pide el stream. */
export function asegurarTiempoReal() {
    listo ??= instalar().catch((error) => {
        listo = null;
        throw error;
    });
    return listo;
}
