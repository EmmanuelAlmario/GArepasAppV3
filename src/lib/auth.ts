import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, verificarToken, type Rol, type Sesion } from "./session";

export const ROLES: Rol[] = ["ADMIN", "VENTAS"];

/** Sesión obligatoria; redirige al login si no hay. */
export async function requireSesion(rutaActual = "/"): Promise<Sesion> {
    const sesion = await leerSesionServidor();
    if (!sesion) redirect(`/login?volver=${encodeURIComponent(rutaActual)}`);
    return sesion;
}

/** Solo ADMIN pasa; VENTAS recibe 403. */
export async function requireAdmin(rutaActual = "/"): Promise<Sesion> {
    const sesion = await requireSesion(rutaActual);
    if (sesion.rol !== "ADMIN") redirect("/sin-permiso");
    return sesion;
}

/** Lectura sin redirect (para layouts que muestran el nombre del usuario). */
export async function leerSesionServidor(): Promise<Sesion | null> {
    const store = await cookies();
    const token = store.get(COOKIE_SESION)?.value;
    return token ? verificarToken(token) : null;
}
