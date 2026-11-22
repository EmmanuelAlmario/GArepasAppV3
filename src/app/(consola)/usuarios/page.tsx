import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import Modal from "@/components/ui/modal";
import FormularioUsuario from "@/components/usuarios/formulario-usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuarios" };

const ETIQUETA_ROL = { ADMIN: "Administrador", VENTAS: "Registrador de ventas" } as const;

export default async function PaginaUsuarios() {
    const sesion = await requireAdmin("/usuarios");

    // Nunca se selecciona la contraseña: el hash no sale del servidor.
    const filas = await db
        .select({
            id: usuarios.id,
            username: usuarios.username,
            rol: usuarios.rol,
            activo: usuarios.activo,
        })
        .from(usuarios)
        .orderBy(asc(usuarios.username));

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        Usuarios
                    </h1>
                    <p className="text-sm text-ink-soft">
                        Administradores y registradores de ventas. Siempre debe quedar un
                        administrador activo.
                    </p>
                </div>
                <Modal
                    etiqueta="Nuevo usuario"
                    titulo="Nuevo usuario"
                    descripcion="Solo el dueño puede crear cuentas."
                    icono={<Plus size={15} />}
                >
                    <FormularioUsuario />
                </Modal>
            </header>

            {filas.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    No hay usuarios registrados. Crea el primero con “Nuevo usuario”.
                </p>
            ) : (
                <div className="card overflow-hidden">
                    <table className="table">
                        <caption className="sr-only">Usuarios del sistema con su rol y estado</caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Usuario</th>
                                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                                    Rol
                                </th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((u) => (
                                <tr key={u.id} className={u.activo ? "" : "opacity-60"}>
                                    <td className="px-4 py-2.5">
                                        <span className="font-medium text-ink">{u.username}</span>
                                        {u.id === sesion.id && (
                                            <span className="badge badge-warning ml-2">
                                                Tú
                                            </span>
                                        )}
                                    </td>
                                    <td className="hidden px-4 py-2.5 text-ink-soft sm:table-cell">
                                        {ETIQUETA_ROL[u.rol]}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs ${
                                                u.activo
                                                    ? "bg-success-tint text-success"
                                                    : "bg-surface-sunken text-ink-soft"
                                            }`}
                                        >
                                            {u.activo ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <Modal
                                            etiqueta="Editar"
                                            titulo="Editar usuario"
                                            ancho="sm"
                                            variante="ghost"
                                            compacto
                                        >
                                            <FormularioUsuario usuario={u} />
                                        </Modal>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
