import { FC, useEffect, useMemo, useRef, useState } from "react";

type Phase = "DAY" | "DUSK" | "NIGHT" | "DAWN";

type Props = {
    container: HTMLElement | null; // the element that contains the Nitro canvas
    phase: Phase;
    opacity: number; // 0..1
    roomSeed?: number; // for stable star patterns
    moonImageUrl?: string; // optional PNG with alpha
};

const STAR_COUNT = 160;
const TWINKLE_SPEED = 0.35;
const MOON_SIZE = 110;

// tiny seeded RNG (stable stars while you’re in the room)
function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const NightSkyOverlay: FC<Props> = ({
    container,
    phase,
    opacity,
    roomSeed = 1337,
    moonImageUrl,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const moonRef = useRef<HTMLImageElement | null>(null);
    const rafRef = useRef<number>();

    // keep the canvas sized to the container
    useEffect(() => {
        if (!container) return;
        const measure = () =>
            setSize({ w: container.clientWidth, h: container.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(container);
        return () => ro.disconnect();
    }, [container]);

    // stars are generated once per (roomSeed, size)
    const stars = useMemo(() => {
        const { w, h } = size;
        const rnd = mulberry32(roomSeed);
        return Array.from({ length: STAR_COUNT }, () => ({
            x: rnd() * w,
            y: rnd() * h * 0.6, // top ~60% (sky)
            r: 0.6 + rnd() * 1.3, // radius
            a: 0.45 + rnd() * 0.5, // base alpha
            p: rnd() * Math.PI * 2, // twinkle phase
        }));
    }, [roomSeed, size.w, size.h]);

    // draw loop
    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext("2d", { alpha: true });
        if (!ctx) return;

        let t = 0;
        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);

            const show =
                phase === "NIGHT" || phase === "DUSK" || phase === "DAWN";
            if (!show || opacity <= 0 || size.w === 0 || size.h === 0) {
                ctx.clearRect(0, 0, cvs.width, cvs.height);
                return;
            }

            if (cvs.width !== size.w || cvs.height !== size.h) {
                cvs.width = size.w;
                cvs.height = size.h;
            }

            // subtle night gradient
            const g = ctx.createLinearGradient(0, 0, 0, cvs.height);
            g.addColorStop(0, `rgba(10, 12, 22, ${0.55 * opacity})`);
            g.addColorStop(1, `rgba(10, 10, 18, ${0.28 * opacity})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, cvs.width, cvs.height);

            // stars
            ctx.save();
            for (const s of stars) {
                const a =
                    s.a *
                    (0.65 + 0.35 * Math.sin(t * TWINKLE_SPEED + s.p)) *
                    opacity;
                ctx.globalAlpha = Math.max(0, Math.min(1, a));
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = "#FFFFFF";
                ctx.fill();
            }
            ctx.restore();

            // moon drifting across the top arc
            if (moonRef.current) {
                const img = moonRef.current;
                const trackY = cvs.height * 0.12;
                const fx = (t * 0.003) % 1; // slow movement
                const x = (cvs.width + MOON_SIZE) * fx - MOON_SIZE;
                const y = trackY + Math.sin(fx * Math.PI) * (cvs.height * 0.06);

                ctx.globalAlpha = 0.85 * opacity;
                ctx.drawImage(img, x, y, MOON_SIZE, MOON_SIZE);
            }

            t += 1;
        };

        draw();
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [phase, opacity, stars, size.w, size.h]);

    // preload moon image
    useEffect(() => {
        if (!moonImageUrl) return;
        const img = new Image();
        img.src = moonImageUrl;
        moonRef.current = img;
    }, [moonImageUrl]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity:
                    phase === "NIGHT" || phase === "DUSK" || phase === "DAWN"
                        ? 1
                        : 0,
                transition: "opacity 250ms ease",
            }}
        />
    );
};
