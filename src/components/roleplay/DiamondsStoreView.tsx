import { FC, useEffect, useMemo, useRef, useState } from "react";
import "./DiamondStoreView.scss";

type Package = {
    id: number;
    diamonds: number;
    bonus?: number;
    priceUSD: number;
    best?: boolean;
};

const DIAMOND_PACKS: Package[] = [
    { id: 1, diamonds: 100, priceUSD: 4.99 },
    { id: 2, diamonds: 250, priceUSD: 9.99, bonus: 25 },
    { id: 3, diamonds: 600, priceUSD: 19.99, bonus: 100 },
    { id: 4, diamonds: 1500, priceUSD: 44.99, bonus: 400, best: true },
];

interface DiamondsStoreViewProps {
    onClose: () => void;
    initial?: { x: number; y: number };
    width?: number;
    height?: number | "auto";
}

export const DiamondsStoreView: FC<DiamondsStoreViewProps> = ({
    onClose,
    initial,
    width = 520,
    height = 560,
}) => {
    const packs = useMemo(() => DIAMOND_PACKS, []);
    const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
        x: initial?.x ?? 12,
        y: initial?.y ?? 80,
    }));

    // --- drag (header is handle)
    const drag = useRef({ on: false, dx: 0, dy: 0 });
    const onHeaderDown = (e: React.MouseEvent) => {
        drag.current.on = true;
        drag.current.dx = e.clientX - pos.x;
        drag.current.dy = e.clientY - pos.y;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
        if (!drag.current.on) return;
        const nx = e.clientX - drag.current.dx;
        const ny = e.clientY - drag.current.dy;
        setPos({
            x: Math.min(Math.max(0, nx), window.innerWidth - (width as number)),
            y: Math.min(Math.max(0, ny), window.innerHeight - 40),
        });
    };
    const onUp = () => {
        drag.current.on = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
    };

    useEffect(() => {
        const onResize = () =>
            setPos((p) => ({
                x: Math.min(
                    p.x,
                    Math.max(0, window.innerWidth - (width as number))
                ),
                y: Math.min(p.y, Math.max(0, window.innerHeight - 40)),
            }));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [width]);

    const buy = (p: Package) => {
        window.dispatchEvent(
            new CustomEvent("diamonds_purchase_request", { detail: p })
        );
        // Or use your purchase composer here.
    };

    return (
        <div
            className="ds-window"
            style={{ left: pos.x, top: pos.y, width, height }}
        >
            {/* Title bar (drag handle) */}
            <div className="ds-window__header" onMouseDown={onHeaderDown}>
                <div className="ds-window__title">
                    <i className="ico ico-diamond" />
                    <span>Diamond Store</span>
                </div>
                <button
                    className="ds-window__close"
                    aria-label="Close"
                    title="Close"
                    onClick={onClose}
                />
            </div>

            {/* Body (sidebar + content) */}
            <div className="ds-window__body">
                <aside className="ds-window__sidebar">
                    <button className="ds-tab ds-tab--active">
                        <i className="ico ico-diamond" />
                        <span>Diamond Store</span>
                    </button>
                </aside>

                <section className="ds-window__content">
                    <div className="ds-packs">
                        {packs.map((p) => (
                            <div
                                key={p.id}
                                className={`ds-pack${p.best ? " is-best" : ""}`}
                            >
                                {p.best && (
                                    <div className="ds-pack__badge">
                                        Best Value
                                    </div>
                                )}

                                <div className="ds-pack__top">
                                    <i className="ico ico-diamond" />
                                    <div className="ds-pack__title">
                                        {p.diamonds.toLocaleString()} Diamonds{" "}
                                        {p.bonus ? (
                                            <span className="ds-pack__bonus">
                                                +{p.bonus.toLocaleString()}{" "}
                                                bonus
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="ds-pack__bottom">
                                    <div className="ds-pack__price">
                                        ${p.priceUSD.toFixed(2)}
                                    </div>
                                    <button
                                        className="ds-pack__buy"
                                        onClick={() => buy(p)}
                                    >
                                        Buy
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="ds-fineprint">
                        Purchases are delivered instantly after payment is
                        confirmed. Prices shown in USD. Taxes may apply.
                    </div>
                </section>
            </div>
        </div>
    );
};

export default DiamondsStoreView;
