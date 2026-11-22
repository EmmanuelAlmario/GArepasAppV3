import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import FormularioUsuario from "@/components/usuarios/formulario-usuario";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar usuario" };

export default async function PaginaEditarUsuario({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireAdmin("/usuarios");
    const { id } = await params;
    const numero = Number(id);
    if (!Number.isInteger(numero)) notFound();

    const [usuario] = await db
        .select({
            id: usuarios.id,
            username: usuarios.username,
            rol: usuarios.rol,
            activo: usuarios.activo,
        })
        .from(usuarios)
        .where(eq(usuarios.id, numero))
        .limit(1);

    if (!usuario) notFound();

    return (
        <div className="page">
            <h1 className="page-title">
                Editar usuario
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
                {usuario.username} · deja la contraseña vacía para conservarla.
            </p>
            <FormularioUsuario usuario={usuario} />
        </div>
    );
}
