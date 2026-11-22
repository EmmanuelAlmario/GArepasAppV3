import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { asc, eq } from "drizzle-orm";
import { ArrowDown, ArrowUpRight, AtSign, MessageCircle } from "lucide-react";
import { db } from "@/db";
import { productos } from "@/db/schema";

export const dynamic = "force-dynamic";

const TELEFONO = "324 678 7743";
const WA = "573246787743";
const WHATSAPP = `https://wa.me/${WA}?text=${encodeURIComponent(
    "Hola, quiero pedir arepas 🫓",
)}`;
const INSTAGRAM = "https://instagram.com/gordo_arepa";

export const metadata: Metadata = {
    title: "Carta · Gordo Arepa",
    description:
        "Arepas de maíz rellenas de queso costeño, papita ripio y proteína. Domicilios en Cartagena por WhatsApp.",
};

const pesos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/**
 * Recorte de la arepa. Se busca primero "arepa" (PNG/WebP con fondo
 * transparente) y luego la foto completa "arepa-hero".
 */
function fotoPortada(): { src: string; recorte: boolean } | null {
    const carpeta = path.join(process.cwd(), "public", "images", "carta");
    const candidatos: Array<[string, string, boolean]> = [
        ["arepa", "webp", true],
        ["arepa", "png", true],
        ["arepa", "avif", true],
        ["arepa-hero", "webp", false],
        ["arepa-hero", "jpg", false],
        ["arepa-hero", "jpeg", false],
        ["arepa-hero", "png", false],
    ];
    for (const [base, ext, recorte] of candidatos) {
        const nombre = `${base}.${ext}`;
        const ruta = path.join(carpeta, nombre);
        if (fs.existsSync(ruta)) {
            /* Versión por fecha: si cambian la foto, cambia la URL. */
            const version = Math.round(fs.statSync(ruta).mtimeMs);
            return { src: `/images/carta/${nombre}?v=${version}`, recorte };
        }
    }
    return null;
}

type Fila = {
    id: number;
    nombre: string;
    categoria: "AREPA" | "CASA" | "BEBIDA";
    descripcion: string | null;
    precio: number;
    disponible: boolean;
};

export default async function PaginaMenu() {
    const filas = await db
        .select({
            id: productos.id,
            nombre: productos.nombre,
            categoria: productos.categoria,
            descripcion: productos.descripcion,
            precio: productos.precioVenta,
            stockActual: productos.stockActual,
            bajoPedido: productos.bajoPedido,
        })
        .from(productos)
        .where(eq(productos.activo, true))
        .orderBy(asc(productos.nombre));

    const carta: Fila[] = filas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        descripcion: p.descripcion,
        precio: Number(p.precio),
        /* Se prepara al momento: no se marca agotada por stock. */
        disponible: Boolean(p.bajoPedido) || p.stockActual > 0,
    }));

    const foto = fotoPortada();
    const arepas = carta.filter((c) => c.categoria === "AREPA");
    const casa = carta.filter((c) => c.categoria === "CASA");
    const bebidas = carta.filter((c) => c.categoria === "BEBIDA");
    const desde = arepas.length ? Math.min(...arepas.map((a) => a.precio)) : 0;

    return (
        <main className="carta-publica pb-20 md:pb-0">
            {/* ---------------- Portada ---------------- */}
            <section className="carta-hero relative flex flex-col pb-20 lg:min-h-[94svh] lg:pb-0">
                {/* Barra superior sobre el fondo */}
                <header className="relative z-20 flex items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:absolute lg:inset-x-0 lg:top-0 lg:px-12">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/images/logo-gordo-arepas.png"
                            alt="Gordo Arepa"
                            width={44}
                            height={40}
                            loading="eager"
                        />
                        <span className="carta-display text-2xl tracking-[0.06em] text-[var(--c-cream)]">
                            Gordo Arepa
                        </span>
                    </div>
                    <a
                        href={WHATSAPP}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--c-ink)_70%,transparent)] px-3 text-sm text-[var(--c-cream)] backdrop-blur-sm"
                    >
                        <MessageCircle size={15} /> Pedir
                    </a>
                </header>

                <div className="relative grid flex-1 lg:grid-cols-[1fr_1.05fr]">
                    {/* Recorte de la arepa: impacta apenas entra */}
                    <div className="relative flex h-[36svh] min-h-56 w-full items-center justify-center overflow-visible lg:order-2 lg:h-auto lg:min-h-[94svh]">
                        {foto ? (
                            foto.recorte ? (
                                <div className="relative aspect-square w-[min(70vw,19rem)] lg:w-[min(38vw,33rem)]">
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-0 rounded-full bg-[var(--c-paper)]"
                                    />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={foto.src}
                                        alt="Arepa Gordo Arepa con queso costeño, pollo, cerdo y salsas"
                                        width={1100}
                                        height={819}
                                        fetchPriority="high"
                                        className="absolute inset-[5%] size-[90%] object-contain drop-shadow-[0_35px_45px_rgba(0,0,0,0.55)]"
                                    />
                                    <span className="absolute -right-3 -bottom-2 z-10 grid size-20 place-items-center rounded-full bg-[var(--c-terra)] text-center text-[var(--c-cream)] shadow-lg lg:-right-6 lg:-bottom-4 lg:size-24">
                                        <span className="carta-display text-lg leading-none lg:text-xl">
                                            100%
                                            <br />
                                            maíz
                                        </span>
                                    </span>
                                </div>
                            ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={foto.src}
                                    alt="Arepa de queso costeño recién hecha en la plancha"
                                    width={950}
                                    height={1188}
                                    fetchPriority="high"
                                    className="absolute inset-0 size-full object-cover object-center"
                                />
                            )
                        ) : (
                            <div className="grid h-full w-full place-items-center bg-[color-mix(in_srgb,var(--c-cream)_8%,var(--c-ink))]">
                                <div className="max-w-[16rem] px-6 text-center">
                                    <Image
                                        src="/images/logo-gordo-arepas.png"
                                        alt=""
                                        width={72}
                                        height={65}
                                        className="mx-auto opacity-80"
                                    />
                                    <p className="carta-kicker mt-3 !text-[var(--c-gold)]">
                                        Aquí va la foto
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-[color-mix(in_srgb,var(--c-cream)_60%,transparent)]">
                                        arepa.png en public/images/carta
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Texto */}
                    <div className="relative z-10 flex flex-col justify-center px-5 py-8 sm:px-8 lg:order-1 lg:px-12 lg:py-24">
                        <p className="carta-kicker !text-[var(--c-gold)]">
                            Cartagena · desde 2023
                        </p>
                        <h1 className="carta-display mt-3 text-[clamp(3.75rem,17vw,8.5rem)] text-[var(--c-cream)]">
                            Arepas
                            <br />
                            rellenas
                        </h1>
                        <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-[var(--c-gold)]">
                            Queso costeño, papita ripio y proteína. Hechas en la plancha cuando
                            pides, no antes.
                        </p>

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <a
                                href={WHATSAPP}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--c-terra)] px-6 text-sm font-medium text-[var(--c-cream)] transition-colors hover:bg-[var(--c-terra-claro)] active:translate-y-px sm:inline-flex sm:w-auto"
                            >
                                <MessageCircle size={16} /> Pedir por WhatsApp
                            </a>
                            <a
                                href="#carta"
                                className="carta-link inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--c-cream)_35%,transparent)] px-5 text-sm text-[var(--c-cream)] sm:w-auto"
                            >
                                Ver la carta <ArrowDown size={15} />
                            </a>
                        </div>

                        <p className="mt-5 text-[0.8125rem] text-[color-mix(in_srgb,var(--c-cream)_65%,transparent)]">
                            desde{" "}
                            <span className="carta-display text-xl text-[var(--c-cream)]">
                                ${pesos.format(desde)}
                            </span>{" "}
                            · domicilios en Cartagena
                        </p>
                    </div>
                </div>

                <div className="relative z-10 px-5 pb-4 sm:px-8 lg:px-12">
                    <div className="carta-linea" />
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[0.75rem] text-[color-mix(in_srgb,var(--c-cream)_70%,transparent)]">
                        <span>{TELEFONO}</span>
                        <a
                            href={INSTAGRAM}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="carta-link inline-flex items-center gap-1.5"
                        >
                            <AtSign size={13} /> @gordo_arepa
                        </a>
                    </div>
                </div>
            </section>

            {/* ---------------- Carta ---------------- */}
            <section id="carta" className="scroll-mt-4 px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--c-ink)] pb-3">
                        <div>
                            <p className="carta-kicker">La carta</p>
                            <h2 className="carta-display mt-1 text-[clamp(2.25rem,5vw,3.5rem)]">
                                Escoge la tuya
                            </h2>
                        </div>
                        <p className="text-[0.75rem] text-[var(--c-muted)]">
                            Precios en pesos · sin recargo
                        </p>
                    </div>

                    <ul className="mt-6 grid gap-x-12 gap-y-6 md:grid-cols-2">
                        {arepas.map((a) => (
                            <li key={a.id} className={a.disponible ? "" : "opacity-55"}>
                                <div className="carta-item">
                                    <h3 className="carta-nombre">
                                        {a.nombre}
                                        {a.nombre === "Gordo Arepa" && (
                                            <span className="ml-2 align-middle text-[0.625rem] font-semibold tracking-[0.14em] text-[var(--c-terra)] uppercase">
                                                la de la casa
                                            </span>
                                        )}
                                    </h3>
                                    <span className="carta-leader" />
                                    <span
                                        className={`carta-precio ${
                                            a.nombre === "Gordo Arepa" ? "text-[var(--c-terra)]" : ""
                                        }`}
                                    >
                                        ${pesos.format(a.precio)}
                                    </span>
                                </div>
                                <p className="mt-1 max-w-[46ch] text-[0.8125rem] leading-relaxed text-[var(--c-muted)]">
                                    {a.descripcion}
                                    {!a.disponible && (
                                        <span className="ml-1 font-medium text-[var(--c-terra)]">
                                            · agotada hoy
                                        </span>
                                    )}
                                </p>
                            </li>
                        ))}
                    </ul>

                    {/* Para hacer en casa */}
                    {casa.length > 0 && (
                        <div className="mt-10 grid gap-6 bg-[var(--c-ink)] px-6 py-8 text-[var(--c-cream)] sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                            <div>
                                <p className="carta-kicker !text-[var(--c-gold)]">Para hacer en casa</p>
                                <h3 className="carta-display mt-2 text-[clamp(2rem,4vw,3rem)]">
                                    Llévatelas
                                    <br />
                                    y plancha
                                </h3>
                                <p className="mt-3 max-w-sm text-[0.8125rem] leading-relaxed text-[color-mix(in_srgb,var(--c-cream)_72%,transparent)]">
                                    Masa de maíz y queso costeño listos para tu cocina. Se conservan
                                    en nevera y se hacen en la plancha en cinco minutos.
                                </p>
                            </div>
                            <ul className="grid gap-3">
                                {casa.map((c) => (
                                    <li key={c.id} className="flex items-baseline gap-4 border-t border-[color-mix(in_srgb,var(--c-cream)_20%,transparent)] pt-3">
                                        <span className="carta-display text-2xl">{c.nombre}</span>
                                        <span className="flex-1 border-b border-dotted border-[color-mix(in_srgb,var(--c-cream)_30%,transparent)]" />
                                        <span className="carta-display text-2xl tabular-nums">
                                            ${pesos.format(c.precio)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Bebidas */}
                    {bebidas.length > 0 && (
                        <div className="mt-8">
                            <p className="carta-kicker">Bebidas</p>
                            <ul className="mt-2 flex flex-wrap gap-x-10 gap-y-2 border-y border-[var(--c-line)] py-3">
                                {bebidas.map((b) => (
                                    <li key={b.id} className="flex items-baseline gap-2">
                                        <span className="text-[0.875rem] text-[var(--c-ink)]">
                                            {b.nombre}
                                        </span>
                                        <span className="carta-display text-lg text-[var(--c-terra)] tabular-nums">
                                            ${pesos.format(b.precio)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </section>

            {/* ---------------- Cómo pedir ---------------- */}
            <section className="bg-[var(--c-paper-2)] px-5 py-12 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-6xl">
                    <p className="carta-kicker">Cómo pedir</p>
                    <h2 className="carta-display mt-1 text-[clamp(2.25rem,5vw,3.5rem)]">
                        Tres pasos
                    </h2>

                    <ol className="mt-8 grid gap-8 border-t border-[var(--c-line)] pt-8 md:grid-cols-3">
                        <li>
                            <span className="carta-paso-num">01</span>
                            <h3 className="carta-display mt-2 text-2xl">Escoge</h3>
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--c-muted)]">
                                Mira la carta y decide. Si quieres combinar, la Mixta y la Gordo
                                Arepa traen de todo.
                            </p>
                        </li>
                        <li>
                            <span className="carta-paso-num">02</span>
                            <h3 className="carta-display mt-2 text-2xl">Escribe</h3>
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--c-muted)]">
                                Manda el pedido por WhatsApp con tu nombre y la dirección. Te
                                confirmamos el valor y el tiempo.
                            </p>
                        </li>
                        <li>
                            <span className="carta-paso-num">03</span>
                            <h3 className="carta-display mt-2 text-2xl">Recibe</h3>
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--c-muted)]">
                                Domicilio en Cartagena o recoges en el carrito. Pago en efectivo o
                                transferencia.
                            </p>
                        </li>
                    </ol>
                </div>
            </section>

            {/* ---------------- Cierre ---------------- */}
            <section className="carta-hero px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
                <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-8">
                    <div>
                        <p className="carta-kicker !text-[var(--c-gold)]">Pide ahora</p>
                        <a
                            href={WHATSAPP}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="carta-display mt-2 block text-[clamp(2.5rem,7vw,5.5rem)] text-[var(--c-cream)] transition-colors hover:text-[var(--c-gold)]"
                        >
                            {TELEFONO}
                        </a>
                        <p className="mt-3 text-[0.8125rem] text-[color-mix(in_srgb,var(--c-cream)_70%,transparent)]">
                            Domicilios en Cartagena · horario del carrito en Instagram
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <a
                            href={WHATSAPP}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--c-terra)] px-6 text-sm font-medium text-[var(--c-cream)] transition-colors hover:bg-[var(--c-terra-claro)]"
                        >
                            <MessageCircle size={16} /> WhatsApp
                        </a>
                        <a
                            href={INSTAGRAM}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--c-cream)_35%,transparent)] px-5 text-sm text-[var(--c-cream)]"
                        >
                            <AtSign size={15} /> @gordo_arepa
                            <ArrowUpRight size={14} />
                        </a>
                    </div>
                </div>

                <div className="mx-auto mt-10 max-w-6xl">
                    <div className="carta-linea" />
                    <p className="pt-3 text-[0.6875rem] tracking-[0.16em] text-[color-mix(in_srgb,var(--c-cream)_55%,transparent)] uppercase">
                        Gordo Arepa · Garepas Management SAS · Cartagena
                    </p>
                </div>
            </section>

            {/* Barra de pedido en móvil */}
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--c-line)] bg-[var(--c-paper)] px-4 py-2.5 md:hidden">
                <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--c-terra)] text-sm font-medium text-[var(--c-cream)]"
                >
                    <MessageCircle size={16} /> Pedir por WhatsApp · {TELEFONO}
                </a>
            </div>
        </main>
    );
}
