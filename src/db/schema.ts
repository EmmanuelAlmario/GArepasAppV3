/**
 * Esquema de la base de datos — retrato exacto del estado final de las
 * migraciones Flyway (V1 + V2 + V3) del proyecto Spring Boot.
 *
 * Regla: los tipos y nombres deben coincidir con Postgres para poder
 * apuntar la app nueva a la base existente sin migrar datos.
 */
import { relations } from "drizzle-orm";
import {
    bigint,
    boolean,
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";

/* ---------- Enums (varchar + check en la base) ---------- */
export const UNIDADES = ["GRAMO", "KILOGRAMO", "MILILITRO", "LITRO", "UNIDAD"] as const;
export const ROLES = ["ADMIN", "VENTAS"] as const;
export const ESTADOS_VENTA = ["ACTIVA", "ANULADA"] as const;
export const ESTADOS_PRODUCCION = ["PENDIENTE", "COMPLETADA"] as const;
export const FORMAS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CREDITO"] as const;
export const CANALES = ["MOSTRADOR", "WHATSAPP", "APP", "EVENTO", "RETAIL"] as const;

export const CATEGORIAS_GASTO = [
    "MATERIA_PRIMA",
    "SERVICIOS",
    "TRANSPORTE",
    "EQUIPAMIENTO",
    "MANTENIMIENTO",
    "OTROS",
] as const;

/* ponytail: numeric en modo number. Se redondea al escribir con
 * lib/num.ts (round2/round4); si algún día se factura a escala,
 * pasar todo a enteros en centésimas. */
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
const qty4 = (name: string) => numeric(name, { precision: 15, scale: 4, mode: "number" });

/* ---------- Usuarios ---------- */
export const usuarios = pgTable("usuarios", {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    rol: varchar("rol", { length: 20, enum: ROLES }).notNull(),
    activo: boolean("activo").notNull(),
});

/* ---------- Insumos ---------- */
export const insumos = pgTable(
    "insumos",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        nombre: varchar("nombre", { length: 60 }).notNull().unique(),
        marca: varchar("marca", { length: 30 }).notNull(),
        categoria: varchar("categoria", { length: 30 }).notNull(),
        unidadPresentacion: varchar("unidad_presentacion", { length: 20, enum: UNIDADES }).notNull(),
        precioUnidadBase: numeric("precio_unidad_base", { precision: 15, scale: 6, mode: "number" }).notNull(),
        stockActual: qty4("stock_actual").notNull(),
        stockMinimo: qty4("stock_minimo"),
        activo: boolean("activo").notNull(),
        version: bigint("version", { mode: "number" }),
    },
    (t) => [index("idx_insumos_categoria").on(t.categoria), index("idx_insumos_activo").on(t.activo)],
);

/* ---------- Recetas ---------- */
export const recetas = pgTable("recetas", {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nombre: varchar("nombre", { length: 50 }).notNull().unique(),
    descripcion: varchar("descripcion", { length: 150 }),
    rendimiento: qty4("rendimiento"),
    insumoProducidoId: bigint("insumo_producido_id", { mode: "number" }).references(() => insumos.id),
});

export const detalleRecetas = pgTable(
    "detalle_recetas",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        recetaId: bigint("receta_id", { mode: "number" })
            .notNull()
            .references(() => recetas.id),
        insumoId: bigint("insumo_id", { mode: "number" })
            .notNull()
            .references(() => insumos.id),
        cantidad: qty4("cantidad").notNull(),
    },
    (t) => [
        index("idx_detalle_receta_receta_id").on(t.recetaId),
        index("idx_detalle_receta_insumo_id").on(t.insumoId),
    ],
);

/* ---------- Productos ---------- */
export const productos = pgTable("productos", {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nombre: varchar("nombre", { length: 50 }).notNull().unique(),
    /** Sección de la carta pública. */
    categoria: varchar("categoria", { length: 10, enum: ["AREPA", "CASA", "BEBIDA"] })
        .notNull()
        .default("AREPA"),
    /** Línea que se muestra bajo el nombre en la carta. */
    descripcion: varchar("descripcion", { length: 160 }),
    precioVenta: money("precio_venta").notNull(),
    stockActual: integer("stock_actual").notNull(),
    stockMinimo: integer("stock_minimo"),
    activo: boolean("activo").notNull(),
    bajoPedido: boolean("bajo_pedido"),
    /** Si es false, la venta no se bloquea por stock y puede quedar negativo. */
    controlarStock: boolean("controlar_stock").notNull().default(true),
    recetaId: bigint("receta_id", { mode: "number" }).references(() => recetas.id),
    version: bigint("version", { mode: "number" }),
});

/* ---------- Extras de la carta ---------- */
export const extras = pgTable("extras", {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nombre: varchar("nombre", { length: 40 }).notNull().unique(),
    precio: money("precio").notNull(),
    activo: boolean("activo").notNull().default(true),
    orden: integer("orden").notNull().default(0),
});

export const detalleVentaExtras = pgTable(
    "detalle_venta_extras",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        detalleVentaId: bigint("detalle_venta_id", { mode: "number" })
            .notNull()
            .references(() => detalleVentas.id),
        extraId: bigint("extra_id", { mode: "number" })
            .notNull()
            .references(() => extras.id),
        cantidad: integer("cantidad").notNull().default(1),
        precioUnitario: money("precio_unitario").notNull(),
    },
    (t) => [index("idx_detalle_extra_detalle").on(t.detalleVentaId)],
);

/* ---------- Jornadas ---------- */
export const jornadas = pgTable("jornadas", {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    fechaApertura: timestamp("fecha_apertura", { precision: 6 }).notNull(),
    fechaCierre: timestamp("fecha_cierre", { precision: 6 }),
    activa: boolean("activa").notNull(),
    abiertaPor: varchar("abierta_por", { length: 60 }).notNull(),
    /* Arqueo: el cierre compara lo contado con lo esperado. */
    fondoInicial: money("fondo_inicial").notNull().default(0),
    retiros: money("retiros").notNull().default(0),
    efectivoContado: money("efectivo_contado"),
    diferencia: money("diferencia"),
    notas: varchar("notas", { length: 250 }),
    cerradaPor: varchar("cerrada_por", { length: 60 }),
});

/* ---------- Clientes ---------- */
export const clientes = pgTable(
    "clientes",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        nombre: varchar("nombre", { length: 80 }).notNull().unique(),
        telefono: varchar("telefono", { length: 30 }),
        direccion: varchar("direccion", { length: 150 }),
        notas: varchar("notas", { length: 250 }),
        activo: boolean("activo").notNull().default(true),
        creadoEn: timestamp("creado_en", { precision: 6 }).notNull(),
    },
    (t) => [index("idx_clientes_activo").on(t.activo)],
);

/* ---------- Ventas ---------- */
export const ventas = pgTable(
    "ventas",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        fecha: timestamp("fecha", { precision: 6 }).notNull(),
        total: money("total").notNull(),
        subtotal: money("subtotal").notNull().default(0),
        impuestos: money("impuestos").notNull().default(0),
        saldo: money("saldo").notNull().default(0),
        formaPago: varchar("forma_pago", { length: 20, enum: FORMAS_PAGO }).notNull(),
        estado: varchar("estado", { length: 15, enum: ESTADOS_VENTA }).notNull(),
        fechaVencimiento: timestamp("fecha_vencimiento", { precision: 6 }),
        clienteId: bigint("cliente_id", { mode: "number" }).references(() => clientes.id),
        jornadaId: bigint("jornada_id", { mode: "number" }).references(() => jornadas.id),
        nombreCliente: varchar("nombre_cliente", { length: 100 }),
        efectivoRecibido: money("efectivo_recibido"),
        cambio: money("cambio"),
        /** De dónde vino el pedido: define la comisión y el margen real. */
        canal: varchar("canal", { length: 20, enum: CANALES }).notNull().default("MOSTRADOR"),
        comisionPct: numeric("comision_pct", { precision: 5, scale: 2, mode: "number" })
            .notNull()
            .default(0),
    },
    (t) => [
        index("idx_ventas_fecha").on(t.fecha),
        index("idx_ventas_cliente_id").on(t.clienteId),
        index("idx_ventas_saldo").on(t.saldo),
        index("idx_ventas_jornada_id").on(t.jornadaId),
        index("idx_ventas_estado").on(t.estado),
    ],
);

export const detalleVentas = pgTable(
    "detalle_ventas",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        ventaId: bigint("venta_id", { mode: "number" })
            .notNull()
            .references(() => ventas.id),
        productoId: bigint("producto_id", { mode: "number" })
            .notNull()
            .references(() => productos.id),
        cantidad: integer("cantidad").notNull(),
        precioUnitario: money("precio_unitario").notNull(),
        subtotal: money("subtotal").notNull(),
        /** "sin queso", "bien asada"… viaja al recibo y a cocina. */
        nota: varchar("nota", { length: 120 }),
    },
    (t) => [
        index("idx_detalle_venta_venta_id").on(t.ventaId),
        index("idx_detalle_venta_producto_id").on(t.productoId),
    ],
);

/* ---------- Abonos (crédito) ---------- */
export const abonos = pgTable(
    "abonos",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        ventaId: bigint("venta_id", { mode: "number" })
            .notNull()
            .references(() => ventas.id),
        monto: money("monto").notNull(),
        fecha: timestamp("fecha", { precision: 6 }).notNull(),
        metodo: varchar("metodo", { length: 20, enum: FORMAS_PAGO }).notNull(),
        nota: varchar("nota", { length: 150 }),
    },
    (t) => [index("idx_abonos_venta_id").on(t.ventaId), index("idx_abonos_fecha").on(t.fecha)],
);

/* ---------- Producciones ---------- */
export const producciones = pgTable(
    "producciones",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        fecha: timestamp("fecha", { precision: 6 }).notNull(),
        cantidad: integer("cantidad").notNull(),
        costoTotal: qty4("costo_total"),
        estado: varchar("estado", { length: 15, enum: ESTADOS_PRODUCCION }).notNull(),
        productoId: bigint("producto_id", { mode: "number" })
            .notNull()
            .references(() => productos.id),
        ventaId: bigint("venta_id", { mode: "number" }).references(() => ventas.id),
    },
    (t) => [
        index("idx_producciones_fecha").on(t.fecha),
        index("idx_producciones_venta_id").on(t.ventaId),
        index("idx_producciones_producto_id").on(t.productoId),
    ],
);

export const detalleProducciones = pgTable(
    "detalle_producciones",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        produccionId: bigint("produccion_id", { mode: "number" })
            .notNull()
            .references(() => producciones.id),
        insumoId: bigint("insumo_id", { mode: "number" })
            .notNull()
            .references(() => insumos.id),
        cantidadRequerida: qty4("cantidad_requerida").notNull(),
        cantidadUsada: qty4("cantidad_usada"),
        costoLinea: qty4("costo_linea"),
        precioUnidadBaseSnapshot: numeric("precio_unidad_base_snapshot", {
            precision: 15,
            scale: 6,
            mode: "number",
        }),
        suficiente: boolean("suficiente").notNull(),
    },
    (t) => [
        index("idx_det_prod_produccion_id").on(t.produccionId),
        index("idx_det_prod_insumo_id").on(t.insumoId),
    ],
);

/* ---------- Gastos ---------- */
export const gastos = pgTable(
    "gastos",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        fecha: timestamp("fecha", { precision: 6 }).notNull(),
        monto: money("monto").notNull(),
        categoria: varchar("categoria", { length: 30, enum: CATEGORIAS_GASTO }).notNull(),
        descripcion: varchar("descripcion", { length: 150 }).notNull(),
        produccionId: bigint("produccion_id", { mode: "number" }).references(() => producciones.id),
    },
    (t) => [
        index("idx_gastos_fecha").on(t.fecha),
        index("idx_gastos_categoria").on(t.categoria),
        index("idx_gastos_produccion_id").on(t.produccionId),
    ],
);

/* ---------- Ajustes de inventario ---------- */
export const ajustesInventario = pgTable(
    "ajustes_inventario",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        insumoId: bigint("insumo_id", { mode: "number" })
            .notNull()
            .references(() => insumos.id),
        delta: qty4("delta").notNull(),
        stockResultante: qty4("stock_resultante").notNull(),
        valor: money("valor").notNull(),
        motivo: varchar("motivo", { length: 150 }).notNull(),
        usuario: varchar("usuario", { length: 60 }).notNull(),
        fecha: timestamp("fecha", { precision: 6 }).notNull(),
    },
    (t) => [index("idx_ajustes_insumo_id").on(t.insumoId), index("idx_ajustes_fecha").on(t.fecha)],
);

/* ---------- Alertas del motor de análisis ---------- */
export const alertas = pgTable(
    "alertas",
    {
        id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
        /** Identifica la regla y su sujeto (ej. "food-cost:3"). */
        clave: varchar("clave", { length: 80 }).notNull().unique(),
        nivel: varchar("nivel", { length: 10, enum: ["alto", "medio", "info"] }).notNull(),
        titulo: varchar("titulo", { length: 120 }).notNull(),
        detalle: varchar("detalle", { length: 500 }).notNull(),
        accion: varchar("accion", { length: 160 }).notNull(),
        href: varchar("href", { length: 160 }),
        /** Datos que originaron la alerta (precio sugerido, producto, montos...). */
        metricas: jsonb("metricas").$type<Record<string, number | string>>(),
        estado: varchar("estado", { length: 12, enum: ["activa", "resuelta", "descartada"] })
            .notNull()
            .default("activa"),
        creadaEn: timestamp("creada_en", { precision: 6 }).notNull(),
        actualizadaEn: timestamp("actualizada_en", { precision: 6 }).notNull(),
        descartadaEn: timestamp("descartada_en", { precision: 6 }),
    },
    (t) => [index("idx_alertas_estado").on(t.estado, t.nivel)],
);

/* ---------- Configuración del negocio ---------- */
export const configuracionNegocio = pgTable("configuracion_negocio", {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    nombreComercial: varchar("nombre_comercial", { length: 80 }).notNull(),
    identificacionFiscal: varchar("identificacion_fiscal", { length: 40 }),
    telefono: varchar("telefono", { length: 30 }),
    direccion: varchar("direccion", { length: 150 }),
    impuestoPorcentaje: numeric("impuesto_porcentaje", { precision: 5, scale: 2, mode: "number" })
        .notNull()
        .default(0),
    mensajeRecibo: varchar("mensaje_recibo", { length: 250 }),
    /** Comisión que cobra la app de domicilios; se aplica al canal APP. */
    comisionAppPct: numeric("comision_app_pct", { precision: 5, scale: 2, mode: "number" })
        .notNull()
        .default(0),
    /** Umbrales que usa el motor de alertas para decidir. */
    objetivoFoodCost: numeric("objetivo_food_cost", { precision: 5, scale: 2, mode: "number" })
        .notNull()
        .default(35),
    metaTicket: money("meta_ticket").notNull().default(25000),
    logoUrl: varchar("logo_url", { length: 250 }),
    actualizadoEn: timestamp("actualizado_en", { precision: 6 }).notNull(),
});

/* ---------- Relaciones (para db.query) ---------- */
export const productosRelations = relations(productos, ({ one, many }) => ({
    receta: one(recetas, { fields: [productos.recetaId], references: [recetas.id] }),
    detalles: many(detalleVentas),
}));

export const recetasRelations = relations(recetas, ({ many, one }) => ({
    detalles: many(detalleRecetas),
    insumoProducido: one(insumos, {
        fields: [recetas.insumoProducidoId],
        references: [insumos.id],
    }),
}));

export const insumosRelations = relations(insumos, ({ many }) => ({
    detallesReceta: many(detalleRecetas),
    ajustes: many(ajustesInventario),
}));

export const ventasRelations = relations(ventas, ({ many, one }) => ({
    detalles: many(detalleVentas),
    abonos: many(abonos),
    cliente: one(clientes, { fields: [ventas.clienteId], references: [clientes.id] }),
    jornada: one(jornadas, { fields: [ventas.jornadaId], references: [jornadas.id] }),
}));

export const detalleVentasRelations = relations(detalleVentas, ({ one }) => ({
    venta: one(ventas, { fields: [detalleVentas.ventaId], references: [ventas.id] }),
    producto: one(productos, { fields: [detalleVentas.productoId], references: [productos.id] }),
}));

export const detalleRecetasRelations = relations(detalleRecetas, ({ one }) => ({
    receta: one(recetas, { fields: [detalleRecetas.recetaId], references: [recetas.id] }),
    insumo: one(insumos, { fields: [detalleRecetas.insumoId], references: [insumos.id] }),
}));

export const detalleProduccionesRelations = relations(detalleProducciones, ({ one }) => ({
    produccion: one(producciones, {
        fields: [detalleProducciones.produccionId],
        references: [producciones.id],
    }),
    insumo: one(insumos, {
        fields: [detalleProducciones.insumoId],
        references: [insumos.id],
    }),
}));

export type Usuario = typeof usuarios.$inferSelect;
export type Producto = typeof productos.$inferSelect;
export type Insumo = typeof insumos.$inferSelect;
export type Receta = typeof recetas.$inferSelect;
export type Venta = typeof ventas.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type Gasto = typeof gastos.$inferSelect;
export type Extra = typeof extras.$inferSelect;
export type Alerta = typeof alertas.$inferSelect;
