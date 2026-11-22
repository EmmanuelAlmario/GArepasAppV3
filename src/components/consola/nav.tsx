"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BookOpen,
    ChefHat,
    ClipboardList,
    Home,
    LineChart,
    Package,
    Receipt,
    Settings,
    ShoppingCart,
    Users,
    Wallet,
    Wheat,
} from "lucide-react";
import type { Rol } from "@/lib/session";

type Item = {
    href: string;
    label: string;
    icono: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    admin?: boolean;
};

type Grupo = { titulo: string | null; items: Item[] };

const GRUPOS: Grupo[] = [
    { titulo: null, items: [{ href: "/", label: "Inicio", icono: Home }] },
    {
        titulo: "Caja",
        items: [
            { href: "/pos", label: "Punto de venta", icono: ShoppingCart },
            { href: "/ventas", label: "Ventas", icono: Receipt, admin: true },
        ],
    },
    {
        titulo: "Producción",
        items: [
            { href: "/producciones", label: "Producciones", icono: ChefHat, admin: true },
            { href: "/gastos", label: "Gastos", icono: Wallet, admin: true },
        ],
    },
    {
        titulo: "Catálogo",
        items: [
            { href: "/productos", label: "Productos", icono: Package, admin: true },
            { href: "/recetas", label: "Recetas", icono: BookOpen, admin: true },
            { href: "/insumos", label: "Insumos", icono: Wheat, admin: true },
        ],
    },
    {
        titulo: "Cartera",
        items: [{ href: "/clientes", label: "Clientes", icono: Users }],
    },
    {
        titulo: "Análisis",
        items: [
            { href: "/analisis", label: "Análisis", icono: LineChart, admin: true },
            { href: "/reportes", label: "Reportes", icono: ClipboardList, admin: true },
        ],
    },
    {
        titulo: "Administración",
        items: [
            { href: "/usuarios", label: "Usuarios", icono: Users, admin: true },
            { href: "/configuracion", label: "Configuración", icono: Settings, admin: true },
        ],
    },
];

export default function Nav({ rol, movil = false }: { rol: Rol; movil?: boolean }) {
    const pathname = usePathname();
    const esActivo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    return (
        <nav aria-label="Menú principal" data-tour="menu" className={movil ? "grid gap-4 p-4" : "grid gap-5 px-3 pb-6"}>
            {GRUPOS.map((grupo, indice) => {
                const items = grupo.items.filter((i) => !i.admin || rol === "ADMIN");
                if (items.length === 0) return null;

                return (
                    <div key={grupo.titulo ?? `g${indice}`} className="grid gap-1">
                        {grupo.titulo && (
                            <p className="section-label px-2">{grupo.titulo}</p>
                        )}
                        {items.map(({ href, label, icono: Icono }) => {
                            const activo = esActivo(href);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    aria-current={activo ? "page" : undefined}
                                    className={[
                                        "flex min-h-9 items-center gap-2.5 rounded-md px-2 text-[0.8125rem] transition-colors",
                                        activo
                                            ? "bg-accent-tint font-medium text-accent-strong"
                                            : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                                    ].join(" ")}
                                >
                                    <Icono size={16} strokeWidth={activo ? 2.2 : 1.8} />
                                    <span>{label}</span>
                                </Link>
                            );
                        })}
                    </div>
                );
            })}
        </nav>
    );
}
