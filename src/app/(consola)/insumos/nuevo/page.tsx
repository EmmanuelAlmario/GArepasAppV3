import FormularioInsumo from "@/components/insumos/formulario-insumo";
import { requireSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo insumo" };

export default async function PaginaNuevoInsumo() {
    await requireSesion("/insumos");

    return (
        <div className="page">
            <h1 className="page-title">
                Nuevo insumo
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
                El stock y el precio se ingresan en la unidad con la que compras; el sistema los
                convierte a gramo, mililitro o unidad.
            </p>
            <FormularioInsumo />
        </div>
    );
}
