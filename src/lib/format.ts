const cop = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

const fechaCorta = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
});

const fechaHora = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
});

export const money = (n: number | string | null | undefined) => cop.format(Number(n ?? 0));

/** Para costos unitarios pequeños (por gramo): conserva decimales. */
const copFino = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
});

export const moneyFino = (n: number | string | null | undefined) => {
    const valor = Number(n ?? 0);
    return Math.abs(valor) < 1000 ? copFino.format(valor) : cop.format(valor);
};
export const fecha = (d: Date | string | null | undefined) =>
    d ? fechaCorta.format(new Date(d)) : "—";
export const fechaHoraCorta = (d: Date | string | null | undefined) =>
    d ? fechaHora.format(new Date(d)) : "—";

/** Cantidad con hasta 4 decimales, sin ceros de relleno (gramos, kilos...). */
export const cantidad = (n: number | string | null | undefined) =>
    new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 }).format(Number(n ?? 0));
