import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Caveat, Inter } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-bebas",
    display: "swap",
});

const caveat = Caveat({
    weight: "600",
    subsets: ["latin"],
    variable: "--font-caveat",
    display: "swap",
});

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: { default: "Gordo Arepas", template: "%s · Gordo Arepas" },
    description: "Inventario, producción, ventas y reportes de Gordo Arepas.",
    icons: { icon: "/images/favicon.svg" },
};

export const viewport: Viewport = {
    themeColor: "#f6f5f2",
};

/**
 * Aplica el tema antes del primer pintado: sin parpadeo blanco.
 * Claro por defecto; respeta la preferencia del sistema si no hay elección.
 */
const guionTema = `(function(){try{var g=localStorage.getItem('tema');var d=g?g==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="es"
            className={`${bebas.variable} ${caveat.variable} ${inter.variable} h-full antialiased`}
            suppressHydrationWarning
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: guionTema }} />
            </head>
            <body className="min-h-full">{children}</body>
        </html>
    );
}
