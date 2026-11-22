"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { registrarVenta, type EstadoVentaAccion } from "@/app/actions/ventas";
import { money } from "@/lib/format";
import { round2 } from "@/lib/num";

type ProductoPos = {
    id: number;
    nombre: string;
    precioVenta: number;
    stockActual: number;
    bajoPedido: boolean;
    controlarStock: boolean;
};

type ClientePos = { id: number; nombre: string };
type ExtraPos = { id: number; nombre: string; precio: number };

type Item = {
    id: number;
    nombre: string;
    precio: number;
    stock: number;
    bajoPedido: boolean;
    controlarStock: boolean;
    cantidad: number;
    nota: string;
    extraIds: number[];
};

type Props = {
    productos: ProductoPos[];
    clientes: ClientePos[];
    extras: ExtraPos[];
    impuestoPct: number;
    jornadaActiva: boolean;
};

const CANALES = [
    { valor: "MOSTRADOR", etiqueta: "Mostrador / carrito" },
    { valor: "WHATSAPP", etiqueta: "WhatsApp" },
    { valor: "APP", etiqueta: "App de domicilios" },
    { valor: "EVENTO", etiqueta: "Evento" },
];

const inicial: EstadoVentaAccion = {};

/** Notas que más se piden en una arepería; se pueden escribir otras. */
const NOTAS = ["Sin queso", "Extra queso", "Bien asada", "Sin sal", "Para llevar"];

/** Billetes que se usan todos los días para dar vueltas. */
const BILLETES = [10000, 20000, 50000, 100000];
const miles = new Intl.NumberFormat("es-CO");

export default function PosCliente({
    productos,
    clientes,
    extras,
    impuestoPct,
    jornadaActiva,
}: Props) {
    const [carrito, setCarrito] = useState<Item[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [aviso, setAviso] = useState("");
    const [formaPago, setFormaPago] = useState("EFECTIVO");
    const [canal, setCanal] = useState("MOSTRADOR");
    const [recibido, setRecibido] = useState("");
    const [estado, accion, pendiente] = useActionState(registrarVenta, inicial);
    const entrada = useRef<HTMLInputElement>(null);

    const filtrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        if (!texto) return productos;
        return productos.filter((p) => p.nombre.toLowerCase().includes(texto));
    }, [productos, busqueda]);

    const precioExtras = (item: Item) =>
        item.extraIds.reduce(
            (suma, id) => suma + (extras.find((e) => e.id === id)?.precio ?? 0),
            0,
        );

    const subtotal = useMemo(
        () =>
            round2(
                carrito.reduce(
                    (suma, item) =>
                        round2(
                            suma +
                                round2(
                                    item.precio * item.cantidad + precioExtras(item),
                                ),
                        ),
                    0,
                ),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [carrito, extras],
    );
    const impuestos = round2((subtotal * impuestoPct) / 100);
    const total = round2(subtotal + impuestos);
    const unidades = carrito.reduce((suma, item) => suma + item.cantidad, 0);

    const esEfectivo = formaPago === "EFECTIVO";
    const esCredito = formaPago === "CREDITO";
    const recibidoNum = recibido.trim() === "" ? null : Number(recibido.replace(",", "."));
    const cambio = recibidoNum !== null && recibidoNum >= total ? round2(recibidoNum - total) : null;
    const faltaEfectivo = esEfectivo && recibidoNum !== null && recibidoNum < total;

    const cobrarDeshabilitado =
        pendiente || carrito.length === 0 || !jornadaActiva || faltaEfectivo;

    function agregar(producto: ProductoPos) {
        const existente = carrito.find((i) => i.id === producto.id);
        const cantidadActual = existente?.cantidad ?? 0;

        if (!producto.bajoPedido && producto.controlarStock && cantidadActual >= producto.stockActual) {
            setAviso(
                producto.stockActual <= 0
                    ? `${producto.nombre} está agotado.`
                    : `Stock insuficiente para ${producto.nombre}.`,
            );
            return;
        }
        setAviso("");
        setCarrito((actual) =>
            existente
                ? actual.map((i) => (i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i))
                : [
                      ...actual,
                      {
                          id: producto.id,
                          nombre: producto.nombre,
                          precio: producto.precioVenta,
                          stock: producto.stockActual,
                          bajoPedido: producto.bajoPedido,
                          controlarStock: producto.controlarStock,
                          cantidad: 1,
                          nota: "",
                          extraIds: [],
                      },
                  ],
        );
    }

    function cambiarCantidad(id: number, delta: number) {
        const item = carrito.find((i) => i.id === id);
        if (!item) return;

        if (delta > 0 && !item.bajoPedido && item.controlarStock && item.cantidad >= item.stock) {
            setAviso(`Stock insuficiente para ${item.nombre}.`);
            return;
        }
        setAviso("");
        setCarrito((actual) =>
            actual
                .map((i) => (i.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
                .filter((i) => i.cantidad > 0),
        );
    }

    function quitar(id: number) {
        setAviso("");
        setCarrito((actual) => actual.filter((i) => i.id !== id));
    }

    function cambiarNota(id: number, nota: string) {
        setCarrito((actual) => actual.map((i) => (i.id === id ? { ...i, nota } : i)));
    }

    function alternarExtra(id: number, extraId: number) {
        setCarrito((actual) =>
            actual.map((i) =>
                i.id === id
                    ? {
                          ...i,
                          extraIds: i.extraIds.includes(extraId)
                              ? i.extraIds.filter((e) => e !== extraId)
                              : [...i.extraIds, extraId],
                      }
                    : i,
            ),
        );
    }

    /** Enter en la búsqueda agrega el primer resultado, como en un POS de verdad. */
    function alEscribir(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Escape") {
            setBusqueda("");
            return;
        }
        if (event.key !== "Enter") return;
        event.preventDefault();
        const primero = filtrados.find(
            (p) => p.bajoPedido || !p.controlarStock || p.stockActual > 0,
        );
        if (primero) {
            agregar(primero);
            setBusqueda("");
        }
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start xl:grid-cols-[1fr_24rem]">
            <section aria-labelledby="titulo-catalogo" className="min-w-0" data-tour="catalogo">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 id="titulo-catalogo" className="section-title">
                        Productos
                    </h2>
                    <span className="text-xs text-ink-faint">
                        {filtrados.length} · Enter agrega el primero
                    </span>
                </div>

                <div className="relative mb-3">
                    <Search
                        size={15}
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
                    />
                    <label className="sr-only" htmlFor="buscar-producto">
                        Buscar producto
                    </label>
                    <input
                        ref={entrada}
                        id="buscar-producto"
                        type="search"
                        className="input pl-9"
                        placeholder="Buscar producto…"
                        autoComplete="off"
                        autoFocus
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        onKeyDown={alEscribir}
                    />
                </div>

                {filtrados.length === 0 ? (
                    <div className="card empty">
                        <p className="empty-title">
                            {productos.length === 0 ? "Sin productos para vender" : "Sin resultados"}
                        </p>
                        <p className="empty-text">
                            {productos.length === 0
                                ? "No hay productos activos. Registra una producción o ajusta el inventario."
                                : "Ningún producto coincide con la búsqueda."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {filtrados.map((producto) => {
                            const enPedido = carrito.find((i) => i.id === producto.id)?.cantidad ?? 0;
                            const disponible = producto.stockActual - enPedido;
                            const agotado =
                                !producto.bajoPedido && producto.controlarStock && disponible <= 0;
                            return (
                                <button
                                    key={producto.id}
                                    type="button"
                                    onClick={() => agregar(producto)}
                                    disabled={agotado}
                                    className={[
                                        "card flex min-h-24 flex-col justify-between gap-2 p-3 text-left transition-colors",
                                        agotado
                                            ? "cursor-not-allowed opacity-55"
                                            : "hover:border-line-strong hover:bg-surface-muted",
                                    ].join(" ")}
                                >
                                    <span className="text-[0.8125rem] leading-snug font-medium text-ink">
                                        {producto.nombre}
                                    </span>
                                    <span className="flex items-baseline justify-between gap-1">
                                        <span className="text-[0.8125rem] font-medium text-accent-strong num">
                                            {money(producto.precioVenta)}
                                        </span>
                                        <span className="text-[0.6875rem] text-ink-faint">
                                            {producto.bajoPedido
                                                ? "Bajo pedido"
                                                : agotado
                                                  ? "Sin stock"
                                                  : `${disponible} en stock`}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <aside className="card lg:sticky lg:top-4" aria-labelledby="titulo-pedido">
                <div className="panel-head">
                    <h2 id="titulo-pedido" className="section-title flex items-center gap-2">
                        <ShoppingCart size={15} /> Pedido
                        <span className="badge">{unidades}</span>
                    </h2>
                    {carrito.length > 0 && (
                        <button type="button" onClick={() => setCarrito([])} className="btn btn-ghost btn-sm">
                            Vaciar
                        </button>
                    )}
                </div>

                <div className="p-4">
                    {!jornadaActiva && (
                        <p role="alert" className="alert alert-warning mb-3">
                            No hay jornada abierta: abre el día antes de cobrar.
                        </p>
                    )}

                    {aviso && (
                        <p role="status" className="alert alert-warning mb-3">
                            {aviso}
                        </p>
                    )}

                    {carrito.length === 0 ? (
                        <p className="py-6 text-center text-[0.8125rem] text-ink-soft">
                            Toca un producto para armar el pedido.
                        </p>
                    ) : (
                        <ul className="mb-3 divide-y divide-line">
                            {carrito.map((item) => (
                                <li key={item.id} className="py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[0.8125rem] font-medium text-ink">
                                                {item.nombre}
                                            </p>
                                            <p className="text-xs text-ink-soft num">
                                                {money(item.precio)} c/u
                                            </p>
                                        </div>
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => cambiarCantidad(item.id, -1)}
                                                aria-label={`Quitar una unidad de ${item.nombre}`}
                                                className="grid size-10 place-items-center rounded-l-md border border-line text-ink-soft hover:bg-surface-muted"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="grid h-10 w-8 place-items-center border-y border-line text-[0.8125rem] num">
                                                {item.cantidad}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => cambiarCantidad(item.id, 1)}
                                                aria-label={`Agregar una unidad de ${item.nombre}`}
                                                className="grid size-10 place-items-center rounded-r-md border border-line text-ink-soft hover:bg-surface-muted"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => quitar(item.id)}
                                            aria-label={`Quitar ${item.nombre} del pedido`}
                                            className="grid size-10 place-items-center rounded-md text-ink-faint hover:bg-danger-tint hover:text-danger"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>

                                    <div className="mt-1.5 grid gap-1.5">
                                        <label className="sr-only" htmlFor={`nota-${item.id}`}>
                                            Nota para {item.nombre}
                                        </label>
                                        <input
                                            id={`nota-${item.id}`}
                                            list="notas-frecuentes"
                                            className="input h-8 min-h-0 py-0 text-xs"
                                            placeholder="Nota: sin queso, bien asada…"
                                            maxLength={120}
                                            value={item.nota}
                                            onChange={(e) => cambiarNota(item.id, e.target.value)}
                                        />

                                        {extras.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {extras.map((extra) => {
                                                    const activo = item.extraIds.includes(extra.id);
                                                    return (
                                                        <button
                                                            key={extra.id}
                                                            type="button"
                                                            aria-pressed={activo}
                                                            onClick={() => alternarExtra(item.id, extra.id)}
                                                            className={[
                                                                "rounded-md border px-1.5 py-0.5 text-[0.6875rem] transition-colors",
                                                                activo
                                                                    ? "border-accent bg-accent-tint text-accent-strong"
                                                                    : "border-line text-ink-soft hover:bg-surface-muted",
                                                            ].join(" ")}
                                                        >
                                                            {extra.nombre} +{money(extra.precio).replace("$ ", "$")}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <datalist id="notas-frecuentes">
                        {NOTAS.map((nota) => (
                            <option key={nota} value={nota} />
                        ))}
                    </datalist>

                    <form action={accion} className="grid gap-3">
                        {carrito.map((item) => (
                            <Fragment key={item.id}>
                                <input type="hidden" name="productoId" value={item.id} />
                                <input type="hidden" name="cantidad" value={item.cantidad} />
                                <input type="hidden" name="nota" value={item.nota} />
                                <input type="hidden" name="extras" value={item.extraIds.join(",")} />
                            </Fragment>
                        ))}

                        <div className="grid gap-3 border-t border-line pt-3">
                            <div>
                                <label className="label" htmlFor="clienteId">
                                    Cliente
                                </label>
                                <select className="input" id="clienteId" name="clienteId">
                                    <option value="">Consumidor final</option>
                                    {clientes.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                                <p className="hint">Obligatorio para fiar.</p>
                            </div>

                            <div>
                                <label className="label" htmlFor="nombreCliente">
                                    Nombre en el recibo
                                </label>
                                <input
                                    className="input"
                                    id="nombreCliente"
                                    name="nombreCliente"
                                    maxLength={100}
                                    autoComplete="off"
                                    placeholder="Opcional"
                                />
                            </div>

                            <div>
                                <label className="label" htmlFor="canal">
                                    Canal del pedido
                                </label>
                                <select
                                    className="input"
                                    id="canal"
                                    name="canal"
                                    value={canal}
                                    onChange={(e) => setCanal(e.target.value)}
                                >
                                    {CANALES.map((c) => (
                                        <option key={c.valor} value={c.valor}>
                                            {c.etiqueta}
                                        </option>
                                    ))}
                                </select>
                                <p className="hint">
                                    {canal === "APP"
                                        ? "Se descuenta la comisión configurada del margen."
                                        : "Canal propio: sin comisión."}
                                </p>
                            </div>

                            <div>
                                <label className="label" htmlFor="formaPago">
                                    Forma de pago
                                </label>
                                <select
                                    className="input"
                                    id="formaPago"
                                    name="formaPago"
                                    value={formaPago}
                                    onChange={(e) => setFormaPago(e.target.value)}
                                >
                                    <option value="EFECTIVO">Efectivo</option>
                                    <option value="TARJETA">Tarjeta</option>
                                    <option value="TRANSFERENCIA">Transferencia</option>
                                    <option value="CREDITO">Crédito</option>
                                </select>
                            </div>

                            {esEfectivo && (
                                <div className="rounded-lg border border-line bg-surface-muted p-2.5" data-tour="cobro">
                                    <label className="label" htmlFor="recibido">
                                        Recibido
                                    </label>
                                    <input
                                        className="input text-base num"
                                        id="recibido"
                                        name="recibido"
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="100"
                                        placeholder={money(total)}
                                        value={recibido}
                                        onChange={(e) => setRecibido(e.target.value)}
                                    />

                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setRecibido(String(total))}
                                        >
                                            Exacto
                                        </button>
                                        {/* Acumulan: dos toques de $10.000 dan $20.000. */}
                                        {BILLETES.map((billete) => (
                                            <button
                                                key={billete}
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() =>
                                                    setRecibido((valor) => {
                                                        const actual = Number(valor.replace(",", ".")) || 0;
                                                        return String(actual + billete);
                                                    })
                                                }
                                            >
                                                +{miles.format(billete)}
                                            </button>
                                        ))}
                                        {recibido !== "" && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setRecibido("")}
                                                aria-label="Borrar efectivo recibido"
                                            >
                                                Borrar
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-2 flex items-baseline justify-between">
                                        <span className="text-xs text-ink-soft">Devuelta</span>
                                        <span
                                            className={`text-base font-semibold num ${
                                                faltaEfectivo ? "text-danger" : "text-ink"
                                            }`}
                                        >
                                            {faltaEfectivo
                                                ? `Faltan ${money(total - (recibidoNum ?? 0))}`
                                                : cambio !== null
                                                  ? money(cambio)
                                                  : "—"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {esCredito && (
                                <div>
                                    <label className="label" htmlFor="fechaVencimiento">
                                        Vence el
                                    </label>
                                    <input
                                        className="input"
                                        id="fechaVencimiento"
                                        name="fechaVencimiento"
                                        type="date"
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        <dl className="grid gap-1 border-t border-line pt-3 text-[0.8125rem]">
                            <div className="flex justify-between text-ink-soft">
                                <dt>Subtotal</dt>
                                <dd className="num">{money(subtotal)}</dd>
                            </div>
                            <div className="flex justify-between text-ink-soft">
                                <dt>Impuestos ({impuestoPct}%)</dt>
                                <dd className="num">{money(impuestos)}</dd>
                            </div>
                            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
                                <dt className="text-sm font-semibold text-ink">Total</dt>
                                <dd className="text-xl font-semibold text-ink num">{money(total)}</dd>
                            </div>
                        </dl>

                        {estado.error && (
                            <p role="alert" className="alert alert-danger">
                                {estado.error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={cobrarDeshabilitado}
                            className="btn btn-primary w-full"
                        >
                            {pendiente ? "Registrando…" : `Cobrar ${money(total)}`}
                        </button>
                    </form>
                </div>
            </aside>
        </div>
    );
}
