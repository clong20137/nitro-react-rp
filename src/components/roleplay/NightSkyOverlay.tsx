import { FC, useEffect, useMemo, useRef, useState } from "react";

type Phase = "DAY" | "DUSK" | "NIGHT" | "DAWN";

type Props = {
    phase: Phase;
    opacity: number; // 0..1, how strong the overlay is (we’ll map from your time)
    roomSeed?: number; // optional: stable per-room star pattern
    moonImageUrl?: string; // optional: custom moon sprite (PNG w/ alpha)
};

const STAR_COUNT = 180; // tweak
const TWINKLE_SPEED = 0.35; // tweak
const MOON_SIZE = 120; // px

// simple seeded RNG so stars are stable while you stay in the room
function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const NightSkyOverlay: FC<Props> = ({
    phase,
    opacity,
    roomSeed = 1337,
    moonImageUrl,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const moonRef = useRef<HTMLImageElement | null>(null);
    const rafRef = useRef<number>();

    // stars are generated once per mount or when roomSeed/size changes
    const stars = useMemo(() => {
        const { w, h } = size;
        const rand = mulberry32(roomSeed);
        return Array.from({ length: STAR_COUNT }, () => ({
            x: rand() * w,
            y: rand() * h * 0.6, // keep near “sky” area
            r: 0.6 + rand() * 1.4, // radius
            a: 0.4 + rand() * 0.6, // base alpha
            phase: rand() * Math.PI * 2, // twinkle seed
        }));
    }, [roomSeed, size.w, size.h]);

    // fit overlay to the room canvas container
    useEffect(() => {
        const parent =
            (document.querySelector(".nitro-room-view") as HTMLElement) ||
            (document.querySelector("#room-view") as HTMLElement) ||
            (canvasRef.current?.parentElement as HTMLElement);
        if (!parent) return;

        const measure = () =>
            setSize({ w: parent.clientWidth, h: parent.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(parent);
        return () => ro.disconnect();
    }, []);

    // draw loop
    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext("2d", { alpha: true });
        if (!ctx) return;

        let t = 0;
        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);
            const vis =
                phase === "NIGHT" || phase === "DUSK" || phase === "DAWN";
            if (!vis || opacity <= 0) {
                ctx.clearRect(0, 0, cvs.width, cvs.height);
                return;
            }

            cvs.width = size.w;
            cvs.height = size.h;

            // subtle night gradient backdrop
            const g = ctx.createLinearGradient(0, 0, 0, cvs.height);
            g.addColorStop(0, `rgba(10, 10, 22, ${0.65 * opacity})`);
            g.addColorStop(1, `rgba(10, 10, 22, ${0.3 * opacity})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, cvs.width, cvs.height);

            // stars (twinkle)
            ctx.save();
            for (const s of stars) {
                const alpha =
                    s.a *
                    (0.6 + 0.4 * Math.sin(t * TWINKLE_SPEED + s.phase)) *
                    opacity;
                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = "#FFFFFF";
                ctx.fill();
            }
            ctx.restore();

            // moon (simple parallax arc across the top)
            if (moonRef.current) {
                const img = moonRef.current;
                const trackY = cvs.height * 0.12;
                // fraction of night across virtual time (we’ll just move slowly using t)
                const fx = (t * 0.003) % 1;
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

    // hide completely during full day for perf
    const visible = phase === "NIGHT" || phase === "DUSK" || phase === "DAWN";

    return (
        <>
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    opacity: visible ? 1 : 0,
                    transition: "opacity 300ms ease",
                }}
            />
            {/* preload moon image (optional) */}
            {moonImageUrl && (
                <img
                    ref={moonRef}
                    src={moonImageUrl}
                    alt=""
                    style={{ display: "none" }}
                />
            )}
        </>
    );
};
