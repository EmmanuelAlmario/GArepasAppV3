import FormularioCliente from "@/components/clientes/formulario-cliente";
import { requireSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo cliente" };

export default async function PaginaNuevoCliente() {
    await requireSesion("/clientes/nuevo");

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="page-title">Nuevo cliente</h1>
            <p className="mb-6 text-sm text-ink-soft">
                Regístralo para poder fiarle o llevar su estado de cuenta.
            </p>
            <FormularioCliente />
        </div>
    );
}
