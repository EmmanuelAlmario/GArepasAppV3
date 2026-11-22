"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Estado = "conectando" | "vivo" | "sin-conexion";

/** Un formulario abierto tiene prioridad: no se refresca bajo los pies. */
function ocupado() {
    return Boolean(document.querySelector("dialog[open]"));
}

/**
 * Actualizaciones en vivo: Postgres avisa cada cambio (NOTIFY) y el stream
 * SSE lo trae hasta acá. Todo lo que se ve en pantalla se vuelve a pedir al
 * servidor, sin recargar la página ni perder el estado de los componentes.
 */
export default function EnVivo() {
    const router = useRouter();
    const [estado, setEstado] = useState<Estado>("conectando");
    const pendiente = useRef(false);
    const ultimo = useRef(0);

    useEffect(() => {
        let cerrado = false;
        let temporizador: ReturnType<typeof setTimeout> | undefined;
        let fuente: EventSource | undefined;

        const refrescar = () => {
            if (ocupado()) {
                pendiente.current = true;
                return;
            }
            const ahora = Date.now();
            // Nunca más de un refresh cada 600 ms.
            if (ahora - ultimo.current < 600) return;
            ultimo.current = ahora;
            router.refresh();
        };

        const programar = () => {
            clearTimeout(temporizador);
            temporizador = setTimeout(refrescar, 250);
        };

        const conectar = () => {
            fuente = new EventSource("/api/eventos");

            fuente.onopen = () => !cerrado && setEstado("vivo");
            fuente.onmessage = () => {
                if (cerrado) return;
                setEstado("vivo");
                programar();
            };
            fuente.onerror = () => {
                if (cerrado) return;
                setEstado("sin-conexion");
                // EventSource reintenta solo; el intervalo de abajo cubre caídas largas.
            };
        };

        conectar();

        // Respaldo: si el stream no está disponible, revisa cada 30 s.
        const respaldo = setInterval(() => {
            if (document.visibilityState === "visible" && estado === "sin-conexion") refrescar();
        }, 30_000);

        const alVolver = () => {
            if (document.visibilityState === "visible") refrescar();
        };

        // Al cerrar un diálogo se aplica el cambio que quedó en espera.
        const alCerrarDialogo = () => {
            if (pendiente.current) {
                pendiente.current = false;
                refrescar();
            }
        };

        document.addEventListener("visibilitychange", alVolver);
        window.addEventListener("focus", alVolver);
        document.addEventListener("close", alCerrarDialogo, true);

        return () => {
            cerrado = true;
            clearTimeout(temporizador);
            clearInterval(respaldo);
            fuente?.close();
            document.removeEventListener("visibilitychange", alVolver);
            window.removeEventListener("focus", alVolver);
            document.removeEventListener("close", alCerrarDialogo, true);
        };
        // El estado solo se usa para el respaldo; reconectar cambiaría el stream.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    return (
        <span
            className="inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-faint"
            title={
                estado === "vivo"
                    ? "Conectado: los cambios se ven al instante"
                    : estado === "conectando"
                      ? "Conectando…"
                      : "Sin conexión en vivo: revisa cada 30 s"
            }
        >
            <span
                aria-hidden="true"
                className={[
                    "size-1.5 rounded-full",
                    estado === "vivo"
                        ? "bg-success"
                        : estado === "conectando"
                          ? "bg-warning"
                          : "bg-danger",
                ].join(" ")}
            />
            {estado === "vivo" ? "En vivo" : estado === "conectando" ? "Conectando" : "Sin vivo"}
        </span>
    );
}
