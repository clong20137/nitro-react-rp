import { FC, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { SendMessageComposer, GetSessionDataManager } from "../../api";

/* ==== Existing Bubbles packets ==== */
import { RequestChatBubbleStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestChatBubbleStoreComposer";
import { PurchaseChatBubbleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PurchaseChatBubbleComposer";

/* ==== Existing NameIcons packets ==== */
import { RequestNameIconStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestNameIconStoreComposer";
import { PurchaseNameIconComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PurchaseNameIconComposer";

import "./DiamondStoreView.scss";

/* ---------- Bridge event names (existing) ---------- */
const EVT_STORE_RAW = "chat_bubble_shop";
const EVT_PURCHASE_OK_RAW = "chat_bubble_purchase_ok_raw";
const EVT_PURCHASE_FAIL_RAW = "chat_bubble_purchase_fail_raw";

/* Name Icons bridge (existing) */
const EVT_ICON_STORE_RAW = "name_icon_shop";
const EVT_ICON_PURCHASE_OK_RAW = "name_icon_purchase_ok_raw";
const EVT_ICON_PURCHASE_FAIL_RAW = "name_icon_purchase_fail_raw";

/* ---------- NEW: Featured (main) + Tokens bridges ---------- */
/** Server should fire these with payloads described below */
const EVT_FEATURED_STORE_RAW = "store_featured_shop";
const EVT_FEATURED_PURCHASE_OK_RAW = "store_featured_purchase_ok_raw";
const EVT_FEATURED_PURCHASE_FAIL_RAW = "store_featured_purchase_fail_raw";

const EVT_TOKENS_STORE_RAW = "store_tokens_shop";
const EVT_TOKENS_PURCHASE_OK_RAW = "store_tokens_purchase_ok_raw";
const EVT_TOKENS_PURCHASE_FAIL_RAW = "store_tokens_purchase_fail_raw";

/* ---------- Optional Composers (loaded only if you add them later) ---------- */
/** This avoids build errors until your backend exists. */
let RequestFeaturedStoreComposerRef: any;
let PurchaseBundleComposerRef: any;
let RequestTokenStoreComposerRef: any;
let PurchaseTokenComposerRef: any;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RequestFeaturedStoreComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestFeaturedStoreComposer").RequestFeaturedStoreComposer;
    PurchaseBundleComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PurchaseBundleComposer").PurchaseBundleComposer;
    RequestTokenStoreComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestTokenStoreComposer").RequestTokenStoreComposer;
    PurchaseTokenComposerRef =
        require("@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PurchaseTokenComposer").PurchaseTokenComposer;
} catch {
    /* optional */
}

/* ---------- Assets ---------- */
const BUBBLE_ASSET_BASE = "/nitro-react/src/assets/images/chat/chatbubbles";
const NAMEICON_ASSET_BASE = "/nitro-react/src/assets/images/chat/nameicons";
const bubbleGif = (id: number) => `${BUBBLE_ASSET_BASE}/bubble_${id}.gif`;
const bubblePng = (id: number) => `${BUBBLE_ASSET_BASE}/bubble_${id}.png`;
const nameIconPng = (id: number) => `${NAMEICON_ASSET_BASE}/${id}.png`;

/* --------------------------------------------------------
BubbleImg: prefer PNG, pre-load GIF in parallel as backup
--------------------------------------------------------- */
const BubbleImg: FC<{
    id: number;
    className?: string;
    alt?: string;
    "aria-hidden"?: boolean;
}> = ({ id, className, alt = "", ...rest }) => {
    const [src, setSrc] = useState<string>(bubblePng(id));
    const stateRef = useRef({
        pngLoaded: false,
        pngErrored: false,
        gifLoaded: false,
    });

    useEffect(() => {
        let alive = true;
        const png = new Image();
        const gif = new Image();
        const pngUrl = bubblePng(id);
        const gifUrl = bubbleGif(id);

        png.onload = () => {
            if (!alive) return;
            stateRef.current.pngLoaded = true;
            setSrc(pngUrl);
        };
        png.onerror = () => {
            if (!alive) return;
            stateRef.current.pngErrored = true;
            if (stateRef.current.gifLoaded) setSrc(gifUrl);
        };
        png.src = pngUrl;

        gif.onload = () => {
            if (!alive) return;
            stateRef.current.gifLoaded = true;
            if (stateRef.current.pngErrored) setSrc(gifUrl);
        };
        gif.onerror = () => {};
        gif.src = gifUrl;

        return () => {
            alive = false;
        };
    }, [id]);

    return <img src={src} className={className} alt={alt} {...rest} />;
};

/* --------------------------------------------------------
NameIconImg: just PNG (name icons are static)
--------------------------------------------------------- */
const NameIconImg: FC<{
    id: number;
    className?: string;
    alt?: string;
    "aria-hidden"?: boolean;
}> = ({ id, className, alt = "", ...rest }) => {
    return (
        <img src={nameIconPng(id)} className={className} alt={alt} {...rest} />
    );
};

/* ---------- Draggable shell ---------- */
const Shell: FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ title, onClose, children }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const drag = useRef<{ dx: number; dy: number; on: boolean }>({
        dx: 0,
        dy: 0,
        on: false,
    });

    useEffect(() => {
        const el = ref.current!;
        if (!el) return;
        const w = 520,
            h = 600; // a little bigger for banners/tiles
        el.style.left = Math.max(12, window.innerWidth - w - 16) + "px";
        el.style.top = "80px";
        el.style.width = w + "px";
        el.style.height = h + "px";
        el.style.position = "fixed";
    }, []);

    const onDown = (e: React.MouseEvent) => {
        const el = ref.current!;
        const rect = el.getBoundingClientRect();
        drag.current.on = true;
        drag.current.dx = e.clientX - rect.left;
        drag.current.dy = e.clientY - rect.top;

        const onMove = (ev: MouseEvent) => {
            if (!drag.current.on) return;
            const x = Math.min(
                Math.max(0, ev.clientX - drag.current.dx),
                window.innerWidth - rect.width
            );
            const y = Math.min(
                Math.max(0, ev.clientY - drag.current.dy),
                window.innerHeight - 40
            );
            el.style.left = x + "px";
            el.style.top = y + "px";
        };
        const onUp = () => {
            drag.current.on = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const [enter, setEnter] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setEnter(false), 320);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            ref={ref}
            className={`ds-root ${enter ? "is-entering" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className="ds-header" onMouseDown={onDown}>
                <div className="ds-title">
                    <i className="ico ico-diamond-sm" />
                    <span>{title}</span>
                </div>
                <button
                    className="ds-close"
                    aria-label="Close"
                    onClick={onClose}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            </div>
            <div className="ds-body">{children}</div>
        </div>
    );
};

/* ---------- Types ---------- */
type StoreItem = { id: number; price: number; owned: boolean };

/* Bubbles (existing) */
type RawItem = {
    bubbleId: number;
    price: number;
    owned: boolean;
    equipped?: boolean;
};
type RawPayload = { items: RawItem[]; diamonds?: number; equippedId?: number };

/* Name Icons (existing) */
type IconRawItem = {
    iconId: number;
    price: number;
    owned: boolean;
    equipped?: boolean;
};
type IconRawPayload = {
    items: IconRawItem[];
    diamonds?: number;
    equippedId?: number;
};

/* ---------- NEW: Featured (main store) ---------- */
type FeaturedBanner = {
    id: string;
    imageUrl: string;
    link?: string;
    headline?: string;
    sub?: string;
};
type FeaturedBundle = {
    id: number;
    title: string;
    description?: string;
    price: number;
    imageUrl?: string; // still supported
    imageKey?: string; // NEW: e.g. "vip_bundle"
    tag?: "BEST" | "HOT" | "NEW";
};

type FeaturedPayload = {
    diamonds?: number;
    banners?: FeaturedBanner[];
    bundles: FeaturedBundle[];
};

/* ---------- NEW: Tokens ---------- */
type TokenItem = {
    id: number;
    key: "VIP" | "DOUBLE_XP" | string;
    title: string;
    durationHours?: number;
    price: number;
    owned?: boolean;
    activeUntilTs?: number;
    imageKey?: string; // NEW: e.g. "double_xp_24h"
};
type TokensPayload = {
    diamonds?: number;
    items: TokenItem[];
};

/* ---------- Component ---------- */
export const DiamondsStoreView: FC<{ onClose: () => void }> = ({ onClose }) => {
    type TabKey = "featured" | "bubbles" | "icons" | "tokens";
    const [activeTab, setActiveTab] = useState<TabKey>("featured");
    const storeTile = (key: string) => `/icons/store/${key}.png`;

    const [diamonds, setDiamonds] = useState<number>(() => {
        try {
            return Number((GetSessionDataManager() as any)?.diamonds ?? 0);
        } catch {
            return 0;
        }
    });

    /* ===== Featured ===== */
    const [banners, setBanners] = useState<FeaturedBanner[]>([]);
    const [bundles, setBundles] = useState<FeaturedBundle[]>([]);
    const [featuredLoading, setFeaturedLoading] = useState<boolean>(false);

    /* ===== Bubbles ===== */
    const [storeBubbles, setStoreBubbles] = useState<Map<number, StoreItem>>(
        new Map()
    );
    const [equippedBubbleId, setEquippedBubbleId] = useState<number>(0);

    /* ===== Icons ===== */
    const [storeIcons, setStoreIcons] = useState<Map<number, StoreItem>>(
        new Map()
    );
    const [equippedIconId, setEquippedIconId] = useState<number>(0);

    /* ===== Tokens ===== */
    const [tokenItems, setTokenItems] = useState<TokenItem[]>([]);
    const [tokensLoading, setTokensLoading] = useState<boolean>(false);

    /* Confirm modal state carries the kind + id */
    const [confirm, setConfirm] = useState<{ kind: TabKey; id: number } | null>(
        null
    );
    const [purchaseBusy, setPurchaseBusy] = useState<boolean>(false);

    // live wallet sync
    useEffect(() => {
        const onDiamondUpdate = (e: Event) => {
            const { detail } = e as CustomEvent<{ amount: number }>;
            if (detail && typeof detail.amount === "number")
                setDiamonds(Number(detail.amount) || 0);
        };
        window.addEventListener(
            "diamond_balance_update",
            onDiamondUpdate as EventListener
        );
        return () =>
            window.removeEventListener(
                "diamond_balance_update",
                onDiamondUpdate as EventListener
            );
    }, []);

    /* ====== Requesters ====== */
    const requestBubbleStore = useCallback(() => {
        try {
            SendMessageComposer(new RequestChatBubbleStoreComposer());
        } catch (e) {
            console.error(
                "[DiamondStore] RequestChatBubbleStoreComposer failed",
                e
            );
        }
    }, []);

    const requestIconStore = useCallback(() => {
        try {
            SendMessageComposer(new RequestNameIconStoreComposer());
        } catch (e) {
            console.error(
                "[DiamondStore] RequestNameIconStoreComposer failed",
                e
            );
        }
    }, []);

    const requestFeaturedStore = useCallback(() => {
        // Either call your server composer (if present) or rely on an external window event
        if (RequestFeaturedStoreComposerRef) {
            try {
                setFeaturedLoading(true);
                SendMessageComposer(new RequestFeaturedStoreComposerRef());
            } catch (e) {
                setFeaturedLoading(false);
                console.error(
                    "[DiamondStore] RequestFeaturedStoreComposer failed",
                    e
                );
            }
        }
    }, []);

    const requestTokensStore = useCallback(() => {
        if (RequestTokenStoreComposerRef) {
            try {
                setTokensLoading(true);
                SendMessageComposer(new RequestTokenStoreComposerRef());
            } catch (e) {
                setTokensLoading(false);
                console.error(
                    "[DiamondStore] RequestTokenStoreComposer failed",
                    e
                );
            }
        }
    }, []);

    /* Request all on mount (so tab switch is instant) */
    useEffect(() => {
        requestFeaturedStore();
        requestTokensStore();
        requestBubbleStore();
        requestIconStore();
    }, [
        requestBubbleStore,
        requestIconStore,
        requestFeaturedStore,
        requestTokensStore,
    ]);

    /* ===== RAW → state (BUBBLES) ===== */
    useEffect(() => {
        const onRawShop = (e: Event) => {
            const { detail } = e as CustomEvent<RawPayload>;
            if (!detail) return;

            const m = new Map<number, StoreItem>();
            for (const x of detail.items || [])
                m.set(x.bubbleId, {
                    id: x.bubbleId,
                    price: Number(x.price),
                    owned: !!x.owned,
                });
            setStoreBubbles(m);

            if (typeof detail.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);

            const eq =
                typeof detail.equippedId === "number"
                    ? detail.equippedId
                    : (detail.items || []).find((x) => x.equipped)?.bubbleId ||
                      0;
            setEquippedBubbleId(Number(eq) || 0);
        };

        const onRawOk = (e: Event) => {
            const { detail } = e as CustomEvent<{
                bubbleId: number;
                diamonds?: number;
            }>;
            if (!detail) return;
            const id = Number(detail.bubbleId);

            setPurchaseBusy(false);
            setConfirm(null);

            setStoreBubbles((prev) => {
                const next = new Map(prev);
                const cur = next.get(id) || { id, price: 0, owned: false };
                next.set(id, { ...cur, owned: true });
                return next;
            });

            if (typeof detail.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);

            window.dispatchEvent(
                new CustomEvent("settings:chat_bubbles_owned", {
                    detail: {
                        items: [{ id, owned: true }],
                        equippedId: undefined,
                    },
                })
            );
        };

        const onRawFail = (e: Event) => {
            const { detail } = e as CustomEvent<{
                bubbleId: number;
                reason?: string;
            }>;
            console.warn(
                "[DiamondStore] bubble purchase FAIL",
                detail?.bubbleId,
                detail?.reason
            );
            setPurchaseBusy(false);
        };

        window.addEventListener(EVT_STORE_RAW, onRawShop as EventListener);
        window.addEventListener(EVT_PURCHASE_OK_RAW, onRawOk as EventListener);
        window.addEventListener(
            EVT_PURCHASE_FAIL_RAW,
            onRawFail as EventListener
        );
        return () => {
            window.removeEventListener(
                EVT_STORE_RAW,
                onRawShop as EventListener
            );
            window.removeEventListener(
                EVT_PURCHASE_OK_RAW,
                onRawOk as EventListener
            );
            window.removeEventListener(
                EVT_PURCHASE_FAIL_RAW,
                onRawFail as EventListener
            );
        };
    }, []);

    /* ===== RAW → state (NAME ICONS) ===== */
    useEffect(() => {
        const onIconShop = (e: Event) => {
            const { detail } = e as CustomEvent<IconRawPayload>;
            if (!detail) return;

            const m = new Map<number, StoreItem>();
            for (const x of detail.items || [])
                m.set(x.iconId, {
                    id: x.iconId,
                    price: Number(x.price),
                    owned: !!x.owned,
                });
            setStoreIcons(m);

            if (typeof detail.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);

            const eq =
                typeof detail.equippedId === "number"
                    ? detail.equippedId
                    : (detail.items || []).find((x) => x.equipped)?.iconId || 0;
            setEquippedIconId(Number(eq) || 0);
        };

        const onIconOk = (e: Event) => {
            const { detail } = e as CustomEvent<{
                iconId: number;
                diamonds?: number;
            }>;
            if (!detail) return;
            const id = Number(detail.iconId);

            setPurchaseBusy(false);
            setConfirm(null);

            setStoreIcons((prev) => {
                const next = new Map(prev);
                const cur = next.get(id) || { id, price: 0, owned: false };
                next.set(id, { ...cur, owned: true });
                return next;
            });

            if (typeof detail.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);

            window.dispatchEvent(
                new CustomEvent("settings:name_icons_owned", {
                    detail: {
                        items: [{ id, owned: true }],
                        equippedId: undefined,
                    },
                })
            );
        };

        const onIconFail = (e: Event) => {
            const { detail } = e as CustomEvent<{
                iconId: number;
                reason?: string;
            }>;
            console.warn(
                "[DiamondStore] name icon purchase FAIL",
                detail?.iconId,
                detail?.reason
            );
            setPurchaseBusy(false);
        };

        window.addEventListener(
            EVT_ICON_STORE_RAW,
            onIconShop as EventListener
        );
        window.addEventListener(
            EVT_ICON_PURCHASE_OK_RAW,
            onIconOk as EventListener
        );
        window.addEventListener(
            EVT_ICON_PURCHASE_FAIL_RAW,
            onIconFail as EventListener
        );
        return () => {
            window.removeEventListener(
                EVT_ICON_STORE_RAW,
                onIconShop as EventListener
            );
            window.removeEventListener(
                EVT_ICON_PURCHASE_OK_RAW,
                onIconOk as EventListener
            );
            window.removeEventListener(
                EVT_ICON_PURCHASE_FAIL_RAW,
                onIconFail as EventListener
            );
        };
    }, []);

    /* ===== RAW → state (FEATURED) ===== */
    useEffect(() => {
        const onFeatured = (e: Event) => {
            const { detail } = e as CustomEvent<FeaturedPayload>;
            if (!detail) return;
            setFeaturedLoading(false);
            if (Array.isArray(detail.banners)) setBanners(detail.banners);
            setBundles(detail.bundles || []);
            if (typeof detail.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);
        };
        const onFeaturedOk = (e: Event) => {
            const { detail } = e as CustomEvent<{
                bundleId: number;
                diamonds?: number;
            }>;
            setPurchaseBusy(false);
            setConfirm(null);
            if (typeof detail?.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);
            // Optionally mark bundle as purchased or show toast
        };
        const onFeaturedFail = (e: Event) => {
            const { detail } = e as CustomEvent<{
                bundleId: number;
                reason?: string;
            }>;
            console.warn(
                "[DiamondStore] bundle purchase FAIL",
                detail?.bundleId,
                detail?.reason
            );
            setPurchaseBusy(false);
        };

        window.addEventListener(
            EVT_FEATURED_STORE_RAW,
            onFeatured as EventListener
        );
        window.addEventListener(
            EVT_FEATURED_PURCHASE_OK_RAW,
            onFeaturedOk as EventListener
        );
        window.addEventListener(
            EVT_FEATURED_PURCHASE_FAIL_RAW,
            onFeaturedFail as EventListener
        );
        return () => {
            window.removeEventListener(
                EVT_FEATURED_STORE_RAW,
                onFeatured as EventListener
            );
            window.removeEventListener(
                EVT_FEATURED_PURCHASE_OK_RAW,
                onFeaturedOk as EventListener
            );
            window.removeEventListener(
                EVT_FEATURED_PURCHASE_FAIL_RAW,
                onFeaturedFail as EventListener
            );
        };
    }, []);

    /* ===== RAW → state (TOKENS) ===== */
    useEffect(() => {
        const onTokens = (e: Event) => {
            const { detail } = e as CustomEvent<TokensPayload>;
            if (!detail) return;
            setTokensLoading(false);
            setTokenItems(detail.items || []);
            if (typeof detail.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);
        };
        const onTokensOk = (e: Event) => {
            const { detail } = e as CustomEvent<{
                tokenId: number;
                diamonds?: number;
                activeUntilTs?: number;
            }>;
            setPurchaseBusy(false);
            setConfirm(null);
            if (typeof detail?.diamonds === "number")
                setDiamonds(Number(detail.diamonds) || 0);
            if (typeof detail?.tokenId === "number") {
                setTokenItems((prev) =>
                    prev.map((t) =>
                        t.id === detail.tokenId
                            ? {
                                  ...t,
                                  owned: true,
                                  activeUntilTs:
                                      detail.activeUntilTs ?? t.activeUntilTs,
                              }
                            : t
                    )
                );
            }
        };
        const onTokensFail = (e: Event) => {
            const { detail } = e as CustomEvent<{
                tokenId: number;
                reason?: string;
            }>;
            console.warn(
                "[DiamondStore] token purchase FAIL",
                detail?.tokenId,
                detail?.reason
            );
            setPurchaseBusy(false);
        };

        window.addEventListener(
            EVT_TOKENS_STORE_RAW,
            onTokens as EventListener
        );
        window.addEventListener(
            EVT_TOKENS_PURCHASE_OK_RAW,
            onTokensOk as EventListener
        );
        window.addEventListener(
            EVT_TOKENS_PURCHASE_FAIL_RAW,
            onTokensFail as EventListener
        );
        return () => {
            window.removeEventListener(
                EVT_TOKENS_STORE_RAW,
                onTokens as EventListener
            );
            window.removeEventListener(
                EVT_TOKENS_PURCHASE_OK_RAW,
                onTokensOk as EventListener
            );
            window.removeEventListener(
                EVT_TOKENS_PURCHASE_FAIL_RAW,
                onTokensFail as EventListener
            );
        };
    }, []);

    /* ---------- Confirm openers ---------- */
    const openConfirm = (kind: TabKey, id: number) => {
        if (kind === "bubbles") {
            const meta = storeBubbles.get(id);
            if (!meta || meta.owned) return;
        }
        if (kind === "icons") {
            const meta = storeIcons.get(id);
            if (!meta || meta.owned) return;
        }
        if (kind === "tokens") {
            const meta = tokenItems.find((t) => t.id === id);
            if (!meta) return;
            if (meta.owned) return; // already active
        }
        // bundles can always be re-bought unless you flag otherwise
        setConfirm({ kind, id });
    };

    /* ---------- Purchase dispatcher ---------- */
    const doPurchase = (kind: TabKey, id: number) => {
        if (kind === "bubbles") {
            const meta = storeBubbles.get(id);
            if (!meta) return;
            if (meta.owned) return setConfirm(null);
            if (diamonds < meta.price) return;
            try {
                setPurchaseBusy(true);
                SendMessageComposer(new PurchaseChatBubbleComposer(id));
            } catch (e) {
                setPurchaseBusy(false);
                console.error(
                    "[DiamondStore] PurchaseChatBubbleComposer failed",
                    e
                );
            }
            return;
        }
        if (kind === "icons") {
            const meta = storeIcons.get(id);
            if (!meta) return;
            if (meta.owned) return setConfirm(null);
            if (diamonds < meta.price) return;
            try {
                setPurchaseBusy(true);
                SendMessageComposer(new PurchaseNameIconComposer(id));
            } catch (e) {
                setPurchaseBusy(false);
                console.error(
                    "[DiamondStore] PurchaseNameIconComposer failed",
                    e
                );
            }
            return;
        }
        if (kind === "featured") {
            const meta = bundles.find((b) => b.id === id);
            if (!meta) return;
            if (diamonds < meta.price) return;
            if (PurchaseBundleComposerRef) {
                try {
                    setPurchaseBusy(true);
                    SendMessageComposer(new PurchaseBundleComposerRef(id));
                } catch (e) {
                    setPurchaseBusy(false);
                    console.error(
                        "[DiamondStore] PurchaseBundleComposer failed",
                        e
                    );
                }
            } else {
                // UI-only fallback: emit an intent for your app layer to handle
                setPurchaseBusy(true);
                window.dispatchEvent(
                    new CustomEvent("store_featured_purchase_intent", {
                        detail: { bundleId: id },
                    })
                );
            }
            return;
        }
        if (kind === "tokens") {
            const meta = tokenItems.find((t) => t.id === id);
            if (!meta) return;
            if (meta.owned) return setConfirm(null);
            if (diamonds < meta.price) return;
            if (PurchaseTokenComposerRef) {
                try {
                    setPurchaseBusy(true);
                    SendMessageComposer(new PurchaseTokenComposerRef(id));
                } catch (e) {
                    setPurchaseBusy(false);
                    console.error(
                        "[DiamondStore] PurchaseTokenComposer failed",
                        e
                    );
                }
            } else {
                setPurchaseBusy(true);
                window.dispatchEvent(
                    new CustomEvent("store_tokens_purchase_intent", {
                        detail: { tokenId: id },
                    })
                );
            }
            return;
        }
    };

    /* ---------- Render helpers ---------- */
    const bubbleItems = useMemo(
        () => Array.from(storeBubbles.values()).sort((a, b) => a.id - b.id),
        [storeBubbles]
    );
    const iconItems = useMemo(
        () => Array.from(storeIcons.values()).sort((a, b) => a.id - b.id),
        [storeIcons]
    );

    const renderCard = (kind: "bubbles" | "icons", it: StoreItem) => {
        const locked = !it.owned;
        return (
            <button
                type="button"
                key={`${kind}-${it.id}`}
                className={`bubble-card ${locked ? "locked" : ""}`}
                onClick={() => (locked ? openConfirm(kind, it.id) : undefined)}
                title={locked ? `Unlock for ${it.price}` : "Owned"}
                aria-label={
                    locked
                        ? `Unlock ${
                              kind === "bubbles" ? "bubble" : "name icon"
                          } ${it.id}`
                        : `${kind === "bubbles" ? "Bubble" : "Name icon"} ${
                              it.id
                          } owned`
                }
            >
                {locked && <span className="ribbon">LOCKED</span>}
                <div className={`bubble-thumb ${kind} ${kind}-${it.id}`}>
                    {kind === "bubbles" ? (
                        <BubbleImg id={it.id} alt="" aria-hidden />
                    ) : (
                        <NameIconImg id={it.id} alt="" aria-hidden />
                    )}
                    <span className="bubble-id">#{it.id}</span>
                </div>
                <div className="price-row">
                    {locked ? (
                        <span className="price">
                            <i className="ico ico-diamond-sm" /> {it.price}
                        </span>
                    ) : (
                        <span className="owned">Owned</span>
                    )}
                </div>
            </button>
        );
    };

    const FeaturedEmptyFallback: FeaturedPayload = {
        banners: [
            {
                id: "a",
                imageUrl: "/icons/store/promo1.png",
                headline: "Exclusive Christmas Package",
                sub: "Get prepared for the holiday season.",
            },
            {
                id: "b",
                imageUrl: "/icons/store/promo2.png",
                headline: "VIP Perks",
                sub: "Unlock exclusive benefits",
            },
        ],
        bundles: [
            {
                id: 101,
                title: "Starter Bundle",
                description: "Coins + Diamonds + Bubble",
                price: 200,
                imageUrl: "/icons/store/promo3.png",
                tag: "NEW",
            },
            {
                id: 102,
                title: "VIP Bundle",
                description: "30d VIP + 300 Diamonds",
                price: 600,
                imageUrl: "/icons/store/promo4.png",
                tag: "BEST",
            },
            {
                id: 103,
                title: "Pet Bundle",
                description: "Get exclusive pet for 1000 diamonds!",
                price: 350,
                imageUrl: "/icons/store/promo5.png",
                tag: "HOT",
            },
        ],
    };

    const activeItems =
        activeTab === "bubbles"
            ? bubbleItems
            : activeTab === "icons"
            ? iconItems
            : activeTab === "tokens"
            ? tokenItems
            : [];

    /* ---------- Small helpers ---------- */
    const fmtHours = (h?: number) => {
        if (!h || h <= 0) return "";
        if (h % 24 === 0)
            return `${Math.floor(h / 24)} day${h >= 48 ? "s" : ""}`;
        return `${h}h`;
    };
    const priceOf = (kind: TabKey, id: number): number => {
        if (kind === "bubbles") return storeBubbles.get(id)?.price ?? 0;
        if (kind === "icons") return storeIcons.get(id)?.price ?? 0;
        if (kind === "tokens")
            return tokenItems.find((t) => t.id === id)?.price ?? 0;
        if (kind === "featured")
            return bundles.find((b) => b.id === id)?.price ?? 0;
        return 0;
    };

    /* ---------- UI ---------- */
    return (
        <Shell title="Diamond Store" onClose={onClose}>
            {/* Tabs */}
            <div
                className="ds-tabs"
                role="tablist"
                aria-label="Store categories"
            >
                <button
                    className={`ds-tab ${
                        activeTab === "featured" ? "active" : ""
                    }`}
                    role="tab"
                    aria-selected={activeTab === "featured"}
                    onClick={() => setActiveTab("featured")}
                >
                    Featured
                </button>
                <button
                    className={`ds-tab ${
                        activeTab === "bubbles" ? "active" : ""
                    }`}
                    role="tab"
                    aria-selected={activeTab === "bubbles"}
                    onClick={() => setActiveTab("bubbles")}
                >
                    Chat Bubbles
                </button>
                <button
                    className={`ds-tab ${
                        activeTab === "icons" ? "active" : ""
                    }`}
                    role="tab"
                    aria-selected={activeTab === "icons"}
                    onClick={() => setActiveTab("icons")}
                >
                    Name Icons
                </button>
                <button
                    className={`ds-tab ${
                        activeTab === "tokens" ? "active" : ""
                    }`}
                    role="tab"
                    aria-selected={activeTab === "tokens"}
                    onClick={() => setActiveTab("tokens")}
                >
                    Tokens
                </button>
            </div>

            {/* Wallet / helper text */}
            <div className="appearance-preview" aria-label="Wallet">
                <div className="wallet">
                    <span className="pill">
                        <b>Balance:</b> <i className="ico ico-diamond-sm" />{diamonds}
                    </span>
                    {activeTab === "bubbles" && (
                        <span className="pill">
                            {bubbleItems.filter((i) => i.owned).length} owned
                        </span>
                    )}
                    {activeTab === "icons" && (
                        <span className="pill">
                            {iconItems.filter((i) => i.owned).length} owned
                        </span>
                    )}
                    {activeTab === "tokens" && (
                        <span className="pill">Perks & Boosts</span>
                    )}
                </div>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                    {activeTab === "featured" && (
                        <>Discover bundles and seasonal offers.</>
                    )}
                    {activeTab === "bubbles" && (
                        <>
                            Unlock chat bubbles with diamonds. Equip in{" "}
                            <b>Settings → Chat Bubbles</b>.
                        </>
                    )}
                    {activeTab === "icons" && (
                        <>
                            Unlock name icons with diamonds. Equip in{" "}
                            <b>Settings → Name Icons</b>.
                        </>
                    )}
                    {activeTab === "tokens" && (
                        <>
                            Buy <b>VIP</b> and <b>Double XP</b> time with
                            diamonds.
                        </>
                    )}
                </div>
            </div>

            {/* CONTENT BY TAB */}
            {activeTab === "featured" && (
                <div className="featured-wrap">
                    {/* Banners */}
                    <div className="featured-banners">
                        {(banners.length
                            ? banners
                            : FeaturedEmptyFallback.banners ?? []
                        ).map((b) => (
                            <div
                                key={b.id}
                                className="banner-tile"
                                role={b.link ? "button" : undefined}
                                onClick={() =>
                                    b.link
                                        ? window.dispatchEvent(
                                              new CustomEvent(
                                                  "store_banner_click",
                                                  {
                                                      detail: {
                                                          id: b.id,
                                                          link: b.link,
                                                      },
                                                  }
                                              )
                                          )
                                        : null
                                }
                            >
                                <img
                                    src={b.imageUrl}
                                    alt={b.headline || "banner"}
                                    draggable={false}
                                />
                                {(b.headline || b.sub) && (
                                    <div className="banner-copy">
                                        {b.headline && (
                                            <div className="banner-h">
                                                {b.headline}
                                            </div>
                                        )}
                                        {b.sub && (
                                            <div className="banner-s">
                                                {b.sub}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Bundles grid */}
                    <div className="feature-section">
                        <div className="group-title with-sub">
                            <span>Bundles</span>
                            <small>Hand-picked packs with value pricing</small>
                        </div>
                        <div className="bundle-grid">
                            {(bundles.length
                                ? bundles
                                : FeaturedEmptyFallback.bundles
                            ).map((b) => (
                                <div key={b.id} className="bundle-card">
                                    {b.tag && (
                                        <span
                                            className={`ribbon ribbon--${b.tag.toLowerCase()}`}
                                        >
                                            {b.tag}
                                        </span>
                                    )}
                                    <div
                                        className="bundle-media"
                                        style={{
                                            backgroundImage: `url(${
                                                b.imageUrl
                                                    ? b.imageUrl
                                                    : storeTile(
                                                          b.imageKey ??
                                                              `promo${b.id}`
                                                      ) // fallback naming: /icons/store/bundle_101.png
                                            })`,
                                        }}
                                    />
                                    <div className="bundle-body">
                                        <div className="bundle-title">
                                            {b.title}
                                        </div>
                                        {b.description && (
                                            <div className="bundle-desc">
                                                {b.description}
                                            </div>
                                        )}
                                        <div className="bundle-actions">
                                            <span className="price">
                                                <i className="ico ico-diamond-sm" />{" "}
                                                {b.price}
                                            </span>
                                            <button
                                                className="btn btn--buy"
                                                onClick={() =>
                                                    openConfirm(
                                                        "featured",
                                                        b.id
                                                    )
                                                }
                                            >
                                                Buy
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {featuredLoading && (
                            <div className="loading-row">Loading featured…</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "bubbles" && (
                <div className="appearance-group">
                    <div className="group-title with-sub">
                        <span>Chat Bubble Store</span>
                        <small>Click a locked item to unlock</small>
                    </div>
                    <div className="bubble-grid">
                        {bubbleItems.map((it) => renderCard("bubbles", it))}
                    </div>
                </div>
            )}

            {activeTab === "icons" && (
                <div className="appearance-group">
                    <div className="group-title with-sub">
                        <span>Name Icon Store</span>
                        <small>Click a locked item to unlock</small>
                    </div>
                    <div className="bubble-grid icons-mode">
                        {iconItems.map((it) => renderCard("icons", it))}
                    </div>
                </div>
            )}

            {activeTab === "tokens" && (
                <div className="tokens-wrap">
                    <div className="group-title with-sub">
                        <span>Tokens & Perks</span>
                        <small>VIP, Double XP and more</small>
                    </div>
                    <div className="token-grid">
                        {tokenItems.map((t) => {
                            const active =
                                !!t.owned &&
                                (!!t.activeUntilTs
                                    ? t.activeUntilTs > Date.now()
                                    : true);
                            return (
                                <div
                                    className={`token-card ${
                                        active ? "active" : ""
                                    }`}
                                    key={t.id}
                                >
                                    <div
                                        className={`token-icon token-${t.key.toLowerCase()}`}
                                        aria-hidden
                                    />
                                    <div className="token-body">
                                        <div className="token-title">
                                            {t.title}
                                        </div>
                                        <div className="token-sub">
                                            {t.durationHours
                                                ? fmtHours(t.durationHours)
                                                : "Permanent"}
                                            {active && t.activeUntilTs ? (
                                                <span className="token-active">
                                                    {" "}
                                                    • active until{" "}
                                                    {new Date(
                                                        t.activeUntilTs
                                                    ).toLocaleString()}
                                                </span>
                                            ) : active ? (
                                                <span className="token-active">
                                                    {" "}
                                                    • active
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="token-actions">
                                            {active ? (
                                                <span className="owned">
                                                    Owned
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="price">
                                                        <i className="ico ico-diamond-sm" />{" "}
                                                        {t.price}
                                                    </span>
                                                    <button
                                                        className="btn btn--buy"
                                                        onClick={() =>
                                                            openConfirm(
                                                                "tokens",
                                                                t.id
                                                            )
                                                        }
                                                    >
                                                        Buy
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {tokensLoading && (
                        <div className="loading-row">Loading tokens…</div>
                    )}
                </div>
            )}

            {/* Confirm */}
            {confirm && (
                <div
                    className="overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Confirm purchase"
                >
                    <div className="confirm-modal">
                        <div className="cm-header">
                            {confirm.kind === "featured" && (
                                <>Purchase Bundle #{confirm.id}</>
                            )}
                            {confirm.kind === "tokens" && (
                                <>Purchase Token #{confirm.id}</>
                            )}
                            {confirm.kind === "bubbles" && (
                                <>Unlock Chat Bubble #{confirm.id}</>
                            )}
                            {confirm.kind === "icons" && (
                                <>Unlock Name Icon #{confirm.id}</>
                            )}
                        </div>
                        <div className="cm-body">
                            {/* Minimal thumb region — could be improved with per-kind previews */}
                            <div className="cm-thumb bubble-thumb bubble-preview">
                                {confirm.kind === "bubbles" ? (
                                    <BubbleImg
                                        id={confirm.id}
                                        alt=""
                                        aria-hidden
                                    />
                                ) : confirm.kind === "icons" ? (
                                    <NameIconImg
                                        id={confirm.id}
                                        alt=""
                                        aria-hidden
                                    />
                                ) : (
                                    <div className="bundle-preview-block" />
                                )}
                            </div>
                            <div className="cm-copy">
                                <div className="line">
                                    <b>Price:</b>{" "}
                                    <span>
                                        <i className="ico ico-diamond-sm" />{" "}
                                        {priceOf(confirm.kind, confirm.id)}
                                    </span>
                                </div>
                                <div className="line">
                                    <b>Your balance:</b>{" "}
                                    <span>
                                        <i className="ico ico-diamond-sm" />{" "}
                                        {diamonds}
                                    </span>
                                </div>
                                {diamonds <
                                    priceOf(confirm.kind, confirm.id) && (
                                    <div className="warn">
                                        Not enough diamonds.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="cm-actions">
                            <button
                                className="btn"
                                onClick={() => setConfirm(null)}
                                disabled={purchaseBusy}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn--confirm"
                                onClick={() =>
                                    doPurchase(confirm.kind, confirm.id)
                                }
                                disabled={
                                    purchaseBusy ||
                                    diamonds < priceOf(confirm.kind, confirm.id)
                                }
                            >
                                {purchaseBusy ? "Processing…" : "Buy"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Shell>
    );
};

export default DiamondsStoreView;
