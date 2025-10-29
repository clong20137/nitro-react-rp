import { FC, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    GetRoomObjectBounds,
    GetRoomObjectScreenLocation,
    GetRoomSession,
    GetTicker,
} from "../../api";
import "./AvatarGlowOverlay.scss";

type Props = {
    objectId: number; // room unit index
    autoHideMs?: number; // optional fade out
    onHide?: () => void;
    debug?: boolean; // shows a red box and logs every tick
};

export const AvatarGlowOverlay: FC<Props> = ({
    objectId,
    autoHideMs = 0,
    onHide,
    debug = false,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ x: number | null; y: number | null }>({
        x: null,
        y: null,
    });
    const [visible, setVisible] = useState<boolean>(objectId > -1);

    // follow like the context menu
    useEffect(() => {
        if (objectId < 0) {
            setVisible(false);
            setPos({ x: null, y: null });
            return;
        }

        setVisible(true);

        const ticker = GetTicker();
        const update = (dt: number) => {
            try {
                const session = GetRoomSession();
                if (!session) return;

                const bounds = GetRoomObjectBounds(
                    session.roomId,
                    objectId,
                    4 /* UNIT */
                );
                const loc = GetRoomObjectScreenLocation(
                    session.roomId,
                    objectId,
                    4 /* UNIT */
                );

                if (!bounds || !loc) {
                    if (debug)
                        console.warn("[Glow] No bounds/loc for", {
                            objectId,
                            bounds,
                            loc,
                        });
                    setVisible(false);
                    setPos({ x: null, y: null });
                    return;
                }

                // ensure element has a size (fallback size used if not mounted yet)
                const w = ref.current?.offsetWidth || 80;
                const h = ref.current?.offsetHeight || 110;

                const x = Math.floor(loc.x - w / 2);
                const y = Math.floor(loc.y - h + (bounds.height > 50 ? 6 : -6));

                setPos({ x, y });

                if (debug)
                    console.log("[Glow] tick", { objectId, x, y, bounds, loc });
            } catch (e) {
                if (debug) console.error("[Glow] tick error", e);
            }
        };

        ticker.add(update);
        return () => {
            ticker.remove(update);
        };
    }, [objectId, debug]);

    // auto-hide
    useEffect(() => {
        if (!visible || !autoHideMs) return;
        const t = setTimeout(() => {
            setVisible(false);
            onHide?.();
        }, autoHideMs);
        return () => clearTimeout(t);
    }, [visible, autoHideMs, onHide]);

    // ESC to hide
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setVisible(false);
                onHide?.();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onHide]);

    const style = useMemo(() => {
        if (pos.x === null) return { left: -99999, top: -99999 };
        return { left: pos.x, top: pos.y };
    }, [pos]);

    if (!visible) return null;

    // Portal ensures we’re above the canvas regardless of RoomView layout
    return createPortal(
        <div
            ref={ref}
            className={`avatar-glow-portal ${debug ? "debug" : ""}`}
            style={style}
        >
            <div className="glow glow--outer" />
            <div className="glow glow--inner" />
        </div>,
        document.body
    );
};

export default AvatarGlowOverlay;
