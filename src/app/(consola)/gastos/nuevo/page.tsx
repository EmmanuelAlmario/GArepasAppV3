import { requireSesion } from "@/lib/auth";
import FormularioGasto from "@/components/gastos/formulario-gasto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registrar gasto" };

export default async function PaginaNuevoGasto() {
    await requireSesion("/gastos");

    return (
        <div className="page">
            <h1 className="page-title">
                Registrar gasto
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
                Servicios, transporte, equipamiento u otros gastos operativos.
            </p>
            <FormularioGasto />
        </div>
    );
}
