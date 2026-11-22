"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { esDuplicado } from "@/lib/db-errores";

export type EstadoUsuario = { error?: string; campos?: Record<string, string> };



export async function guardarUsuario(
    _estado: EstadoUsuario,
    formData: FormData,
): Promise<EstadoUsuario> {
    const sesion = await requireAdmin("/usuarios");

    const idCrudo = String(formData.get("id") ?? "").trim();
    const id = idCrudo === "" ? null : Number(idCrudo);
    if (id !== null && !Number.isInteger(id)) return { error: "Usuario inválido." };

    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const rolCrudo = String(formData.get("rol") ?? "");
    const activo = formData.get("activo") !== null;

    const campos: Record<string, string> = {};
    if (username.length < 3 || username.length > 50) {
        campos.username = "El usuario debe tener entre 3 y 50 caracteres.";
    }
    if (id === null && password === "") {
        campos.password = "La contraseña es obligatoria para crear un usuario.";
    } else if (password !== "" && password.length < 6) {
        campos.password = "La contraseña debe tener al menos 6 caracteres.";
    } else if (password.length > 100) {
        campos.password = "La contraseña no puede superar 100 caracteres.";
    }
    if (rolCrudo !== "ADMIN" && rolCrudo !== "VENTAS") {
        campos.rol = "Elige un rol válido.";
    }
    if (Object.keys(campos).length > 0) {
        return { error: "Revisa los campos marcados.", campos };
    }
    const rol = rolCrudo as "ADMIN" | "VENTAS";

    // Username único sin distinguir mayúsculas (espejo de existsByUsernameIgnoreCase).
    const [repetido] = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(
            and(
                sql`lower(${usuarios.username}) = ${username.toLowerCase()}`,
                id !== null ? ne(usuarios.id, id) : undefined,
            ),
        )
        .limit(1);
    if (repetido) {
        return { error: "Ya existe un usuario con ese nombre.", campos: { username: "Nombre repetido" } };
    }

    const hash = password === "" ? null : await bcrypt.hash(password, 10);

    try {
        if (id === null) {
            await db.insert(usuarios).values({ username, password: hash!, rol, activo });
        } else {
            const [actual] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
            if (!actual) return { error: "El usuario ya no existe." };

            const eraAdminActivo = actual.rol === "ADMIN" && actual.activo;
            const dejaDeSerAdminActivo = rol !== "ADMIN" || !activo;

            if (id === sesion.id && dejaDeSerAdminActivo) {
                return {
                    error: "No puedes desactivar tu propio usuario ni quitarte el rol de administrador.",
                };
            }

            if (eraAdminActivo && dejaDeSerAdminActivo) {
                const [{ n }] = await db
                    .select({ n: sql<number>`count(*)::int` })
                    .from(usuarios)
                    .where(and(eq(usuarios.rol, "ADMIN"), eq(usuarios.activo, true)));
                if (n <= 1) {
                    return { error: "Debe quedar al menos un administrador activo en el sistema." };
                }
            }

            await db
                .update(usuarios)
                .set({ username, rol, activo, ...(hash ? { password: hash } : {}) })
                .where(eq(usuarios.id, id));
        }
    } catch (error) {
        if (esDuplicado(error)) {
            return { error: "Ya existe un usuario con ese nombre.", campos: { username: "Nombre repetido" } };
        }
        return {
            error: error instanceof Error ? error.message : "No se pudo guardar el usuario.",
        };
    }

    revalidatePath("/usuarios");
    redirect("/usuarios");
}
