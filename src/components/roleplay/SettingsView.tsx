import { FC, useEffect, useRef, useState } from "react";
import "./SettingsView.scss";

type Props = { onClose: () => void };

export const SettingsView: FC<Props> = ({ onClose }) => {
    // model
    const [liveFeed, setLiveFeed] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem("liveFeedEnabled") ?? "true")
    );
    const [gangInvites, setGangInvites] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem("gangInvitesEnabled") ?? "true")
    );
    const [contextMenuDisabled, setContextMenuDisabled] = useState<boolean>(
        () => JSON.parse(localStorage.getItem("contextMenuDisabled") ?? "false")
    );

    // mount anim
    const [open, setOpen] = useState(true);

    // draggable (kept, but optional — users can still move it)
    const rootRef = useRef<HTMLDivElement | null>(null);
    const startMouse = useRef<{ x: number; y: number } | null>(null);
    const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const [offset, setOffset] = useState<{ x: number; y: number }>({
        x: 0,
        y: 0,
    });

    useEffect(() => {
        // start near top-right, just under the mini bar
        // (tweak these if you change your right-side UI height)
        const TOP = 90; // ~just below .rs-mini
        const RIGHT = 16; // snug to edge
        if (!rootRef.current) return;
        const w = rootRef.current.getBoundingClientRect().width || 360;
        rootRef.current.style.left = `calc(100vw - ${w + RIGHT}px)`;
        rootRef.current.style.top = `${TOP}px`;
    }, []);

    // drag
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!startMouse.current) return;
            const dx = e.clientX - startMouse.current.x;
            const dy = e.clientY - startMouse.current.y;
            setOffset({ x: dx, y: dy });
        };
        const onUp = () => (startMouse.current = null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, []);

    const beginDrag = (e: React.MouseEvent) => {
        if (!rootRef.current) return;
        const r = rootRef.current.getBoundingClientRect();
        startPos.current = { x: r.left, y: r.top };
        startMouse.current = { x: e.clientX, y: e.clientY };
    };

    // persist + broadcast
    const save = () => {
        localStorage.setItem("liveFeedEnabled", JSON.stringify(liveFeed));
        localStorage.setItem("gangInvitesEnabled", JSON.stringify(gangInvites));
        localStorage.setItem(
            "contextMenuDisabled",
            JSON.stringify(contextMenuDisabled)
        );

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

        setOpen(false);
        // let the exit animation finish
        setTimeout(onClose, 220);
    };

    return (
        <div
            ref={rootRef}
            className={`settings-view ${open ? "enter-tr" : "exit-tr"}`}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
            role="dialog"
            aria-label="Settings"
        >
            <div className="settings-header" onMouseDown={beginDrag}>
                <span>Settings</span>
                <button
                    className="close-button"
                    onClick={() => {
                        setOpen(false);
                        setTimeout(onClose, 220);
                    }}
                    aria-label="Close settings"
                >
                    ×
                </button>
            </div>

            <div className="settings-body">
                <section className="setting-row">
                    <div className="setting-copy">
                        <div className="setting-title">Live Feed</div>
                        <div className="setting-sub">
                            Show live events and alerts in the feed.
                        </div>
                    </div>
                    <Toggle
                        checked={liveFeed}
                        onChange={setLiveFeed}
                        ariaLabel="Toggle live feed"
                    />
                </section>

                <section className="setting-row">
                    <div className="setting-copy">
                        <div className="setting-title">Gang Invites</div>
                        <div className="setting-sub">
                            Allow other players to invite you to gangs.
                        </div>
                    </div>
                    <Toggle
                        checked={gangInvites}
                        onChange={setGangInvites}
                        ariaLabel="Toggle gang invites"
                    />
                </section>

                <section className="setting-row">
                    <div className="setting-copy">
                        <div className="setting-title">
                            Disable Context Menu
                        </div>
                        <div className="setting-sub">
                            Turn off right-click menus for a cleaner UI.
                        </div>
                    </div>
                    <Toggle
                        checked={contextMenuDisabled}
                        onChange={setContextMenuDisabled}
                        ariaLabel="Disable context menus"
                    />
                </section>

                <div className="actions">
                    <button
                        className="habbo-action-button green"
                        onClick={save}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

/* --- Pixel-style Toggle -------------------------------------------------- */
const Toggle: FC<{
    checked: boolean;
    onChange: (v: boolean) => void;
    ariaLabel?: string;
}> = ({ checked, onChange, ariaLabel }) => {
    return (
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
};

export default SettingsView;
