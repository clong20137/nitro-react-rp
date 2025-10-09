import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./SettingsView.scss";

type Props = { onClose: () => void };

const POS_KEY = "olrp.settings.pos";
const LIVE_KEY = "liveFeedEnabled";
const INVITE_KEY = "gangInvitesEnabled";
const CTX_KEY = "contextMenuDisabled";

const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

export const SettingsView: FC<Props> = ({ onClose }) => {
    // model
    const [liveFeed, setLiveFeed] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem(LIVE_KEY) ?? "true")
    );
    const [gangInvites, setGangInvites] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem(INVITE_KEY) ?? "true")
    );
    const [contextMenuDisabled, setContextMenuDisabled] = useState<boolean>(
        () => JSON.parse(localStorage.getItem(CTX_KEY) ?? "false")
    );

    // UI
    const [entering, setEntering] = useState(true);

    // drag state
    const rootRef = useRef<HTMLDivElement | null>(null);
    const dragStart = useRef<{
        mx: number;
        my: number;
        left: number;
        top: number;
    } | null>(null);

    // restore position (near top-right if none saved)
    useLayoutEffect(() => {
        if (!rootRef.current) return;
        const saved = localStorage.getItem(POS_KEY);
        const rect = rootRef.current.getBoundingClientRect();
        const vw = window.innerWidth,
            vh = window.innerHeight;

        if (saved) {
            const { left, top } = JSON.parse(saved);
            rootRef.current.style.left =
                clamp(left, 8, vw - rect.width - 8) + "px";
            rootRef.current.style.top =
                clamp(top, 8, vh - rect.height - 8) + "px";
        } else {
            // default: tuck under right mini bar
            const rightPad = 16,
                topPad = 90;
            rootRef.current.style.left = `calc(100vw - ${
                rect.width + rightPad
            }px)`;
            rootRef.current.style.top = `${topPad}px`;
        }
    }, []);

    // close on ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // drag handlers (mouse + touch)
    const beginDrag = (clientX: number, clientY: number) => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        dragStart.current = {
            mx: clientX,
            my: clientY,
            left: rect.left,
            top: rect.top,
        };
    };

    const onMove = (clientX: number, clientY: number) => {
        if (!dragStart.current || !rootRef.current) return;
        const dx = clientX - dragStart.current.mx;
        const dy = clientY - dragStart.current.my;

        const rect = rootRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const left = clamp(dragStart.current.left + dx, 8, vw - rect.width - 8);
        const top = clamp(dragStart.current.top + dy, 8, vh - rect.height - 8);

        rootRef.current.style.left = left + "px";
        rootRef.current.style.top = top + "px";
    };

    const endDrag = () => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        localStorage.setItem(
            POS_KEY,
            JSON.stringify({ left: rect.left, top: rect.top })
        );
        dragStart.current = null;
    };

    // mouse
    const onHeaderMouseDown = (e: React.MouseEvent) => {
        // only left click
        if (e.button !== 0) return;
        beginDrag(e.clientX, e.clientY);
    };
    useEffect(() => {
        const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
        const mu = () => endDrag();
        window.addEventListener("mousemove", mm);
        window.addEventListener("mouseup", mu);
        return () => {
            window.removeEventListener("mousemove", mm);
            window.removeEventListener("mouseup", mu);
        };
    }, []);

    // touch
    const onHeaderTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        beginDrag(t.clientX, t.clientY);
    };
    useEffect(() => {
        const tm = (e: TouchEvent) => {
            const t = e.touches[0];
            if (t) onMove(t.clientX, t.clientY);
        };
        const tu = () => endDrag();
        window.addEventListener("touchmove", tm, { passive: false });
        window.addEventListener("touchend", tu);
        window.addEventListener("touchcancel", tu);
        return () => {
            window.removeEventListener("touchmove", tm);
            window.removeEventListener("touchend", tu);
            window.removeEventListener("touchcancel", tu);
        };
    }, []);

    const handleClose = () => {
        setEntering(false);
        setTimeout(onClose, 220);
    };

    const handleSave = () => {
        localStorage.setItem(LIVE_KEY, JSON.stringify(liveFeed));
        localStorage.setItem(INVITE_KEY, JSON.stringify(gangInvites));
        localStorage.setItem(CTX_KEY, JSON.stringify(contextMenuDisabled));

        window.dispatchEvent(
            new CustomEvent("toggleLiveFeed", { detail: { enabled: liveFeed } })
        );
        window.dispatchEvent(
            new CustomEvent("toggleGangInvites", {
                detail: { enabled: gangInvites },
            })
        );
        window.dispatchEvent(
            new CustomEvent("toggleContextMenu", {
                detail: { disabled: contextMenuDisabled },
            })
        );

        handleClose();
    };

    return (
        <div
            ref={rootRef}
            className={`olrp-settings ${
                entering ? "is-entering" : "is-exiting"
            }`}
            role="dialog"
            aria-label="Settings"
        >
            <div
                className="olrp-settings__header"
                onMouseDown={onHeaderMouseDown}
                onTouchStart={onHeaderTouchStart}
            >
                <span>Settings</span>
                <button
                    className="olrp-iconbtn"
                    onClick={handleClose}
                    aria-label="Close settings"
                >
                    ×
                </button>
            </div>

            <div className="olrp-settings__body">
                <section className="olrp-setting">
                    <div className="olrp-setting__copy">
                        <div className="title">Live Feed</div>
                        <div className="sub">
                            Show live events and alerts in the feed.
                        </div>
                    </div>
                    <Toggle
                        checked={liveFeed}
                        onChange={setLiveFeed}
                        ariaLabel="Toggle live feed"
                    />
                </section>

                <section className="olrp-setting">
                    <div className="olrp-setting__copy">
                        <div className="title">Gang Invites</div>
                        <div className="sub">
                            Allow other players to invite you to gangs.
                        </div>
                    </div>
                    <Toggle
                        checked={gangInvites}
                        onChange={setGangInvites}
                        ariaLabel="Toggle gang invites"
                    />
                </section>

                <section className="olrp-setting">
                    <div className="olrp-setting__copy">
                        <div className="title">Disable Context Menu</div>
                        <div className="sub">
                            Turn off right-click menus for a cleaner UI.
                        </div>
                    </div>
                    <Toggle
                        checked={contextMenuDisabled}
                        onChange={setContextMenuDisabled}
                        ariaLabel="Disable context menus"
                    />
                </section>

                <div className="olrp-actions">
                    <Button kind="confirm" onClick={handleSave}>
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
};

/* ---------- Reusable Toggle ---------- */
const Toggle: FC<{
    checked: boolean;
    onChange: (v: boolean) => void;
    ariaLabel?: string;
}> = ({ checked, onChange, ariaLabel }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className={`olrp-toggle ${checked ? "on" : "off"}`}
        onClick={() => onChange(!checked)}
    >
        <span className="track" />
        <span className="thumb" />
    </button>
);

/* ---------- Reusable Button ---------- */
const Button: FC<{
    kind?: "primary" | "confirm" | "danger";
    onClick?: () => void;
    children: any;
}> = ({ kind = "primary", onClick, children }) => (
    <button className={`olrp-btn olrp-btn--${kind}`} onClick={onClick}>
        {children}
    </button>
);

export default SettingsView;
