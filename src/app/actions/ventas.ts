"use server";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
    CANALES,
    FORMAS_PAGO,
    abonos,
    clientes,
    configuracionNegocio,
    detalleVentaExtras,
    detalleVentas,
    extras,
    jornadas,
    productos,
    ventas,
} from "@/db/schema";
import { requireAdmin, requireSesion } from "@/lib/auth";
import { programarAlertas } from "@/lib/alertas-server";
import { round2 } from "@/lib/num";

export type EstadoVentaAccion = { error?: string; campos?: Record<string, string> };

type FormaPago = (typeof FORMAS_PAGO)[number];

/** El abono no puede hacerse a crédito: se cobra con dinero real. */
const METODOS_ABONO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;
type MetodoAbono = (typeof METODOS_ABONO)[number];

const esFormaPago = (valor: string): valor is FormaPago =>
    (FORMAS_PAGO as readonly string[]).includes(valor);

const esMetodoAbono = (valor: string): valor is MetodoAbono =>
    (METODOS_ABONO as readonly string[]).includes(valor);

function mensajeDe(error: unknown) {
    return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

/** Bogotá es UTC-5 todo el año; se guarda mediodía para no cruzar de día al formatear. */
function fechaVencimiento(valor: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
    const fecha = new Date(`${valor}T12:00:00-05:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

type Linea = {
    productoId: number;
    cantidad: number;
    nota: string | null;
    extraIds: number[];
};

function leerLineas(formData: FormData): { lineas: Linea[] } | { error: string } {
    const ids = formData.getAll("productoId");
    const cantidades = formData.getAll("cantidad");
    const notas = formData.getAll("nota");
    const extrasPorLinea = formData.getAll("extras");
    const lineas: Linea[] = [];

    for (let i = 0; i < ids.length; i++) {
        const productoId = Number(ids[i]);
        const cantidad = Number(cantidades[i]);
        if (!Number.isInteger(productoId) || productoId <= 0) continue;
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            return { error: "Las cantidades deben ser números enteros mayores que cero." };
        }
        const nota = String(notas[i] ?? "").trim().slice(0, 120);
        const extraIds = String(extrasPorLinea[i] ?? "")
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((v) => Number.isInteger(v) && v > 0);
        lineas.push({
            productoId,
            cantidad,
            nota: nota === "" ? null : nota,
            extraIds: [...new Set(extraIds)],
        });
    }

    if (lineas.length === 0) return { error: "Agrega al menos un producto al pedido." };
    return { lineas };
}

export async function registrarVenta(
    _estado: EstadoVentaAccion,
    formData: FormData,
): Promise<EstadoVentaAccion> {
    await requireSesion("/pos");

    const leidas = leerLineas(formData);
    if ("error" in leidas) return { error: leidas.error };

    const formaCruda = String(formData.get("formaPago") ?? "EFECTIVO").toUpperCase();
    const formaPago: FormaPago = esFormaPago(formaCruda) ? formaCruda : "EFECTIVO";

    const clienteCrudo = String(formData.get("clienteId") ?? "").trim();
    const clienteId = clienteCrudo === "" ? null : Number(clienteCrudo);
    if (clienteId !== null && (!Number.isInteger(clienteId) || clienteId <= 0)) {
        return { error: "El cliente seleccionado no es válido." };
    }

    const vencimiento = fechaVencimiento(String(formData.get("fechaVencimiento") ?? "").trim());

    if (formaPago === "CREDITO" && clienteId === null) {
        return { error: "Una venta a crédito necesita un cliente de la cartera." };
    }
    if (formaPago === "CREDITO" && vencimiento === null) {
        return { error: "Indica la fecha de vencimiento del crédito." };
    }

    const nombreLibre = String(formData.get("nombreCliente") ?? "").trim().slice(0, 100);

    const canalCrudo = String(formData.get("canal") ?? "MOSTRADOR").toUpperCase();
    const canal = (CANALES as readonly string[]).includes(canalCrudo)
        ? (canalCrudo as (typeof CANALES)[number])
        : "MOSTRADOR";

    let ventaId: number;
    try {
        ventaId = await db.transaction(async (tx) => {
            const [jornada] = await tx
                .select()
                .from(jornadas)
                .where(eq(jornadas.activa, true))
                .orderBy(desc(jornadas.fechaApertura));

            if (!jornada) {
                throw new Error("No hay una jornada abierta. Abre el día antes de cobrar.");
            }

            let cliente: typeof clientes.$inferSelect | null = null;
            if (clienteId !== null) {
                const [encontrado] = await tx
                    .select()
                    .from(clientes)
                    .where(eq(clientes.id, clienteId));
                if (!encontrado) throw new Error("El cliente seleccionado ya no existe.");
                if (!encontrado.activo) {
                    throw new Error(`El cliente "${encontrado.nombre}" está inactivo.`);
                }
                cliente = encontrado;
            }

            /* Un mismo producto puede venir repetido: se consolida antes de
             * bloquear las filas para que la validación de stock sea exacta. */
            const consolidado = new Map<number, number>();
            for (const linea of leidas.lineas) {
                consolidado.set(
                    linea.productoId,
                    (consolidado.get(linea.productoId) ?? 0) + linea.cantidad,
                );
            }
            const ids = [...consolidado.keys()];

            /* Se bloquean en orden de id para que dos cajas concurrentes no
             * se queden esperando en distinto orden (deadlock). */
            const bloqueados = await tx
                .select()
                .from(productos)
                .where(inArray(productos.id, ids))
                .orderBy(asc(productos.id))
                .for("update");
            const porId = new Map(bloqueados.map((p) => [p.id, p]));

            /* Extras elegidos: se cobran al precio de la base, no del cliente. */
            const idsExtras = [...new Set(leidas.lineas.flatMap((l) => l.extraIds))];
            const catalogoExtras = idsExtras.length
                ? await tx.select().from(extras).where(inArray(extras.id, idsExtras))
                : [];
            const extraPorId = new Map(catalogoExtras.map((e) => [e.id, e]));
            for (const id of idsExtras) {
                if (!extraPorId.has(id)) throw new Error(`El extra #${id} ya no existe.`);
            }

            let subtotal = 0;
            const filas: {
                productoId: number;
                cantidad: number;
                precioUnitario: number;
                subtotal: number;
                nota: string | null;
                extraIds: number[];
            }[] = [];

            for (const [productoId, cantidadTotal] of consolidado) {
                const producto = porId.get(productoId);
                if (!producto) throw new Error(`El producto #${productoId} ya no existe.`);
                if (!producto.activo) {
                    throw new Error(`El producto "${producto.nombre}" no está activo.`);
                }
                /* ponytail: los productos bajo pedido no descuentan stock (se
                 * producen al momento), igual que el servicio Java. Si algún
                 * día se porta producción, aquí va registrarParaVenta(). */
                if (
                    !producto.bajoPedido &&
                    producto.controlarStock &&
                    producto.stockActual < cantidadTotal
                ) {
                    throw new Error(
                        `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stockActual}, solicitado: ${cantidadTotal}.`,
                    );
                }
            }

            for (const linea of leidas.lineas) {
                const producto = porId.get(linea.productoId)!;
                const precioUnitario = Number(producto.precioVenta);
                const extrasLinea = linea.extraIds.map((id) => ({
                    id,
                    precio: Number(extraPorId.get(id)!.precio),
                }));
                const totalExtras = extrasLinea.reduce((suma, e) => suma + e.precio, 0);
                const subtotalLinea = round2(precioUnitario * linea.cantidad + totalExtras);
                subtotal = round2(subtotal + subtotalLinea);
                filas.push({
                    productoId: linea.productoId,
                    cantidad: linea.cantidad,
                    precioUnitario,
                    subtotal: subtotalLinea,
                    nota: linea.nota,
                    extraIds: linea.extraIds,
                });
            }

            const [config] = await tx
                .select({
                    pct: configuracionNegocio.impuestoPorcentaje,
                    comisionApp: configuracionNegocio.comisionAppPct,
                })
                .from(configuracionNegocio)
                .limit(1);
            const impuestoPct = Number(config?.pct ?? 0);
            const impuestos = round2((subtotal * impuestoPct) / 100);
            const total = round2(subtotal + impuestos);

            /* Solo el efectivo lleva recibido y devuelta; el resto se cobra exacto. */
            let efectivoRecibido: number | null = null;
            let cambio: number | null = null;
            if (formaPago === "EFECTIVO") {
                const crudo = String(formData.get("recibido") ?? "").trim();
                if (crudo !== "") {
                    const valor = Number(crudo.replace(",", "."));
                    if (!Number.isFinite(valor) || valor < 0) {
                        throw new Error("El efectivo recibido no es válido.");
                    }
                    if (valor < total) {
                        throw new Error(
                            `El efectivo recibido (${valor}) no cubre el total (${total}).`,
                        );
                    }
                    efectivoRecibido = round2(valor);
                    cambio = round2(valor - total);
                }
            }

            const [creada] = await tx
                .insert(ventas)
                .values({
                    fecha: new Date(),
                    subtotal,
                    impuestos,
                    total,
                    saldo: formaPago === "CREDITO" ? total : 0,
                    formaPago,
                    estado: "ACTIVA",
                    fechaVencimiento: formaPago === "CREDITO" ? vencimiento : null,
                    clienteId: cliente?.id ?? null,
                    jornadaId: jornada.id,
                    nombreCliente: cliente ? cliente.nombre : nombreLibre || null,
                    efectivoRecibido,
                    cambio,
                    canal,
                    comisionPct: canal === "APP" ? Number(config?.comisionApp ?? 0) : 0,
                })
                .returning({ id: ventas.id });

            const detalleCreado = await tx
                .insert(detalleVentas)
                .values(
                    filas.map(({ extraIds: _extras, ...fila }) => ({ ventaId: creada.id, ...fila })),
                )
                .returning({ id: detalleVentas.id });

            const filasExtras = filas.flatMap((fila, indice) =>
                fila.extraIds.map((extraId) => ({
                    detalleVentaId: detalleCreado[indice].id,
                    extraId,
                    cantidad: 1,
                    precioUnitario: Number(extraPorId.get(extraId)!.precio),
                })),
            );
            if (filasExtras.length > 0) {
                await tx.insert(detalleVentaExtras).values(filasExtras);
            }

            for (const [productoId, cantidadTotal] of consolidado) {
                const producto = porId.get(productoId);
                if (producto?.bajoPedido) continue;
                await tx
                    .update(productos)
                    .set({ stockActual: sql`${productos.stockActual} - ${cantidadTotal}` })
                    .where(eq(productos.id, productoId));
            }

            return creada.id;
        });
    } catch (error) {
        return { error: mensajeDe(error) };
    }

    revalidatePath("/");
    revalidatePath("/pos");
    revalidatePath("/ventas");
    revalidatePath("/clientes");
    programarAlertas();
    redirect(`/ventas/${ventaId}`);
}

export async function anularVenta(formData: FormData) {
    await requireAdmin("/ventas");
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) return;

    await db.transaction(async (tx) => {
        const [venta] = await tx.select().from(ventas).where(eq(ventas.id, id)).for("update");
        if (!venta || venta.estado !== "ACTIVA") return;
        /* Primero cobrar (o devolver) el saldo: nunca anular dejando deuda. */
        if (Number(venta.saldo) > 0) return;

        const detalles = await tx
            .select()
            .from(detalleVentas)
            .where(eq(detalleVentas.ventaId, id));
        const ids = detalles.map((d) => d.productoId);
        const prods = ids.length
            ? await tx
                  .select()
                  .from(productos)
                  .where(inArray(productos.id, ids))
                  .orderBy(asc(productos.id))
                  .for("update")
            : [];
        const porId = new Map(prods.map((p) => [p.id, p]));

        for (const detalle of detalles) {
            const producto = porId.get(detalle.productoId);
            if (!producto || producto.bajoPedido) continue;
            await tx
                .update(productos)
                .set({ stockActual: sql`${productos.stockActual} + ${detalle.cantidad}` })
                .where(eq(productos.id, producto.id));
        }

        await tx.update(ventas).set({ estado: "ANULADA", saldo: 0 }).where(eq(ventas.id, id));
    });

    programarAlertas();
    revalidatePath("/");
    revalidatePath("/pos");
    revalidatePath("/ventas");
    revalidatePath("/clientes");
}

export async function registrarAbono(
    _estado: EstadoVentaAccion,
    formData: FormData,
): Promise<EstadoVentaAccion> {
    const id = Number(formData.get("ventaId"));
    await requireSesion(Number.isInteger(id) ? `/ventas/${id}/cobrar` : "/ventas");
    if (!Number.isInteger(id)) return { error: "La venta no es válida." };

    const montoCrudo = String(formData.get("monto") ?? "").replace(",", ".");
    const monto = round2(Number(montoCrudo));
    if (!Number.isFinite(monto) || monto <= 0) {
        return { error: "El monto del abono debe ser mayor que cero." };
    }

    const metodoCrudo = String(formData.get("metodo") ?? "EFECTIVO").toUpperCase();
    const metodo: MetodoAbono = esMetodoAbono(metodoCrudo) ? metodoCrudo : "EFECTIVO";
    const nota = String(formData.get("nota") ?? "").trim().slice(0, 150);

    try {
        await db.transaction(async (tx) => {
            const [venta] = await tx.select().from(ventas).where(eq(ventas.id, id)).for("update");
            if (!venta) throw new Error("La venta ya no existe.");
            if (venta.estado !== "ACTIVA") throw new Error("No se puede abonar a una venta anulada.");

            const saldo = round2(Number(venta.saldo));
            if (saldo <= 0) throw new Error(`La venta #${id} no tiene saldo pendiente.`);
            if (monto > saldo) {
                throw new Error(`El abono no puede ser mayor al saldo pendiente (${saldo}).`);
            }

            await tx.insert(abonos).values({
                ventaId: id,
                monto,
                fecha: new Date(),
                metodo,
                nota: nota || null,
            });
            await tx
                .update(ventas)
                .set({ saldo: round2(saldo - monto) })
                .where(eq(ventas.id, id));
        });
    } catch (error) {
        return { error: mensajeDe(error) };
    }

    programarAlertas();
    revalidatePath("/");
    revalidatePath("/ventas");
    revalidatePath(`/ventas/${id}`);
    revalidatePath(`/ventas/${id}/cobrar`);
    revalidatePath("/clientes");
    redirect(`/ventas/${id}`);
}
