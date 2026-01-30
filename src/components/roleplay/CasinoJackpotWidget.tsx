import { FC, useEffect, useMemo, useState } from "react";
import "./CasinoJackpotWidget.scss";

/**
 * Floating casino jackpot widget.
 * - Named export (fixes "is not a module")
 * - Safe to import with { CasinoJackpotWidget }
 * - Visibility controlled by virtual room id (24)
 */

const clamp = (n: number) =>
    Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;

export const CasinoJackpotWidget: FC = () => {
    const [virtualRoomId, setVirtualRoomId] = useState<number | null>(null);
    const [amount, setAmount] = useState<number>(0);

    /* Listen for virtual room changes */
    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{ virtualRoomId?: number }>;
            const vId = custom.detail?.virtualRoomId;
            if (typeof vId === "number") setVirtualRoomId(vId);
        };

        window.addEventListener(
            "virtual_room_status",
            handler as EventListener
        );
        window.addEventListener(
            "virtual_room_info_update",
            handler as EventListener
        );

        return () => {
            window.removeEventListener(
                "virtual_room_status",
                handler as EventListener
            );
            window.removeEventListener(
                "virtual_room_info_update",
                handler as EventListener
            );
        };
    }, []);

    /* Listen for jackpot updates */
    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{ amount?: number }>;
            setAmount(clamp(Number(custom.detail?.amount ?? 0)));
        };

        window.addEventListener(
            "casino_jackpot_update",
            handler as EventListener
        );
        return () =>
            window.removeEventListener(
                "casino_jackpot_update",
                handler as EventListener
            );
    }, []);

    /* Only show in casino virtual room */
    if (virtualRoomId !== 24) return null;

    return (
        <div className="casino-jackpot-widget">
            <div className="casino-jackpot-inner">
                <span className="casino-jackpot-star">★</span>
                <span className="casino-jackpot-title">JACKPOT</span>
                <Odometer value={amount} />
            </div>
        </div>
    );
};

/* ---------------- ODOMETER ---------------- */

const Odometer: FC<{ value: number }> = ({ value }) => {
    const digits = useMemo(() => String(value), [value]);

    const parts = useMemo(() => {
        const raw = digits.split("");
        const out: Array<{ t: "digit" | "comma"; v: string; k: string }> = [];
        let count = 0;

        for (let i = raw.length - 1; i >= 0; i--) {
            out.push({ t: "digit", v: raw[i], k: `d-${i}-${raw[i]}` });
            count++;
            if (count % 3 === 0 && i !== 0)
                out.push({ t: "comma", v: ",", k: `c-${i}` });
        }

        return out.reverse();
    }, [digits]);

    return (
        <div className="casino-odometer">
            {parts.map((p, idx) =>
                p.t === "comma" ? (
                    <span className="casino-odometer-sep" key={p.k}>
                        {p.v}
                    </span>
                ) : (
                    <DigitColumn
                        key={p.k}
                        digit={Number(p.v)}
                        delayMs={Math.min(160, idx * 16)}
                    />
                )
            )}
        </div>
    );
};

const DigitColumn: FC<{ digit: number; delayMs: number }> = ({
    digit,
    delayMs,
}) => {
    const style = useMemo(
        () => ({
            ["--target" as any]: digit,
            ["--delay" as any]: `${delayMs}ms`,
        }),
        [digit, delayMs]
    );

    return (
        <span className="casino-digit" style={style}>
            <span className="casino-digit-reel">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
                <span>8</span>
                <span>9</span>
            </span>
        </span>
    );
};
