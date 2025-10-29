import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./SettingsView.scss";

type Props = { onClose: () => void };

// =================== storage keys ===================
const POS_KEY = "olrp.settings.pos";
const LIVE_KEY = "liveFeedEnabled";
const INVITE_KEY = "gangInvitesEnabled";
const CTX_KEY = "contextMenuDisabled";

// appearance
const APPEAR_TAB_KEY = "settings.activeTab";
const BUBBLE_STYLE_KEY = "chat.bubble.style"; // "classic" | "shout" | "whisper" | "rp" | "neon"
const BUBBLE_TINT_KEY = "chat.bubble.tint"; // hex string
const NAMEICON_KEY = "chat.nameicon.key"; // string (e.g. "12" or "crown_pink")
const NAMEICON_SHOW = "chat.nameicon.enabled"; // boolean

const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

// =================== API types ===================
type NameIcon = {
    id: number;
    key: string; // used to build image url
    title: string;
    price: number;
    staff_only: 0 | 1;
    vip_only: 0 | 1;
    enabled: 0 | 1;
    // (optional) url?: string // your API can also send the absolute url; if present we use it.
};

// You can host anywhere; server should translate `key` -> url.
// If your API already returns 'url', we use it; otherwise we build it with this prefix:
const NAME_ICON_ASSET_BASE = "/assets/nameicons/"; // e.g. nginx/static/cdn path

export const SettingsView: FC<Props> = ({ onClose }) => {
    // ===== model (General) =====
    const [liveFeed, setLiveFeed] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem(LIVE_KEY) ?? "true")
    );
    const [gangInvites, setGangInvites] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem(INVITE_KEY) ?? "true")
    );
    const [contextMenuDisabled, setContextMenuDisabled] = useState<boolean>(
        () => JSON.parse(localStorage.getItem(CTX_KEY) ?? "false")
    );

    // ===== UI =====
    const [entering, setEntering] = useState(true);
    const [activeTab, setActiveTab] = useState<"general" | "appearance">(
        (localStorage.getItem(APPEAR_TAB_KEY) as any) || "general"
    );

    // ===== drag state =====
    const rootRef = useRef<HTMLDivElement | null>(null);
    const dragStart = useRef<{
        mx: number;
        my: number;
        left: number;
        top: number;
    } | null>(null);

    // ===== Appearance state =====
    const [icons, setIcons] = useState<NameIcon[]>([]);
    const [iconsLoading, setIconsLoading] = useState<boolean>(false);
    const [iconsError, setIconsError] = useState<string | null>(null);

    const [bubbleStyle, setBubbleStyle] = useState<string>(
        localStorage.getItem(BUBBLE_STYLE_KEY) || "rp"
    );
    const [bubbleTint, setBubbleTint] = useState<string>(
        localStorage.getItem(BUBBLE_TINT_KEY) || "#e0e0e0"
    );
    const [showNameIcon, setShowNameIcon] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem(NAMEICON_SHOW) ?? "true")
    );
    const [selectedIconKey, setSelectedIconKey] = useState<string | null>(
        localStorage.getItem(NAMEICON_KEY)
    );

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
        if (e.button === 0) beginDrag(e.clientX, e.clientY);
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
            window.removeEventListener("touchmove", tm as any);
            window.removeEventListener("touchend", tu);
            window.removeEventListener("touchcancel", tu);
        };
    }, []);

    // persist active tab
    useEffect(() => {
        localStorage.setItem(APPEAR_TAB_KEY, activeTab);
    }, [activeTab]);

    // ===== fetch name icons from server =====
    useEffect(() => {
        if (activeTab !== "appearance") return;

        const run = async () => {
            try {
                setIconsLoading(true);
                setIconsError(null);

                // Adjust to your API route. Expecting JSON array of NameIcon rows.
                const res = await fetch("/api/name-icons");
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const list: NameIcon[] = await res.json();

                // filter enabled & sort (staff/vip first, then price asc)
                const enabled = list.filter((i) => i.enabled === 1);
                enabled.sort((a, b) => {
                    // staff first, then vip, then price, then title
                    const staffDelta = b.staff_only - a.staff_only;
                    if (staffDelta) return staffDelta;
                    const vipDelta = b.vip_only - a.vip_only;
                    if (vipDelta) return vipDelta;
                    const priceDelta = a.price - b.price;
                    if (priceDelta) return priceDelta;
                    return a.title.localeCompare(b.title);
                });

                setIcons(enabled);
            } catch (err: any) {
                setIconsError(err.message || "Failed to load icons");
            } finally {
                setIconsLoading(false);
            }
        };

        run();
    }, [activeTab]);

    const handleClose = () => {
        setEntering(false);
        setTimeout(onClose, 220);
    };

    const handleSave = async () => {
        // persist locally
        localStorage.setItem(LIVE_KEY, JSON.stringify(liveFeed));
        localStorage.setItem(INVITE_KEY, JSON.stringify(gangInvites));
        localStorage.setItem(CTX_KEY, JSON.stringify(contextMenuDisabled));

        localStorage.setItem(BUBBLE_STYLE_KEY, bubbleStyle);
        localStorage.setItem(BUBBLE_TINT_KEY, bubbleTint);
        localStorage.setItem(NAMEICON_KEY, selectedIconKey ?? "");
        localStorage.setItem(NAMEICON_SHOW, JSON.stringify(showNameIcon));

        // tell client
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

        // send to server (adjust endpoint/payload for your stack)
        try {
            await fetch("/api/settings/chat-appearance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bubbleStyle,
                    bubbleTint,
                    showNameIcon,
                    nameIconKey: selectedIconKey,
                }),
            });
        } catch {
            // swallow; local save still succeeds
        }

        handleClose();
    };

    // quick builders
    const buildIconUrl = (icon: NameIcon) =>
        (icon as any).url || `${NAME_ICON_ASSET_BASE}${icon.key}.png`;

    const tintChoices = [
        "#ffffff",
        "#f2f2f2",
        "#ffd17a",
        "#ff9b85",
        "#f26d6d",
        "#b34a9c",
        "#9b6bd4",
        "#7aa1ff",
        "#4b84ff",
        "#3ca9c9",
        "#40bf7a",
        "#2f9e59",
        "#9aa0a6",
        "#6b6b6b",
        "#3e3e3e",
        "#222222",
    ];

    const styleChoices: { id: string; label: string }[] = [
        { id: "classic", label: "Classic" },
        { id: "shout", label: "Shout" },
        { id: "whisper", label: "Whisper" },
        { id: "rp", label: "RP" },
        { id: "neon", label: "Neon" },
    ];

    return (
        <div
            ref={rootRef}
            className={`settings-root ${
                entering ? "is-entering" : "is-exiting"
            }`}
            role="dialog"
            aria-label="Settings"
        >
            <div
                className="settings-header"
                onMouseDown={onHeaderMouseDown}
                onTouchStart={onHeaderTouchStart}
            >
                <span>Settings</span>
                <button
                    className="settings-iconbtn"
                    onClick={handleClose}
                    aria-label="Close settings"
                >
                    ×
                </button>
            </div>

            {/* pills */}
            <div
                className="settings-tabs"
                role="tablist"
                aria-label="Settings tabs"
            >
                <button
                    role="tab"
                    aria-selected={activeTab === "general"}
                    className={`settings-tab ${
                        activeTab === "general" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("general")}
                >
                    General
                </button>
                <button
                    role="tab"
                    aria-selected={activeTab === "appearance"}
                    className={`settings-tab ${
                        activeTab === "appearance" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("appearance")}
                >
                    Appearance
                </button>
            </div>

            <div className="settings-body">
                {activeTab === "general" && (
                    <>
                        <section className="settings-row">
                            <div className="settings-row__copy">
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

                        <section className="settings-row">
                            <div className="settings-row__copy">
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

                        <section className="settings-row">
                            <div className="settings-row__copy">
                                <div className="title">
                                    Disable Context Menu
                                </div>
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

                        <div className="settings-actions">
                            <Button kind="confirm" onClick={handleSave}>
                                Save
                            </Button>
                        </div>
                    </>
                )}

                {activeTab === "appearance" && (
                    <>
                        {/* preview */}
                        <div
                            className="appearance-preview"
                            aria-label="Chat bubble preview"
                        >
                            {showNameIcon && selectedIconKey && (
                                <img
                                    className="preview-icon"
                                    src={`${NAME_ICON_ASSET_BASE}${selectedIconKey}.png`}
                                    alt=""
                                />
                            )}
                            <span className={`preview-name ${bubbleStyle}`}>
                                You
                            </span>
                            <div
                                className={`preview-bubble ${bubbleStyle}`}
                                style={{ backgroundColor: bubbleTint }}
                            >
                                This is how your chat will look.
                            </div>
                        </div>

                        {/* bubble style */}
                        <div className="appearance-group">
                            <div className="group-title">Bubble Style</div>
                            <div className="style-pills">
                                {styleChoices.map((s) => (
                                    <button
                                        key={s.id}
                                        className={`pill ${
                                            bubbleStyle === s.id ? "active" : ""
                                        }`}
                                        onClick={() => setBubbleStyle(s.id)}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* bubble tint */}
                        <div className="appearance-group">
                            <div className="group-title">Bubble Tint</div>
                            <div className="tint-swatches">
                                {tintChoices.map((hex) => (
                                    <button
                                        key={hex}
                                        className={`swatch ${
                                            hex === bubbleTint ? "selected" : ""
                                        }`}
                                        style={{ backgroundColor: hex }}
                                        onClick={() => setBubbleTint(hex)}
                                        aria-label={`Tint ${hex}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* show name icon toggle */}
                        <section className="settings-row">
                            <div className="settings-row__copy">
                                <div className="title">
                                    Show name icon in chat
                                </div>
                                <div className="sub">
                                    Toggle the small icon before your name.
                                </div>
                            </div>
                            <Toggle
                                checked={showNameIcon}
                                onChange={setShowNameIcon}
                                ariaLabel="Toggle name icon"
                            />
                        </section>

                        {/* icon picker */}
                        <div className="appearance-group">
                            <div className="group-title with-sub">
                                <span>Name Icons</span>
                                <small>
                                    Pick one to show before your username
                                </small>
                            </div>

                            {iconsLoading && (
                                <div className="loader-line">
                                    Loading icons…
                                </div>
                            )}
                            {iconsError && (
                                <div className="error-line">
                                    Failed to load icons: {iconsError}
                                </div>
                            )}

                            {!iconsLoading && !iconsError && (
                                <div className="icon-grid">
                                    {icons.map((icon) => {
                                        const url = buildIconUrl(icon);
                                        const locked = !!(
                                            icon.staff_only || icon.vip_only
                                        );
                                        const selected =
                                            selectedIconKey === icon.key;

                                        return (
                                            <button
                                                key={icon.id}
                                                className={`icon-card ${
                                                    selected ? "selected" : ""
                                                } ${locked ? "locked" : ""}`}
                                                onClick={() =>
                                                    !locked &&
                                                    setSelectedIconKey(icon.key)
                                                }
                                                title={icon.title}
                                                aria-label={icon.title}
                                            >
                                                {locked && (
                                                    <span className="lock">
                                                        🔒
                                                    </span>
                                                )}
                                                <img src={url} alt="" />
                                                <span className="label">
                                                    {icon.title}
                                                </span>
                                                {icon.price > 0 && (
                                                    <span className="price">
                                                        ${icon.price}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="settings-actions">
                            <Button kind="confirm" onClick={handleSave}>
                                Save
                            </Button>
                        </div>
                    </>
                )}
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
        className={`toggle ${checked ? "on" : "off"}`}
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
    <button className={`btn btn--${kind}`} onClick={onClick}>
        {children}
    </button>
);

export default SettingsView;
