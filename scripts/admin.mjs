/**
 * Crea o actualiza un usuario administrador (útil en una base nueva).
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD='...' node scripts/admin.mjs
 */
import bcrypt from "bcryptjs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD;

if (!url) {
    console.error("Falta DATABASE_URL");
    process.exit(1);
}
if (!password || password.length < 8) {
    console.error("Define ADMIN_PASSWORD (mínimo 8 caracteres)");
    process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

try {
    const hash = await bcrypt.hash(password, 10);
    await sql`
        insert into usuarios (username, password, rol, activo)
        values (${username}, ${hash}, 'ADMIN', true)
        on conflict (username) do update
        set password = excluded.password, rol = 'ADMIN', activo = true
    `;
    console.log(`usuario ${username} listo (ADMIN)`);
} catch (error) {
    console.error("No se pudo crear el usuario:", error.message);
    process.exitCode = 1;
} finally {
    await sql.end({ timeout: 5 });
}
