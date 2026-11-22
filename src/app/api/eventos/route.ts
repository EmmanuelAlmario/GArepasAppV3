import postgres from "postgres";
import { asegurarTiempoReal } from "@/db/tiempo-real";
import { leerSesion } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Stream de cambios (SSE). El navegador lo abre una vez y cada NOTIFY de
 * Postgres se traduce en un mensaje; el cliente decide qué refrescar.
 */
export async function GET() {
    const sesion = await leerSesion();
    if (!sesion) return new Response("No autorizado", { status: 401 });

    await asegurarTiempoReal();

    const encoder = new TextEncoder();
    let cerrar: (() => void) | undefined;

    const stream = new ReadableStream({
        async start(controller) {
            const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
            let vivo = true;

            const enviar = (datos: string) => {
                if (!vivo) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${datos}\n\n`));
                } catch {
                    vivo = false;
                }
            };

            enviar("conectado");

            // Latido para que proxies no corten la conexión inactiva.
            const latido = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": latido\n\n"));
                } catch {
                    vivo = false;
                }
            }, 25_000);

            const suscripcion = await sql.listen("garepas", (payload) => {
                enviar(payload ?? "cambio");
            });

            cerrar = () => {
                if (!vivo) return;
                vivo = false;
                clearInterval(latido);
                void suscripcion.unlisten();
                void sql.end({ timeout: 5 });
                try {
                    controller.close();
                } catch {
                    /* ya cerrado */
                }
            };
        },
        cancel() {
            cerrar?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
