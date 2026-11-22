import FormularioUsuario from "@/components/usuarios/formulario-usuario";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo usuario" };

export default async function PaginaNuevoUsuario() {
    await requireAdmin("/usuarios");

    return (
        <div className="page">
            <h1 className="page-title">
                Nuevo usuario
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
                La contraseña se guarda cifrada con bcrypt y nunca se vuelve a mostrar.
            </p>
            <FormularioUsuario />
        </div>
    );
}
