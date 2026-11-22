/**
 * Migraciones para producción.
 *
 * Aplica los SQL de src/db/migrations en orden y registra cada uno en
 * _migraciones. Si encuentra una base creada por el backend anterior
 * (Flyway, tablas ya existentes), marca la migración base como aplicada
 * y solo corre los cambios nuevos.
 *
 *   DATABASE_URL=postgres://... node scripts/migrar.mjs
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("Falta DATABASE_URL");
    process.exit(1);
}

const carpeta = path.resolve("src/db/migrations");
const archivos = fs
    .readdirSync(carpeta)
    .filter((f) => f.endsWith(".sql"))
    .sort();

if (archivos.length === 0) {
    console.error(`No hay migraciones en ${carpeta}`);
    process.exit(1);
}

/* Errores de "ya existe": hacen la corrida re-ejecutable. */
const TOLERADOS = new Set(["42701", "42P07", "42710", "42P16", "42703"]);

const sql = postgres(url, { max: 1, prepare: false });

try {
    await sql`
        create table if not exists _migraciones (
            nombre text primary key,
            aplicada_en timestamptz not null default now()
        )
    `;

    const registradas = new Set(
        (await sql`select nombre from _migraciones`).map((f) => f.nombre),
    );

    /* Base del backend anterior: la 0000 ya está aplicada de hecho. */
    if (registradas.size === 0) {
        const [{ existe }] = await sql`
            select to_regclass('public.productos') is not null as existe
        `;
        if (existe) {
            await sql`insert into _migraciones (nombre) values (${archivos[0]}) on conflict do nothing`;
            registradas.add(archivos[0]);
            console.log(`base existente detectada → ${archivos[0]} marcada como aplicada`);
        }
    }

    let aplicadas = 0;

    for (const archivo of archivos) {
        if (registradas.has(archivo)) {
            console.log(`= ${archivo} (ya aplicada)`);
            continue;
        }

        const contenido = fs.readFileSync(path.join(carpeta, archivo), "utf8");
        const sentencias = contenido
            .split("--> statement-breakpoint")
            .map((s) => s.trim())
            .filter(Boolean);

        await sql.begin(async (tx) => {
            for (const sentencia of sentencias) {
                try {
                    await tx.unsafe(sentencia);
                } catch (error) {
                    if (TOLERADOS.has(error.code)) {
                        console.warn(`  · se ignora (${error.code}): ${sentencia.slice(0, 70)}…`);
                        continue;
                    }
                    throw error;
                }
            }
            await tx`insert into _migraciones (nombre) values (${archivo})`;
        });

        aplicadas += 1;
        console.log(`+ ${archivo}`);
    }

    console.log(
        aplicadas === 0
            ? "Base al día: no había migraciones pendientes."
            : `Listo: ${aplicadas} migración(es) aplicadas.`,
    );
} catch (error) {
    console.error("Falló la migración:", error.message);
    if (error.detail) console.error(error.detail);
    process.exitCode = 1;
} finally {
    await sql.end({ timeout: 5 });
}
