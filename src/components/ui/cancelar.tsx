"use client";

/** Cancelar dentro de un diálogo lo cierra; en una página vuelve a la lista. */
export default function Cancelar({ href }: { href: string }) {
    return (
        <button
            type="button"
            className="btn btn-secondary"
            onClick={(evento) => {
                const dialogo = evento.currentTarget.closest("dialog");
                if (dialogo) dialogo.close();
                else window.location.assign(href);
            }}
        >
            Cancelar
        </button>
    );
}
