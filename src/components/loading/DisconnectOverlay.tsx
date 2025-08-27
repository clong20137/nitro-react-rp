import { FC, useEffect, useMemo, useState } from "react";
import { LayoutProgressBar, Base, Column, Text } from "../../common";
import "./DisconnectOverlay.scss";

const DURATION = 15_000; // 15s

interface Props {
    show: boolean;
    onReload: () => void;
    onCancel?: () => void; // optional if you want a cancel button
}

export const DisconnectOverlay: FC<Props> = ({ show, onReload, onCancel }) => {
    const [leftMs, setLeftMs] = useState(DURATION);

    // tick when shown
    useEffect(() => {
        if (!show) return;
        setLeftMs(DURATION);
        const started = performance.now();

        let raf = 0;
        const loop = (now: number) => {
            const elapsed = now - started;
            const remain = Math.max(0, DURATION - elapsed);
            setLeftMs(remain);
            if (remain <= 0) {
                onReload();
                return;
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [show, onReload]);

    const percent = useMemo(
        () => Math.min(100, Math.round(((DURATION - leftMs) / DURATION) * 100)),
        [leftMs]
    );

    if (!show) return null;

    const seconds = Math.ceil(leftMs / 1000);

    return (
        <div className="oly-disconnect">
            <div className="oly-dim" />
            <div className="oly-panel">
                <Text fontSize={3} variant="white" className="text-shadow mb-2">
                    Whoops! It seems like you have been disconnected…
                </Text>

                <div className="oly-bar-wrap">
                    <LayoutProgressBar
                        progress={percent}
                        className="large oly-progress gold"
                    />
                    <div className="oly-count">{seconds}s</div>
                </div>

                <div className="oly-actions">
                    <button className="oly-btn primary" onClick={onReload}>
                        Reload now
                    </button>
                    {onCancel && (
                        <button className="oly-btn ghost" onClick={onCancel}>
                            Cancel auto-reload
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DisconnectOverlay;
