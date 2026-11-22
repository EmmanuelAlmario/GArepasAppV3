"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { guardarSesion, borrarSesion } from "@/lib/session";

export type EstadoLogin = { error?: string };

/** Hash de relleno para que un usuario inexistente tarde lo mismo que uno real. */
const HASH_RELLENO = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.O0q6m6lq5G0V6F6pB7nS1z4hZ0jS";

export async function iniciarSesion(
    _estado: EstadoLogin,
    formData: FormData,
): Promise<EstadoLogin> {
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const volverCrudo = String(formData.get("volver") ?? "/");
    const volver = volverCrudo.startsWith("/") && !volverCrudo.startsWith("//") ? volverCrudo : "/";

    if (!username || !password) {
        return { error: "Escribe tu usuario y contraseña." };
    }

    const [usuario] = await db
        .select()
        .from(usuarios)
        .where(eq(sql`lower(${usuarios.username})`, username.toLowerCase()))
        .limit(1);

    const coincide = await bcrypt.compare(password, usuario?.password ?? HASH_RELLENO);

    if (!usuario || !usuario.activo || !coincide) {
        return { error: "Usuario o contraseña incorrectos." };
    }

    await guardarSesion({ id: usuario.id, username: usuario.username, rol: usuario.rol });
    redirect(volver);
}

export async function cerrarSesion() {
    await borrarSesion();
    redirect("/login");
}
