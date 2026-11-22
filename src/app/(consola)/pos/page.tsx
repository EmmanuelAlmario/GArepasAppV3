import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { History, Play, Square } from "lucide-react";
import { db } from "@/db";
import { clientes, configuracionNegocio, extras, jornadas, productos, ventas } from "@/db/schema";
import { requireSesion } from "@/lib/auth";
import { fechaHoraCorta, money } from "@/lib/format";
import PosCliente from "@/components/pos/pos-cliente";
import ControlJornada from "@/components/pos/control-jornada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Punto de venta" };

export default async function PaginaPos() {
    const sesion = await requireSesion("/pos");

    const [catalogo, cartera, listaExtras, config, abierta] = await Promise.all([
        db
            .select({
                id: productos.id,
                nombre: productos.nombre,
                precioVenta: productos.precioVenta,
                stockActual: productos.stockActual,
                bajoPedido: productos.bajoPedido,
                controlarStock: productos.controlarStock,
            })
            .from(productos)
            .where(eq(productos.activo, true))
            .orderBy(asc(productos.nombre)),
        db
            .select({ id: clientes.id, nombre: clientes.nombre })
            .from(clientes)
            .where(eq(clientes.activo, true))
            .orderBy(asc(clientes.nombre)),
        db
            .select({ id: extras.id, nombre: extras.nombre, precio: extras.precio })
            .from(extras)
            .where(eq(extras.activo, true))
            .orderBy(asc(extras.orden), asc(extras.nombre)),
        db
            .select({ impuestoPct: configuracionNegocio.impuestoPorcentaje })
            .from(configuracionNegocio)
            .limit(1),
        db
            .select()
            .from(jornadas)
            .where(eq(jornadas.activa, true))
            .orderBy(desc(jornadas.fechaApertura))
            .limit(1),
    ]);

    const jornada = abierta[0] ?? null;
    const impuestoPct = Number(config[0]?.impuestoPct ?? 0);

    const [enEfectivo] = jornada
        ? await db
              .select({ total: sql<string>`coalesce(sum(${ventas.total}), 0)` })
              .from(ventas)
              .where(
                  and(
                      eq(ventas.jornadaId, jornada.id),
                      eq(ventas.estado, "ACTIVA"),
                      eq(ventas.formaPago, "EFECTIVO"),
                  ),
              )
        : [{ total: "0" }];
    const ventasEfectivo = Number(enEfectivo.total);

    const arqueo = jornada
        ? (
              await db
                  .select({
                      n: sql<string>`count(*)`,
                      total: sql<string>`coalesce(sum(${ventas.total}), 0)`,
                  })
                  .from(ventas)
                  .where(and(eq(ventas.jornadaId, jornada.id), eq(ventas.estado, "ACTIVA")))
          )[0]
        : null;

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Punto de venta</h1>
                    <p className="page-sub">
                        Arma el pedido y cobra. El stock y la caja se actualizan al registrar.
                    </p>
                </div>
                {sesion.rol === "ADMIN" && (
                    <Link href="/ventas" className="btn btn-secondary">
                        <History size={15} /> Historial de ventas
                    </Link>
                )}
            </header>

            <ControlJornada
                abierta={
                    jornada
                        ? {
                              abiertaPor: jornada.abiertaPor,
                              desde: fechaHoraCorta(jornada.fechaApertura),
                              fondo: Number(jornada.fondoInicial),
                              ventasEfectivo,
                          }
                        : null
                }
            />

            <PosCliente
                productos={catalogo.map((p) => ({
                    id: p.id,
                    nombre: p.nombre,
                    precioVenta: Number(p.precioVenta),
                    stockActual: p.stockActual,
                    bajoPedido: Boolean(p.bajoPedido),
                    controlarStock: p.controlarStock,
                }))}
                clientes={cartera}
                extras={listaExtras.map((e) => ({ ...e, precio: Number(e.precio) }))}
                impuestoPct={impuestoPct}
                jornadaActiva={Boolean(jornada)}
            />
        </div>
    );
}
