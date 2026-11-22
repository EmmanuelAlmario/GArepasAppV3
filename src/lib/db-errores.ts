/**
 * postgres.js envuelve los errores (DrizzleQueryError): el código de
 * PostgreSQL vive en `cause`. 23505 = violación de unique.
 */
export function codigoPg(error: unknown): string | undefined {
    let actual: unknown = error;
    for (let i = 0; i < 3 && actual; i++) {
        if (typeof actual === "object" && actual !== null && "code" in actual) {
            const codigo = (actual as { code?: unknown }).code;
            if (typeof codigo === "string") return codigo;
        }
        actual = (actual as { cause?: unknown }).cause;
    }
    return undefined;
}

export const esDuplicado = (error: unknown) => codigoPg(error) === "23505";
