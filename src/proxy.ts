import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarToken } from "@/lib/session";

/** Rutas que no exigen sesión. */
const PUBLICAS = ["/login", "/menu", "/api/public", "/sin-permiso"];

export async function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return NextResponse.next();
    }

    const token = request.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarToken(token) : null;

    if (!sesion) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = `volver=${encodeURIComponent(pathname + search)}`;
        return NextResponse.redirect(url);
    }

    // Mismo reparto de permisos que SecurityConfig del backend:
    // la caja solo opera POS, clientes y el recibo de una venta.
    const PREFIJOS_ADMIN = [
        "/productos",
        "/insumos",
        "/recetas",
        "/producciones",
        "/gastos",
        "/analisis",
        "/reportes",
        "/usuarios",
        "/configuracion",
    ];
    const soloAdmin =
        PREFIJOS_ADMIN.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
        pathname === "/ventas";
    if (soloAdmin && sesion.rol !== "ADMIN") {
        const url = request.nextUrl.clone();
        url.pathname = "/sin-permiso";
        url.search = "";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?)$).*)"],
};
