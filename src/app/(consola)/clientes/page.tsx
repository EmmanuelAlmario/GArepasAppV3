import Link from "next/link";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { clientes, ventas } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import Modal from "@/components/ui/modal";
import FormularioCliente from "@/components/clientes/formulario-cliente";
import ModalConfirmar from "@/components/ui/modal-confirmar";
import { money } from "@/lib/format";
import { round2 } from "@/lib/num";
import { eliminarCliente } from "@/app/actions/clientes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

export default async function PaginaClientes() {
    await requireSesion("/clientes");

    const [cartera, saldos] = await Promise.all([
        db
            .select({
                id: clientes.id,
                nombre: clientes.nombre,
                telefono: clientes.telefono,
                direccion: clientes.direccion,
                notas: clientes.notas,
                activo: clientes.activo,
            })
            .from(clientes)
            .orderBy(asc(clientes.nombre)),
        db
            .select({
                clienteId: ventas.clienteId,
                saldo: sql<string>`coalesce(sum(${ventas.saldo}), 0)`,
            })
            .from(ventas)
            .where(and(eq(ventas.estado, "ACTIVA"), gt(ventas.saldo, 0), isNotNull(ventas.clienteId)))
            .groupBy(ventas.clienteId),
    ]);

    const porCliente = new Map(
        saldos.map((s) => [Number(s.clienteId), Number(s.saldo)] as const),
    );
    const totalPorCobrar = round2(
        saldos.reduce((suma, s) => suma + Number(s.saldo), 0),
    );
    const conSaldo = saldos.filter((s) => Number(s.saldo) > 0).length;

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Clientes</h1>
                    <p className="text-sm text-ink-soft">
                        Clientes que fían o que compran con regularidad.
                    </p>
                </div>
                <Modal
                    etiqueta="Nuevo cliente"
                    titulo="Nuevo cliente"
                    descripcion="Para fiar o dejar registro del cobro."
                    icono={<Plus size={15} />}
                >
                    <FormularioCliente />
                </Modal>
            </header>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="card p-4">
                    <p className="text-xs tracking-wide text-ink-soft uppercase">Total por cobrar</p>
                    <p className="mt-1 text-3xl text-accent tabular-nums">
                        {money(totalPorCobrar)}
                    </p>
                    <p className="text-xs text-ink-faint">Suma de los saldos pendientes</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs tracking-wide text-ink-soft uppercase">Clientes</p>
                    <p className="mt-1 text-3xl text-ink">
                        {cartera.length}
                    </p>
                    <p className="text-xs text-ink-faint">Registrados en el negocio</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs tracking-wide text-ink-soft uppercase">Con saldo pendiente</p>
                    <p className="mt-1 text-3xl text-ink">
                        {conSaldo}
                    </p>
                    <p className="text-xs text-ink-faint">Clientes con deuda por cobrar</p>
                </div>
            </div>

            {cartera.length === 0 ? (
                <p className="card p-8 text-center text-sm text-ink-faint">
                    No hay clientes registrados. Crea uno para poder fiar o llevar su estado de cuenta.
                </p>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="table">
                        <caption className="sr-only">
                            Clientes del negocio con su saldo pendiente y estado
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Nombre</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Dirección</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Saldo</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cartera.map((c) => {
                                const saldo = porCliente.get(c.id) ?? 0;
                                return (
                                    <tr key={c.id} className={c.activo ? "" : "opacity-60"}>
                                        <td className="px-4 py-2.5">
                                            <Link
                                                href={`/clientes/${c.id}`}
                                                className="font-medium text-ink hover:text-accent hover:underline"
                                            >
                                                {c.nombre}
                                            </Link>
                                            {c.telefono && (
                                                <div className="text-xs text-ink-faint">{c.telefono}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-ink-soft">
                                            {c.direccion ?? "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            <span
                                                className={
                                                    saldo > 0
                                                        ? "font-medium text-accent"
                                                        : "text-ink-faint"
                                                }
                                            >
                                                {money(saldo)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    c.activo
                                                        ? "bg-success-tint text-success"
                                                        : "bg-surface-sunken text-ink-soft"
                                                }`}
                                            >
                                                {c.activo ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/clientes/${c.id}`}
                                                    className="btn btn-ghost btn-sm text-accent"
                                                >
                                                    Ver
                                                </Link>
                                                <Modal
                                                    etiqueta="Editar"
                                                    titulo="Editar cliente"
                                                    ancho="sm"
                                                    variante="ghost"
                                                    compacto
                                                >
                                                    <FormularioCliente
                                                        cliente={{
                                                            id: c.id,
                                                            nombre: c.nombre,
                                                            telefono: c.telefono,
                                                            direccion: c.direccion,
                                                            notas: c.notas,
                                                            activo: c.activo,
                                                        }}
                                                    />
                                                </Modal>
                                                <ModalConfirmar
                                                    accion={eliminarCliente}
                                                    campos={{ id: c.id }}
                                                    etiqueta="Eliminar"
                                                    titulo="Eliminar este cliente"
                                                    descripcion="Si tiene ventas o fiados se desactiva en vez de borrarse, para no perder la cartera."
                                                    confirmar="Eliminar"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
