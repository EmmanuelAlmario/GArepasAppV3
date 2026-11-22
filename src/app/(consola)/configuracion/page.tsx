import { asc } from "drizzle-orm";
import { db } from "@/db";
import { configuracionNegocio } from "@/db/schema";
import FormularioConfiguracion from "@/components/configuracion/formulario-configuracion";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi negocio" };

/* Espejo de ConfiguracionNegocioService.porDefecto(): si aún no hay fila,
 * el formulario muestra estos valores y se insertan al guardar. */
const POR_DEFECTO = {
    nombreComercial: "Gordo Arepas",
    identificacionFiscal: null,
    telefono: null,
    direccion: null,
    impuestoPorcentaje: 0,
    comisionAppPct: 0,
    objetivoFoodCost: 35,
    metaTicket: 25000,
    mensajeRecibo: "Gracias por tu compra. Te esperamos pronto.",
    logoUrl: "/images/logo-gordo-arepas.png",
};

export default async function PaginaConfiguracion({
    searchParams,
}: {
    searchParams: Promise<{ guardado?: string }>;
}) {
    await requireAdmin("/configuracion");
    const { guardado } = await searchParams;

    const [fila] = await db
        .select({
            nombreComercial: configuracionNegocio.nombreComercial,
            identificacionFiscal: configuracionNegocio.identificacionFiscal,
            telefono: configuracionNegocio.telefono,
            direccion: configuracionNegocio.direccion,
            impuestoPorcentaje: configuracionNegocio.impuestoPorcentaje,
            comisionAppPct: configuracionNegocio.comisionAppPct,
            objetivoFoodCost: configuracionNegocio.objetivoFoodCost,
            metaTicket: configuracionNegocio.metaTicket,
            mensajeRecibo: configuracionNegocio.mensajeRecibo,
            logoUrl: configuracionNegocio.logoUrl,
        })
        .from(configuracionNegocio)
        .orderBy(asc(configuracionNegocio.id))
        .limit(1);

    return (
        <div className="page">
            <header className="mb-5">
                <h1 className="page-title">
                    Mi negocio
                </h1>
                <p className="text-sm text-ink-soft">
                    Estos datos aparecen en el punto de venta y en el recibo.
                </p>
            </header>

            {guardado === "1" && (
                <p
                    role="status"
                    className="mb-4 rounded-lg bg-success-tint px-3 py-2 text-sm text-success"
                >
                    Configuración guardada.
                </p>
            )}

            <div className="card p-4 sm:p-6">
                <FormularioConfiguracion config={fila ?? POR_DEFECTO} />
            </div>
        </div>
    );
}
