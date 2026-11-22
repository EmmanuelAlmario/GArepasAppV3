"use client";

import { useFormStatus } from "react-dom";

type Props = {
    children: React.ReactNode;
    /** Si llega, se pide confirmación antes de enviar. */
    mensaje?: string;
    className?: string;
};

/** Botón de envío para formularios con server action: confirma y bloquea al enviar. */
export default function BotonConfirmar({ children, mensaje, className }: Props) {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className={className}
            onClick={(evento) => {
                if (mensaje && !window.confirm(mensaje)) evento.preventDefault();
            }}
        >
            {children}
        </button>
    );
}
