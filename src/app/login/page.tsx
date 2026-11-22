import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import FormularioLogin from "./formulario-login";
import FondoSilk from "@/components/login/fondo-silk";
import SpotlightCard from "@/components/SpotlightCard";
import ClickSpark from "@/components/reactbits/ClickSpark";
import ShinyText from "@/components/reactbits/ShinyText";
import { leerSesionServidor } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({
    searchParams,
}: {
    searchParams: Promise<{ volver?: string }>;
}) {
    const sesion = await leerSesionServidor();
    if (sesion) redirect("/");

    const { volver } = await searchParams;

    return (
        <main className="relative min-h-dvh overflow-hidden bg-[#120e0b] text-[#f4ece2]">
            <FondoSilk />
            <div aria-hidden="true" className="login-vineta pointer-events-none absolute inset-0" />

            <div className="relative z-10 mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-16">
                {/* ---------- Marca ---------- */}
                <section className="max-w-xl">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/images/logo-gordo-arepas.png"
                            alt=""
                            width={52}
                            height={48}
                            priority
                            className="drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
                        />
                        <p className="pizarra-kicker !text-[#e9c9a0]">Garepas Management SAS</p>
                    </div>

                    <h1 className="login-titulo">
                        GORDO
                        <br />
                        AREPA
                    </h1>

                    <p className="mt-4 text-xl">
                        <ShinyText
                            text="arepas artesanales · Cartagena"
                            color="#c9b6a3"
                            shineColor="#fdf7ee"
                            speed={4}
                            spread={110}
                        />
                    </p>

                    <div className="mt-8 max-w-md border-y border-[#f6efe6]/20 py-3">
                        <p className="text-[0.8125rem] leading-relaxed text-[#d9c8b8]">
                            La consola donde se cuadra la caja, se descuenta la producción y se
                            deciden los precios. El cliente pide por WhatsApp; aquí se responde con
                            números.
                        </p>
                    </div>

                    <dl className="mt-6 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 text-[0.6875rem] tracking-[0.16em] uppercase">
                        {["Caja y arqueo", "Producción", "Inventario", "Márgenes"].map((tema) => (
                            <div key={tema} className="flex items-center gap-2 text-[#c9b6a3]">
                                <span className="size-1 rounded-full bg-[#e2703a]" />
                                {tema}
                            </div>
                        ))}
                    </dl>
                </section>

                {/* ---------- Acceso ---------- */}
                <section className="tema-login w-full max-w-sm justify-self-start lg:justify-self-end">
                    <SpotlightCard
                        theme="dark"
                        intensity={0.4}
                        spotlightColor="#e2703a"
                        spotlightSize={320}
                        softness={0.9}
                        borderGlow={0.6}
                        proximity={60}
                        smoothing={0.35}
                        className="!rounded-xl !p-6 shadow-2xl backdrop-blur-md"
                        style={
                            {
                                "--spotlight-card-surface": "rgba(28, 23, 20, 0.86)",
                                "--spotlight-card-border": "rgba(246, 239, 230, 0.15)",
                                "--spotlight-card-shadow": "none",
                            } as React.CSSProperties
                        }
                    >
                        <div className="mb-5 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">
                                    Entrar a la consola
                                </h2>
                                <p className="mt-0.5 text-xs text-ink-soft">
                                    Usuario asignado por el dueño del negocio.
                                </p>
                            </div>
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-tint text-accent-strong">
                                <ShieldCheck size={15} />
                            </span>
                        </div>

                        <ClickSpark
                            sparkColor="#f08a55"
                            sparkSize={8}
                            sparkRadius={16}
                            sparkCount={8}
                            duration={420}
                            easing="ease-out"
                        >
                            <FormularioLogin volver={volver ?? "/"} />
                        </ClickSpark>

                        <div className="mt-5 flex items-center justify-between border-t border-[#f6efe6]/10 pt-3 text-[10px] tracking-[0.14em] text-[#94897c] uppercase">
                            <span>Acceso restringido</span>
                            <Link href="/menu" className="text-[#c9b6a3] hover:text-[#f4ece2]">
                                Ver carta pública
                            </Link>
                        </div>
                    </SpotlightCard>

                    <p className="mt-5 text-center text-[10px] tracking-[0.16em] text-[#94897c] uppercase">
                        Garepas Management SAS · Cartagena
                    </p>
                </section>
            </div>
        </main>
    );
}
