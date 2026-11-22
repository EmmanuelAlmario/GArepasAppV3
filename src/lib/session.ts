import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const COOKIE_SESION = "ga_sesion";

export type Rol = "ADMIN" | "VENTAS";

export type Sesion = {
    id: number;
    username: string;
    rol: Rol;
};

function secreto() {
    const valor = process.env.AUTH_SECRET;
    if (!valor || valor.length < 32) {
        throw new Error("AUTH_SECRET debe existir y tener al menos 32 caracteres");
    }
    return new TextEncoder().encode(valor);
}

export async function firmarSesion(sesion: Sesion): Promise<string> {
    return new SignJWT({ username: sesion.username, rol: sesion.rol })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(sesion.id))
        .setIssuedAt()
        .setExpirationTime("12h")
        .sign(secreto());
}

export async function verificarToken(token: string): Promise<Sesion | null> {
    try {
        const { payload } = await jwtVerify(token, secreto());
        if (!payload.sub) return null;
        return {
            id: Number(payload.sub),
            username: String(payload.username),
            rol: payload.rol === "ADMIN" ? "ADMIN" : "VENTAS",
        };
    } catch {
        return null;
    }
}

/** Sesión del request actual (server components, actions y route handlers). */
export async function leerSesion(): Promise<Sesion | null> {
    const store = await cookies();
    const token = store.get(COOKIE_SESION)?.value;
    return token ? verificarToken(token) : null;
}

export async function guardarSesion(sesion: Sesion) {
    const token = await firmarSesion(sesion);
    const store = await cookies();
    store.set(COOKIE_SESION, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12,
    });
}

export async function borrarSesion() {
    const store = await cookies();
    store.delete(COOKIE_SESION);
}
