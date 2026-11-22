"use client";

import { Printer } from "lucide-react";

export default function BotonImprimir() {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary"
        >
            <Printer size={16} /> Imprimir
        </button>
    );
}
