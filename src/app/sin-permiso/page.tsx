import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function SinPermiso() {
    return (
        <main className="grid min-h-dvh place-items-center px-4">
            <div className="card max-w-sm p-6 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-warning-tint text-warning">
                    <ShieldAlert size={18} />
                </span>
                <h1 className="page-title mt-4 text-xl">Sección restringida</h1>
                <p className="page-sub mx-auto mt-1 text-center">
                    Tu usuario no tiene permisos para administrar esta parte de la consola.
                </p>
                <Link href="/" className="btn btn-primary mt-5 w-full">
                    Volver al inicio
                </Link>
            </div>
        </main>
    );
}
