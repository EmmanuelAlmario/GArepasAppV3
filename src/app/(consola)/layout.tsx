import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/consola/nav";
import EnVivo from "@/components/consola/en-vivo";
import TemaBoton from "@/components/consola/tema-boton";
import Tour from "@/components/guia/tour";
import { cerrarSesion } from "@/app/actions/auth";
import { requireSesion } from "@/lib/auth";

export default async function LayoutConsola({ children }: { children: React.ReactNode }) {
    const sesion = await requireSesion("/");

    return (
        <div className="min-h-dvh lg:grid lg:grid-cols-[14.5rem_1fr]">
            {/* Barra lateral (escritorio): navegación agrupada por tarea. */}
            <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
                <Link
                    href="/"
                    className="flex items-center gap-2.5 border-b border-line px-4 py-3.5"
                >
                    <Image
                        src="/images/logo-gordo-arepas.png"
                        alt=""
                        width={30}
                        height={28}
                    />
                    <span className="font-display text-lg leading-none tracking-[0.06em] text-ink">
                        GORDO AREPAS
                    </span>
                </Link>

                <div className="min-h-0 flex-1 overflow-y-auto py-4">
                    <Nav rol={sesion.rol} />
                </div>

                <div className="border-t border-line px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="truncate text-[0.8125rem] font-medium text-ink">
                                {sesion.username}
                            </p>
                            <p className="text-[0.6875rem] text-ink-faint">
                                {sesion.rol === "ADMIN" ? "Administrador" : "Caja"}
                            </p>
                            <div className="mt-1">
                                <EnVivo />
                            </div>
                        </div>
                        <form action={cerrarSesion}>
                            <button type="submit" className="btn btn-ghost btn-sm">
                                Salir
                            </button>
                        </form>
                    </div>
                    <div className="mt-2">
                        <TemaBoton />
                    </div>
                </div>
            </aside>

            <div className="flex min-w-0 flex-col">
                {/* Barra superior (móvil): misma jerarquía, en un desplegable nativo. */}
                <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                        <Link href="/" className="flex items-center gap-2">
                            <Image src="/images/logo-gordo-arepas.png" alt="" width={24} height={22} />
                            <span className="font-display text-base leading-none tracking-[0.06em]">
                                GORDO AREPAS
                            </span>
                        </Link>

                        <div className="flex items-center gap-1">
                            <form action={cerrarSesion}>
                                <button type="submit" className="btn btn-ghost btn-sm">
                                    Salir
                                </button>
                            </form>
                            <TemaBoton compacto />
                            <details className="group relative">
                                <summary className="btn btn-secondary btn-sm cursor-pointer list-none">
                                    Menú
                                </summary>
                                <div className="absolute right-0 z-30 mt-2 max-h-[70dvh] w-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
                                    <Nav rol={sesion.rol} movil />
                                </div>
                            </details>
                        </div>
                    </div>
                </header>

                <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
            </div>

            <Tour />
        </div>
    );
}
