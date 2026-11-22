export type PasoTour = {
    id: string;
    titulo: string;
    texto: string;
    /** Pantalla donde vive el paso. */
    href: string;
    /** Selector del elemento a iluminar; sin selector, tarjeta centrada. */
    selector?: string;
};

/**
 * Recorrido de bienvenida. Es la guía que se le entrega al cliente:
 * cada paso explica una pantalla real y resalta el elemento del que habla.
 */
export const PASOS: PasoTour[] = [
    {
        id: "bienvenida",
        titulo: "Esto es la consola de Gordo Arepa",
        texto: "Aquí se lleva la caja, la producción, el inventario y los márgenes. Son 5 minutos y queda guardado tu avance.",
        href: "/",
    },
    {
        id: "menu",
        titulo: "El menú está agrupado por tarea",
        texto: "Caja para vender, Producción para fabricar, Catálogo para precios y recetas, Cartera para fiados y Análisis para decidir. No hay que memorizar nada.",
        href: "/",
        selector: '[data-tour="menu"]',
    },
    {
        id: "hoy",
        titulo: "Al entrar ves el día, no un tablero vacío",
        texto: "Ventas de hoy, lo que falta cobrar, insumos bajo mínimo y producción pendiente. Si algo requiere acción, aparece arriba.",
        href: "/",
        selector: '[data-tour="hoy"]',
    },
    {
        id: "alertas",
        titulo: "El sistema te dice qué hacer",
        texto: "Estas alertas se recalculan solas cada vez que cambian las ventas: food cost alto, comisión de la app, cartera vencida, días flojos.",
        href: "/",
        selector: '[data-tour="alertas"]',
    },
    {
        id: "vender",
        titulo: "Vender: toca el producto y arma el pedido",
        texto: "El buscador acepta texto y Enter agrega el primero. Cada ítem admite nota y extras con precio. El stock baja al cobrar.",
        href: "/pos",
        selector: '[data-tour="catalogo"]',
    },
    {
        id: "cobro",
        titulo: "Cobrar: efectivo, devuelta y canal",
        texto: "Los billetes suman al tocarlos. Escribe el recibido y la devuelta se calcula. El canal define la comisión que se descuenta del margen.",
        href: "/pos",
        selector: '[data-tour="cobro"]',
    },
    {
        id: "jornada",
        titulo: "Abrir y cerrar la caja con arqueo",
        texto: "Al abrir se registra el fondo. Al cerrar se cuenta el efectivo, se restan los retiros y el sistema guarda la diferencia del día.",
        href: "/pos",
        selector: '[data-tour="jornada"]',
    },
    {
        id: "producir",
        titulo: "Producir descuenta insumos y suma stock",
        texto: "Si falta materia prima, la producción queda pendiente y no descuenta nada. Cuando repones, se re-verifica y se completa.",
        href: "/producciones",
        selector: '[data-tour="produccion"]',
    },
    {
        id: "insumos",
        titulo: "Inventario con precios reales",
        texto: "Cada insumo guarda su precio por unidad base. La lista de compra sale de los que están bajo el mínimo y se envía por WhatsApp.",
        href: "/insumos",
        selector: '[data-tour="insumos"]',
    },
    {
        id: "clientes",
        titulo: "Fiados y abonos",
        texto: "La venta a crédito queda con saldo y vencimiento. Los abonos lo reducen y aquí ves quién debe y desde cuándo.",
        href: "/clientes",
        selector: '[data-tour="clientes"]',
    },
    {
        id: "analisis",
        titulo: "Decidir con números",
        texto: "Margen por producto, canal neto de comisión, horarios, cartera. Y cuando el sistema propone un precio, puedes aplicarlo en un clic.",
        href: "/analisis",
        selector: '[data-tour="decisiones"]',
    },
    {
        id: "roles",
        titulo: "Listo para operar",
        texto: "El dueño ve todo; la caja solo entra a Punto de venta, Clientes y recibos. Puedes repetir este tutorial desde el botón «Tutorial» cuando quieras.",
        href: "/analisis",
    },
];

export const CLAVE_TOUR = "garepas:tour";
