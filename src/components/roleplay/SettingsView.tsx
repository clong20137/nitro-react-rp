import React, {
    FC,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import "./SettingsView.scss";
import { SendMessageComposer } from "../../api";

/* Hard imports */
import { ChangeChatBubbleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ChangeChatBubbleComposer";
import { RequestChatBubbleStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestChatBubbleStoreComposer";

/* ---- Small, no-deps draggable ---- */
function useDraggable<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const drag = useRef<{
        ox: number;
        oy: number;
        sx: number;
        sy: number;
    } | null>(null);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!ref.current) return;
        const el = ref.current;
        const rect = el.getBoundingClientRect();
        drag.current = {
            ox: e.clientX,
            oy: e.clientY,
            sx: rect.left,
            sy: rect.top,
        };

        const onMove = (ev: MouseEvent) => {
            if (!drag.current) return;
            const dx = ev.clientX - drag.current.ox;
            const dy = ev.clientY - drag.current.oy;
            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;
            const left = Math.min(
                Math.max(drag.current.sx + dx, 8),
                vw - rect.width - 8
            );
            const top = Math.min(
                Math.max(drag.current.sy + dy, 8),
                vh - rect.height - 8
            );
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            el.style.transform = `translate(0,0)`;
        };

        const onUp = () => {
            drag.current = null;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, []);

    return { ref, onMouseDown };
}

/* ---- Keys / constants ---- */
const POS_KEY = "olrp.settings.pos";
const LIVE_KEY = "liveFeedEnabled";
const INVITE_KEY = "gangInvitesEnabled";
const CTX_KEY = "contextMenuDisabled";
const ACTIVE_TAB_KEY = "settings.activeTab";
const BUBBLE_ID_KEY = "chat.bubble.id";

/* Raw events (support both) */
const EVT_STORE_OWNED_RAW = "chat_bubbles_owned_raw"; // if you emit owned-only
const EVT_STORE_SHOP_RAW = "chat_bubble_shop"; // legacy: from ChatBubbleShopComposer

/* Internal normalized event */
const EVT_STORE = "settings:chat_bubbles_owned";

const BUBBLE_ASSET_BASE = "/nitro-react/src/assets/images/chat/chatbubbles";
const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

/* ---- Types ---- */
type Props = { onClose: () => void };

/** Normalized, owned-only */
type OwnedItem = { id: number; owned: true };

type RawOwnedOnlyItem = { bubbleId: number };
type RawOwnedOnlyPayload = { items: RawOwnedOnlyItem[]; equippedId?: number };

type RawShopItem = {
    bubbleId: number;
    price: number;
    owned: boolean;
    equipped?: boolean;
};
type RawShopPayload = {
    items: RawShopItem[];
    diamonds?: number;
    equippedId?: number;
};

/* ---- Tiny UI ---- */
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

const Button: FC<{
    kind?: "primary" | "confirm" | "danger";
    onClick?: () => void;
    children: any;
    disabled?: boolean;
}> = ({ kind = "primary", onClick, children, disabled }) => (
    <button
        type="button"
        className={`btn btn--${kind}`}
        onClick={onClick}
        disabled={disabled}
    >
        {children}
    </button>
);

/* ---- Component ---- */
export const SettingsView: FC<Props> = ({ onClose }) => {
    /* General settings (unchanged) */
    const [liveFeed, setLiveFeed] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem(LIVE_KEY) ?? "true")
    );
    const [gangInvites, setGangInvites] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem(INVITE_KEY) ?? "true")
    );
    const [contextMenuDisabled, setContextMenuDisabled] = useState<boolean>(
        () => JSON.parse(localStorage.getItem(CTX_KEY) ?? "false")
    );

    /* UI + tabs */
    const [entering, setEntering] = useState(true);
    type TabKey = "general" | "chat" | "icons" | "namecolor";
    const [activeTab, setActiveTab] = useState<TabKey>(
        () => (localStorage.getItem(ACTIVE_TAB_KEY) as TabKey) || "general"
    );

    /* Drag */
    const { ref: rootRef, onMouseDown: startDrag } =
        useDraggable<HTMLDivElement>();

    /* Owned bubbles only */
    const [owned, setOwned] = useState<Map<number, OwnedItem>>(new Map());
    const [selectedBubbleId, setSelectedBubbleId] = useState<number>(() => {
        const saved = Number(localStorage.getItem(BUBBLE_ID_KEY));
        return Number.isFinite(saved) ? saved : 0;
    });

    const items = useMemo(
        () =>
            Array.from(owned.values())
                .map((v) => v.id)
                .sort((a, b) => a - b),
        [owned]
    );

    /* Position restore */
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
            rootRef.current.style.transform = "translate(0,0)";
        } else {
            rootRef.current.style.left = `calc(100vw - ${rect.width + 16}px)`;
            rootRef.current.style.top = `90px`;
        }
    }, []);

    /* ESC to close */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    /* Persist active tab */
    useEffect(() => {
        localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    }, [activeTab]);

    /* ---- Request data when Chat tab opens ---- */
    const requestOwnedViaShop = useCallback(() => {
        try {
            // server returns ChatBubbleShopComposer (shop list), we will filter owned=true
            SendMessageComposer(new RequestChatBubbleStoreComposer());
            console.log(
                "[SettingsView] → RequestChatBubbleStoreComposer (send)"
            );
        } catch (e) {
            console.error(
                "[SettingsView] send RequestChatBubbleStoreComposer failed",
                e
            );
        }
    }, []);

    useEffect(() => {
        if (activeTab === "chat") requestOwnedViaShop();
    }, [activeTab, requestOwnedViaShop]);

    /* ---- Bridge: normalize raw -> owned-only ---- */
    useEffect(() => {
        // Owned-only raw payload (if you emit EVT_STORE_OWNED_RAW)
        const onOwnedRaw = (e: Event) => {
            const { detail } = e as CustomEvent<RawOwnedOnlyPayload>;
            if (!detail) return;

            const m = new Map<number, OwnedItem>();
            for (const r of detail.items || [])
                m.set(r.bubbleId, { id: r.bubbleId, owned: true });

            window.dispatchEvent(
                new CustomEvent(EVT_STORE, {
                    detail: {
                        items: Array.from(m.values()),
                        equippedId:
                            typeof detail.equippedId === "number"
                                ? detail.equippedId
                                : undefined,
                    },
                })
            );
        };

        // Legacy shop payload: filter to owned===true
        const onShopRaw = (e: Event) => {
            const { detail } = e as CustomEvent<RawShopPayload>;
            if (!detail) return;

            const m = new Map<number, OwnedItem>();
            let equippedIdFromFlag: number | undefined;

            for (const it of detail.items || []) {
                if (it.owned)
                    m.set(it.bubbleId, { id: it.bubbleId, owned: true });
                if (it.equipped) equippedIdFromFlag = it.bubbleId;
            }

            window.dispatchEvent(
                new CustomEvent(EVT_STORE, {
                    detail: {
                        items: Array.from(m.values()),
                        equippedId:
                            typeof detail.equippedId === "number"
                                ? detail.equippedId
                                : equippedIdFromFlag,
                    },
                })
            );
        };

        window.addEventListener(
            EVT_STORE_OWNED_RAW,
            onOwnedRaw as EventListener
        );
        window.addEventListener(EVT_STORE_SHOP_RAW, onShopRaw as EventListener);

        return () => {
            window.removeEventListener(
                EVT_STORE_OWNED_RAW,
                onOwnedRaw as EventListener
            );
            window.removeEventListener(
                EVT_STORE_SHOP_RAW,
                onShopRaw as EventListener
            );
        };
    }, []);

    /* ---- Internal normalized event -> state ---- */
    useEffect(() => {
        const onOwned = (e: Event) => {
            const { detail } = e as CustomEvent<{
                items: OwnedItem[];
                equippedId?: number;
            }>;
            const m = new Map<number, OwnedItem>();
            for (const it of detail.items || []) m.set(it.id, it);
            setOwned(m);

            if (typeof detail.equippedId === "number") {
                setSelectedBubbleId(detail.equippedId);
                localStorage.setItem(BUBBLE_ID_KEY, String(detail.equippedId));
            }
        };

        window.addEventListener(EVT_STORE, onOwned as EventListener);
        return () =>
            window.removeEventListener(EVT_STORE, onOwned as EventListener);
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

    const selectBubble = (bubbleId: number) => {
        if (!owned.has(bubbleId)) return; // safety: owned only here
        setSelectedBubbleId(bubbleId);
        localStorage.setItem(BUBBLE_ID_KEY, String(bubbleId));
        try {
            SendMessageComposer(new ChangeChatBubbleComposer(bubbleId));
        } catch (e) {
            console.error(
                "[SettingsView] send ChangeChatBubbleComposer failed",
                e
            );
        }
        window.dispatchEvent(
            new CustomEvent("olrp:chatBubbleChanged", { detail: { bubbleId } })
        );
    };

    const bubbleImageUrl = (id: number) =>
        `${BUBBLE_ASSET_BASE}/bubble_${id}.png`;

    return (
        <div
            ref={rootRef}
            className={`settings-root ${
                entering ? "is-entering" : "is-exiting"
            }`}
            role="dialog"
            aria-label="Settings"
            style={{ left: "calc(100vw - 420px)", top: "90px" }}
        >
            <div className="settings-header" onMouseDown={startDrag}>
                <span>Settings</span>
                <button
                    type="button"
                    className="settings-iconbtn"
                    onClick={handleClose}
                    aria-label="Close settings"
                />
            </div>

            {/* tabs */}
            <div
                className="settings-tabs"
                role="tablist"
                aria-label="Settings tabs"
            >
                <button
                    type="button"
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
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "chat"}
                    className={`settings-tab ${
                        activeTab === "chat" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("chat")}
                >
                    Chat Bubbles
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "icons"}
                    className={`settings-tab ${
                        activeTab === "icons" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("icons")}
                >
                    Name Icons
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "namecolor"}
                    className={`settings-tab ${
                        activeTab === "namecolor" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("namecolor")}
                >
                    Name Color
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

                {activeTab === "chat" && (
                    <div className="appearance-group">
                        <div className="group-title with-sub">
                            <span>Owned Chat Bubbles</span>
                            <small>Choose from bubbles you own</small>
                        </div>

                        <div className="bubble-grid">
                            {items.map((id) => {
                                const selected = selectedBubbleId === id;
                                return (
                                    <button
                                        type="button"
                                        key={id}
                                        className={`bubble-card ${
                                            selected ? "selected" : ""
                                        }`}
                                        onClick={() => selectBubble(id)}
                                        title={`Equip bubble #${id}`}
                                        aria-label={`Equip bubble ${id}`}
                                    >
                                        <div
                                            className={`bubble-thumb bubble-${id}`}
                                        >
                                            <img
                                                src={bubbleImageUrl(id)}
                                                alt=""
                                                aria-hidden
                                            />
                                            <span className="bubble-id">
                                                #{id}
                                            </span>
                                        </div>
                                        <div className="price-row">
                                            <span className="owned">Owned</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === "icons" && (
                    <div className="appearance-group">
                        <div className="group-title with-sub">
                            <span>Name Icons</span>
                            <small>
                                Coming soon — choose a nameplate icon.
                            </small>
                        </div>
                        <div className="empty">
                            Name Icons store is not available yet.
                        </div>
                    </div>
                )}

                {activeTab === "namecolor" && (
                    <div className="appearance-group">
                        <div className="group-title with-sub">
                            <span>Name Color</span>
                            <small>
                                Coming soon — customize your chat name color.
                            </small>
                        </div>
                        <div className="empty">
                            Name Color picker is not available yet.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
