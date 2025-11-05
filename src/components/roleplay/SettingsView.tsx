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

/* ==== Chat & Icons packets ==== */
import { ChangeChatBubbleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ChangeChatBubbleComposer";
import { RequestChatBubbleStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestChatBubbleStoreComposer";
import { ChangeNameIconComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/ChangeNameIconComposer";
import { RequestNameIconStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestNameIconStoreComposer";

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
const ACTIVE_TAB_KEY = "settings.activeTab";
const BUBBLE_ID_KEY = "chat.bubble.id";
const ICON_ID_KEY = "name.icon.id";

/* Raw events */
const EVT_STORE_SHOP_RAW = "chat_bubble_shop";
const EVT_ICON_STORE_RAW = "name_icon_shop";

/* Internal normalized events */
const EVT_STORE = "settings:chat_bubbles_owned";
const EVT_ICON_STORE = "settings:name_icons_owned";

/* Assets */
const BUBBLE_ASSET_BASE = "/nitro-react/src/assets/images/chat/chatbubbles";
const NAMEICON_ASSET_BASE = "/nitro-react/src/assets/images/chat/nameicons";

const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

/* ---- Types ---- */
type Props = { onClose: () => void };
type OwnedItem = { id: number; owned: true };

/* ---- Component ---- */
export const SettingsView: FC<Props> = ({ onClose }) => {
    const [entering, setEntering] = useState(true);
    type TabKey = "general" | "chat" | "icons" | "namecolor";
    const [activeTab, setActiveTab] = useState<TabKey>(
        () => (localStorage.getItem(ACTIVE_TAB_KEY) as TabKey) || "general"
    );

    const { ref: rootRef, onMouseDown: startDrag } =
        useDraggable<HTMLDivElement>();

    /* Chat bubbles */
    const [ownedBubbles, setOwnedBubbles] = useState<Map<number, OwnedItem>>(
        new Map()
    );
    const [selectedBubbleId, setSelectedBubbleId] = useState<number>(() => {
        const saved = Number(localStorage.getItem(BUBBLE_ID_KEY));
        return Number.isFinite(saved) ? saved : 0;
    });

    /* Name icons */
    const [ownedIcons, setOwnedIcons] = useState<Map<number, OwnedItem>>(
        new Map()
    );
    const [selectedIconId, setSelectedIconId] = useState<number>(() => {
        const saved = Number(localStorage.getItem(ICON_ID_KEY));
        return Number.isFinite(saved) ? saved : 0;
    });

    const bubbleItems = useMemo(
        () =>
            Array.from(ownedBubbles.values())
                .map((v) => v.id)
                .sort((a, b) => a - b),
        [ownedBubbles]
    );

    const iconItems = useMemo(
        () =>
            Array.from(ownedIcons.values())
                .map((v) => v.id)
                .sort((a, b) => a - b),
        [ownedIcons]
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
        } else {
            rootRef.current.style.left = `calc(100vw - ${rect.width + 16}px)`;
            rootRef.current.style.top = `90px`;
        }
    }, []);

    /* ESC to close */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    /* Persist active tab */
    useEffect(() => {
        localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    }, [activeTab]);

    /* ==== Request owned data ==== */
    const requestBubbleShop = useCallback(() => {
        try {
            SendMessageComposer(new RequestChatBubbleStoreComposer());
        } catch {}
    }, []);
    const requestIconShop = useCallback(() => {
        try {
            SendMessageComposer(new RequestNameIconStoreComposer());
        } catch {}
    }, []);

    useEffect(() => {
        if (activeTab === "chat") requestBubbleShop();
        if (activeTab === "icons") requestIconShop();
    }, [activeTab, requestBubbleShop, requestIconShop]);

    /* ==== Bridge → owned bubbles ==== */
    useEffect(() => {
        const onShopRaw = (e: Event) => {
            const { detail } = e as CustomEvent<{
                items: any[];
                equippedId?: number;
            }>;
            if (!detail) return;
            const m = new Map<number, OwnedItem>();
            let eq: number | undefined;
            for (const it of detail.items || []) {
                if (it.owned)
                    m.set(it.bubbleId, { id: it.bubbleId, owned: true });
                if (it.equipped) eq = it.bubbleId;
            }
            setOwnedBubbles(m);
            if (typeof detail.equippedId === "number")
                setSelectedBubbleId(detail.equippedId);
            else if (eq) setSelectedBubbleId(eq);
        };
        window.addEventListener(EVT_STORE_SHOP_RAW, onShopRaw as EventListener);
        return () =>
            window.removeEventListener(
                EVT_STORE_SHOP_RAW,
                onShopRaw as EventListener
            );
    }, []);

    /* ==== Bridge → owned icons ==== */
    useEffect(() => {
        const onIconRaw = (e: Event) => {
            const { detail } = e as CustomEvent<{
                items: any[];
                equippedId?: number;
            }>;
            if (!detail) return;
            const m = new Map<number, OwnedItem>();
            let eq: number | undefined;
            for (const it of detail.items || []) {
                if (it.owned) m.set(it.iconId, { id: it.iconId, owned: true });
                if (it.equipped) eq = it.iconId;
            }
            setOwnedIcons(m);
            if (typeof detail.equippedId === "number")
                setSelectedIconId(detail.equippedId);
            else if (eq) setSelectedIconId(eq);
        };
        window.addEventListener(EVT_ICON_STORE_RAW, onIconRaw as EventListener);
        return () =>
            window.removeEventListener(
                EVT_ICON_STORE_RAW,
                onIconRaw as EventListener
            );
    }, []);

    /* ==== React to external owned updates ==== */
    useEffect(() => {
        const onIconsOwned = (e: Event) => {
            const { detail } = e as CustomEvent<{
                items: any[];
                equippedId?: number;
            }>;
            if (!detail) return;
            const m = new Map<number, OwnedItem>();
            for (const it of detail.items || [])
                m.set(it.id, { id: it.id, owned: true });
            setOwnedIcons(m);
            if (typeof detail.equippedId === "number")
                setSelectedIconId(detail.equippedId);
        };
        window.addEventListener(EVT_ICON_STORE, onIconsOwned as EventListener);
        return () =>
            window.removeEventListener(
                EVT_ICON_STORE,
                onIconsOwned as EventListener
            );
    }, []);

    /* ==== Selection handlers ==== */
    const selectBubble = (bubbleId: number) => {
        if (!ownedBubbles.has(bubbleId)) return;
        setSelectedBubbleId(bubbleId);
        localStorage.setItem(BUBBLE_ID_KEY, String(bubbleId));
        SendMessageComposer(new ChangeChatBubbleComposer(bubbleId));
    };

    const selectIcon = (iconId: number) => {
        if (!ownedIcons.has(iconId)) return;
        setSelectedIconId(iconId);
        localStorage.setItem(ICON_ID_KEY, String(iconId));
        SendMessageComposer(new ChangeNameIconComposer(iconId));
    };

    const bubbleImageUrl = (id: number) =>
        `${BUBBLE_ASSET_BASE}/bubble_${id}.png`;
    const iconImageUrl = (id: number) => `${NAMEICON_ASSET_BASE}/${id}.png`;

    const handleClose = () => {
        setEntering(false);
        setTimeout(onClose, 220);
    };

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

            {/* Tabs */}
            <div
                className="settings-tabs"
                role="tablist"
                aria-label="Settings tabs"
            >
                {["general", "chat", "icons", "namecolor"].map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        className={`settings-tab ${
                            activeTab === tab ? "active" : ""
                        }`}
                        onClick={() => setActiveTab(tab as TabKey)}
                    >
                        {tab === "general"
                            ? "General"
                            : tab === "chat"
                            ? "Chat Bubbles"
                            : tab === "icons"
                            ? "Name Icons"
                            : "Name Color"}
                    </button>
                ))}
            </div>

            <div className="settings-body">
                {activeTab === "chat" && (
                    <div className="appearance-group">
                        <div className="group-title with-sub">
                            <span>Owned Chat Bubbles</span>
                            <small>Choose from bubbles you own</small>
                        </div>
                        <div className="bubble-grid">
                            {bubbleItems.map((id) => {
                                const selected = selectedBubbleId === id;
                                return (
                                    <button
                                        key={id}
                                        className={`bubble-card ${
                                            selected ? "selected" : ""
                                        }`}
                                        onClick={() => selectBubble(id)}
                                        title={`Equip bubble #${id}`}
                                    >
                                        <div
                                            className={`bubble-thumb bubble-${id}`}
                                        >
                                            <img
                                                src={bubbleImageUrl(id)}
                                                alt=""
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
                            <span>Owned Name Icons</span>
                            <small>Choose your nameplate icon</small>
                        </div>
                        <div className="bubble-grid">
                            {iconItems.map((id) => {
                                const selected = selectedIconId === id;
                                return (
                                    <button
                                        key={id}
                                        className={`bubble-card ${
                                            selected ? "selected" : ""
                                        }`}
                                        onClick={() => selectIcon(id)}
                                        title={`Equip name icon #${id}`}
                                    >
                                        <div className="bubble-thumb">
                                            <img
                                                src={iconImageUrl(id)}
                                                alt=""
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

                {activeTab === "namecolor" && (
                    <div className="appearance-group">
                        <div className="group-title with-sub">
                            <span>Name Color</span>
                            <small>
                                Coming soon — customize your chat name color
                            </small>
                        </div>
                        <div className="empty">
                            Name Color picker not available yet.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
