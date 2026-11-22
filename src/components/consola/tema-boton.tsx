"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Tema = "light" | "dark";

/** Alterna entre el tema claro de la consola y el oscuro (cacao). */
export default function TemaBoton({ compacto = false }: { compacto?: boolean }) {
    const [tema, setTema] = useState<Tema>("light");

    useEffect(() => {
        setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    }, []);

    function alternar() {
        const nuevo: Tema = tema === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = nuevo;
        try {
            localStorage.setItem("tema", nuevo);
        } catch {
            /* modo privado: solo dura la sesión */
        }
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", nuevo === "dark" ? "#17130f" : "#f6f5f2");
        setTema(nuevo);
    }

    const esOscuro = tema === "dark";

    return (
        <button
            type="button"
            onClick={alternar}
            aria-pressed={esOscuro}
            aria-label={esOscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={esOscuro ? "Tema claro" : "Tema oscuro"}
            className={compacto ? "btn btn-ghost btn-sm" : "btn btn-ghost btn-sm w-full justify-start"}
        >
            {esOscuro ? <Sun size={15} /> : <Moon size={15} />}
            {!compacto && <span>{esOscuro ? "Tema claro" : "Tema oscuro"}</span>}
        </button>
    );
}
