"use client";

import { useEffect, useState } from "react";
import Silk from "@/components/Silk";

/**
 * Fondo del login: satén en movimiento, en los colores de la marca.
 * Si el sistema pide menos movimiento, se pausa (queda el pliegue quieto).
 */
export default function FondoSilk() {
    const [quieto, setQuieto] = useState(false);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const aplicar = () => setQuieto(media.matches);
        aplicar();
        media.addEventListener("change", aplicar);
        return () => media.removeEventListener("change", aplicar);
    }, []);

    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <Silk
                color="#3a170a"
                sheenColor="#e2703a"
                speed={0.55}
                scale={1.35}
                noiseIntensity={0.55}
                rotation={0.35}
                sheen={1}
                depth={1.4}
                glow={0.8}
                ripple={0.7}
                wave={0.9}
                variation={0.4}
                mouseInteraction={!quieto}
                interactionStrength={1}
                clickRipple={!quieto}
                intro
                fade={1.6}
                paused={quieto}
                dpr={1}
            />
        </div>
    );
}
