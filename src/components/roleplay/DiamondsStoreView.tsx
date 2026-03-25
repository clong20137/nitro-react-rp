import { FC, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SendMessageComposer, GetSessionDataManager } from "../../api";

import { RequestTokenStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestTokenStoreComposer";
import { PurchaseTokenComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PurchaseTokenComposer";
import { RequestChatBubbleStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestChatBubbleStoreComposer";
import { PurchaseChatBubbleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PurchaseChatBubbleComposer";
import { RequestNameIconStoreComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/RequestNameIconStoreComposer";
import { PurchaseNameIconComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/PurchaseNameIconComposer";

import "./DiamondStoreView.scss";

const EVT_STORE_RAW = "chat_bubble_shop";
const EVT_PURCHASE_OK_RAW = "chat_bubble_purchase_ok_raw";
const EVT_PURCHASE_FAIL_RAW = "chat_bubble_purchase_fail_raw";

const EVT_ICON_STORE_RAW = "name_icon_shop";
const EVT_ICON_PURCHASE_OK_RAW = "name_icon_purchase_ok_raw";
const EVT_ICON_PURCHASE_FAIL_RAW = "name_icon_purchase_fail_raw";

const EVT_FEATURED_STORE_RAW = "store_featured_shop";
const EVT_FEATURED_PURCHASE_OK_RAW = "store_featured_purchase_ok_raw";
const EVT_FEATURED_PURCHASE_FAIL_RAW = "store_featured_purchase_fail_raw";

const EVT_TOKENS_STORE_RAW = "store_tokens_shop";
const EVT_TOKENS_PURCHASE_OK_RAW = "store_tokens_purchase_ok_raw";
const EVT_TOKENS_PURCHASE_FAIL_RAW = "store_tokens_purchase_fail_raw";

const BUBBLE_ASSET_BASE = "/nitro/icons/chatbubbles";
const NAMEICON_ASSET_BASE = "/nitro/icons/nameicons";

const bubbleGif = (id: number) => `${BUBBLE_ASSET_BASE}/bubble_${id}.gif`;
const bubblePng = (id: number) => `${BUBBLE_ASSET_BASE}/bubble_${id}.png`;
const nameIconPng = (id: number) => `${NAMEICON_ASSET_BASE}/${id}.png`;

const BubbleImg: FC<{
    id: number;
    className?: string;
    alt?: string;
    "aria-hidden"?: boolean;
}> = ({ id, className, alt = "", ...rest }) => {
    const [src, setSrc] = useState<string>(bubblePng(id));
    const stateRef = useRef({ pngLoaded: false, pngErrored: false, gifLoaded: false });

    useEffect(() => {
        let alive = true;
        const png = new Image();
        const gif = new Image();
        const pngUrl = bubblePng(id);
        const gifUrl = bubbleGif(id);

        png.onload = () => {
            if(!alive) return;
            stateRef.current.pngLoaded = true;
            setSrc(pngUrl);
        };
        png.onerror = () => {
            if(!alive) return;
            stateRef.current.pngErrored = true;
            if(stateRef.current.gifLoaded) setSrc(gifUrl);
        };
        png.src = pngUrl;

        gif.onload = () => {
            if(!alive) return;
            stateRef.current.gifLoaded = true;
            if(stateRef.current.pngErrored) setSrc(gifUrl);
        };
        gif.onerror = () => {};
        gif.src = gifUrl;

        return () => {
            alive = false;
        };
    }, [id]);

    return <img src={src} className={className} alt={alt} {...rest} />;
};

const NameIconImg: FC<{
    id: number;
    className?: string;
    alt?: string;
    "aria-hidden"?: boolean;
}> = ({ id, className, alt = "", ...rest }) => <img src={nameIconPng(id)} className={className} alt={alt} draggable={false} {...rest} />;

const Shell: FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ title, onClose, children }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const drag = useRef<{ dx: number; dy: number; on: boolean }>({ dx: 0, dy: 0, on: false });

    useEffect(() => {
        const el = ref.current;
        if(!el) return;

        const width = 640;
        const height = 690;
        el.style.left = Math.max(12, window.innerWidth - width - 18) + "px";
        el.style.top = "72px";
        el.style.width = width + "px";
        el.style.height = height + "px";
        el.style.position = "fixed";
    }, []);

    const onDown = (e: React.MouseEvent) => {
        const el = ref.current;
        if(!el) return;

        const rect = el.getBoundingClientRect();
        drag.current.on = true;
        drag.current.dx = e.clientX - rect.left;
        drag.current.dy = e.clientY - rect.top;

        const onMove = (ev: MouseEvent) => {
            if(!drag.current.on) return;

            const x = Math.min(Math.max(0, ev.clientX - drag.current.dx), window.innerWidth - rect.width);
            const y = Math.min(Math.max(0, ev.clientY - drag.current.dy), window.innerHeight - 40);
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
        const timeout = window.setTimeout(() => setEnter(false), 320);
        return () => window.clearTimeout(timeout);
    }, []);

    return (
        <div ref={ref} className={`ds-root ${enter ? "is-entering" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
            <div className="ds-header" onMouseDown={onDown}>
                <div className="ds-title">
                    <i className="ico ico-diamond-sm" />
                    <span>{title}</span>
                </div>
                <button className="ds-close" aria-label="Close" onClick={onClose} onMouseDown={event => event.stopPropagation()} />
            </div>
            <div className="ds-body">{children}</div>
        </div>
    );
};

type StoreItem = { id: number; price: number; owned: boolean };
type RawItem = { bubbleId: number; price: number; owned: boolean; equipped?: boolean };
type RawPayload = { items: RawItem[]; diamonds?: number; equippedId?: number };
type IconRawItem = { iconId: number; price: number; owned: boolean; equipped?: boolean };
type IconRawPayload = { items: IconRawItem[]; diamonds?: number; equippedId?: number };

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
    imageUrl?: string;
    imageKey?: string;
    tag?: "BEST" | "HOT" | "NEW";
};

type FeaturedPayload = {
    diamonds?: number;
    banners?: FeaturedBanner[];
    bundles: FeaturedBundle[];
};

type TokenItem = {
    id: number;
    key: "VIP" | "DOUBLE_XP" | string;
    title: string;
    durationHours?: number;
    price: number;
    owned?: boolean;
    activeUntilTs?: number;
    imageKey?: string;
};

type TokensPayload = {
    diamonds?: number;
    items: TokenItem[];
};

export const DiamondsStoreView: FC<{ onClose: () => void }> = ({ onClose }) => {
    type TabKey = "featured" | "bubbles" | "icons" | "tokens";

    const [activeTab, setActiveTab] = useState<TabKey>("featured");
    const [diamonds, setDiamonds] = useState<number>(() => {
        try {
            return Number((GetSessionDataManager() as any)?.diamonds ?? 0);
        }
        catch {
            return 0;
        }
    });

    const [banners, setBanners] = useState<FeaturedBanner[]>([]);
    const [bundles, setBundles] = useState<FeaturedBundle[]>([]);
    const [featuredLoading, setFeaturedLoading] = useState(false);

    const [storeBubbles, setStoreBubbles] = useState<Map<number, StoreItem>>(new Map());
    const [equippedBubbleId, setEquippedBubbleId] = useState(0);

    const [storeIcons, setStoreIcons] = useState<Map<number, StoreItem>>(new Map());
    const [equippedIconId, setEquippedIconId] = useState(0);

    const [tokenItems, setTokenItems] = useState<TokenItem[]>([]);
    const [tokensLoading, setTokensLoading] = useState(false);

    const [confirm, setConfirm] = useState<{ kind: TabKey; id: number } | null>(null);
    const [confirmClosing, setConfirmClosing] = useState(false);
    const [purchaseBusy, setPurchaseBusy] = useState(false);

    const storeTile = useCallback((key: string) => `/icons/store/${key}.png`, []);

    const closeConfirm = useCallback(() => {
        if(!confirm) return;

        setConfirmClosing(true);

        window.setTimeout(() => {
            setConfirm(null);
            setConfirmClosing(false);
        }, 190);
    }, [confirm]);

    useEffect(() => {
        const onDiamondUpdate = (event: Event) => {
            const { detail } = event as CustomEvent<{ amount: number }>;
            if(detail && typeof detail.amount === "number") setDiamonds(Number(detail.amount) || 0);
        };

        window.addEventListener("diamond_balance_update", onDiamondUpdate as EventListener);
        return () => window.removeEventListener("diamond_balance_update", onDiamondUpdate as EventListener);
    }, []);

    const requestBubbleStore = useCallback(() => {
        try {
            SendMessageComposer(new RequestChatBubbleStoreComposer());
        }
        catch(error) {
            console.error("[DiamondStore] RequestChatBubbleStoreComposer failed", error);
        }
    }, []);

    const requestIconStore = useCallback(() => {
        try {
            SendMessageComposer(new RequestNameIconStoreComposer());
        }
        catch(error) {
            console.error("[DiamondStore] RequestNameIconStoreComposer failed", error);
        }
    }, []);

    const requestTokensStore = useCallback(() => {
        try {
            setTokensLoading(true);
            SendMessageComposer(new RequestTokenStoreComposer());
        }
        catch(error) {
            setTokensLoading(false);
            console.error("[DiamondStore] RequestTokenStoreComposer failed", error);
        }
    }, []);

    useEffect(() => {
        requestTokensStore();
        requestBubbleStore();
        requestIconStore();
    }, [requestBubbleStore, requestIconStore, requestTokensStore]);

    useEffect(() => {
        const onRawShop = (event: Event) => {
            const { detail } = event as CustomEvent<RawPayload>;
            if(!detail) return;

            const next = new Map<number, StoreItem>();
            for(const item of detail.items || []) {
                next.set(item.bubbleId, {
                    id: item.bubbleId,
                    price: Number(item.price),
                    owned: !!item.owned
                });
            }

            setStoreBubbles(next);
            if(typeof detail.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);

            const equipped = typeof detail.equippedId === "number"
                ? detail.equippedId
                : (detail.items || []).find(item => item.equipped)?.bubbleId || 0;

            setEquippedBubbleId(Number(equipped) || 0);
        };

        const onRawOk = (event: Event) => {
            const { detail } = event as CustomEvent<{ bubbleId: number; diamonds?: number }>;
            if(!detail) return;

            const id = Number(detail.bubbleId);
            setPurchaseBusy(false);
            closeConfirm();

            setStoreBubbles(prev => {
                const next = new Map(prev);
                const current = next.get(id) || { id, price: 0, owned: false };
                next.set(id, { ...current, owned: true });
                return next;
            });

            if(typeof detail.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);

            window.dispatchEvent(new CustomEvent("settings:chat_bubbles_owned", {
                detail: {
                    items: [{ id, owned: true }],
                    equippedId: undefined
                }
            }));
        };

        const onRawFail = (event: Event) => {
            const { detail } = event as CustomEvent<{ bubbleId: number; reason?: string }>;
            console.warn("[DiamondStore] bubble purchase FAIL", detail?.bubbleId, detail?.reason);
            setPurchaseBusy(false);
        };

        window.addEventListener(EVT_STORE_RAW, onRawShop as EventListener);
        window.addEventListener(EVT_PURCHASE_OK_RAW, onRawOk as EventListener);
        window.addEventListener(EVT_PURCHASE_FAIL_RAW, onRawFail as EventListener);

        return () => {
            window.removeEventListener(EVT_STORE_RAW, onRawShop as EventListener);
            window.removeEventListener(EVT_PURCHASE_OK_RAW, onRawOk as EventListener);
            window.removeEventListener(EVT_PURCHASE_FAIL_RAW, onRawFail as EventListener);
        };
    }, []);

    useEffect(() => {
        const onIconShop = (event: Event) => {
            const { detail } = event as CustomEvent<IconRawPayload>;
            if(!detail) return;

            const next = new Map<number, StoreItem>();
            for(const item of detail.items || []) {
                next.set(item.iconId, {
                    id: item.iconId,
                    price: Number(item.price),
                    owned: !!item.owned
                });
            }

            setStoreIcons(next);
            if(typeof detail.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);

            const equipped = typeof detail.equippedId === "number"
                ? detail.equippedId
                : (detail.items || []).find(item => item.equipped)?.iconId || 0;

            setEquippedIconId(Number(equipped) || 0);
        };

        const onIconOk = (event: Event) => {
            const { detail } = event as CustomEvent<{ iconId: number; diamonds?: number }>;
            if(!detail) return;

            const id = Number(detail.iconId);
            setPurchaseBusy(false);
            closeConfirm();

            setStoreIcons(prev => {
                const next = new Map(prev);
                const current = next.get(id) || { id, price: 0, owned: false };
                next.set(id, { ...current, owned: true });
                return next;
            });

            if(typeof detail.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);

            window.dispatchEvent(new CustomEvent("settings:name_icons_owned", {
                detail: {
                    items: [{ id, owned: true }],
                    equippedId: undefined
                }
            }));
        };

        const onIconFail = (event: Event) => {
            const { detail } = event as CustomEvent<{ iconId: number; reason?: string }>;
            console.warn("[DiamondStore] name icon purchase FAIL", detail?.iconId, detail?.reason);
            setPurchaseBusy(false);
        };

        window.addEventListener(EVT_ICON_STORE_RAW, onIconShop as EventListener);
        window.addEventListener(EVT_ICON_PURCHASE_OK_RAW, onIconOk as EventListener);
        window.addEventListener(EVT_ICON_PURCHASE_FAIL_RAW, onIconFail as EventListener);

        return () => {
            window.removeEventListener(EVT_ICON_STORE_RAW, onIconShop as EventListener);
            window.removeEventListener(EVT_ICON_PURCHASE_OK_RAW, onIconOk as EventListener);
            window.removeEventListener(EVT_ICON_PURCHASE_FAIL_RAW, onIconFail as EventListener);
        };
    }, []);

    useEffect(() => {
        const onFeatured = (event: Event) => {
            const { detail } = event as CustomEvent<FeaturedPayload>;
            if(!detail) return;

            setFeaturedLoading(false);
            if(Array.isArray(detail.banners)) setBanners(detail.banners);
            setBundles(detail.bundles || []);
            if(typeof detail.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);
        };

        const onFeaturedOk = (event: Event) => {
            const { detail } = event as CustomEvent<{ bundleId: number; diamonds?: number }>;
            setPurchaseBusy(false);
            closeConfirm();
            if(typeof detail?.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);
        };

        const onFeaturedFail = (event: Event) => {
            const { detail } = event as CustomEvent<{ bundleId: number; reason?: string }>;
            console.warn("[DiamondStore] bundle purchase FAIL", detail?.bundleId, detail?.reason);
            setPurchaseBusy(false);
        };

        window.addEventListener(EVT_FEATURED_STORE_RAW, onFeatured as EventListener);
        window.addEventListener(EVT_FEATURED_PURCHASE_OK_RAW, onFeaturedOk as EventListener);
        window.addEventListener(EVT_FEATURED_PURCHASE_FAIL_RAW, onFeaturedFail as EventListener);

        return () => {
            window.removeEventListener(EVT_FEATURED_STORE_RAW, onFeatured as EventListener);
            window.removeEventListener(EVT_FEATURED_PURCHASE_OK_RAW, onFeaturedOk as EventListener);
            window.removeEventListener(EVT_FEATURED_PURCHASE_FAIL_RAW, onFeaturedFail as EventListener);
        };
    }, []);

    useEffect(() => {
        const onTokens = (event: Event) => {
            const { detail } = event as CustomEvent<TokensPayload>;
            if(!detail) return;

            setTokensLoading(false);
            setTokenItems(detail.items || []);
            if(typeof detail.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);
        };

        const onTokensOk = (event: Event) => {
            const { detail } = event as CustomEvent<{ tokenId: number; diamonds?: number; activeUntilTs?: number }>;
            setPurchaseBusy(false);
            closeConfirm();

            if(typeof detail?.diamonds === "number") setDiamonds(Number(detail.diamonds) || 0);
            if(typeof detail?.tokenId === "number") {
                setTokenItems(prev => prev.map(item => item.id === detail.tokenId
                    ? { ...item, owned: true, activeUntilTs: detail.activeUntilTs ?? item.activeUntilTs }
                    : item));
            }
        };

        const onTokensFail = (event: Event) => {
            const { detail } = event as CustomEvent<{ tokenId: number; reason?: string }>;
            console.warn("[DiamondStore] token purchase FAIL", detail?.tokenId, detail?.reason);
            setPurchaseBusy(false);
        };

        window.addEventListener(EVT_TOKENS_STORE_RAW, onTokens as EventListener);
        window.addEventListener(EVT_TOKENS_PURCHASE_OK_RAW, onTokensOk as EventListener);
        window.addEventListener(EVT_TOKENS_PURCHASE_FAIL_RAW, onTokensFail as EventListener);

        return () => {
            window.removeEventListener(EVT_TOKENS_STORE_RAW, onTokens as EventListener);
            window.removeEventListener(EVT_TOKENS_PURCHASE_OK_RAW, onTokensOk as EventListener);
            window.removeEventListener(EVT_TOKENS_PURCHASE_FAIL_RAW, onTokensFail as EventListener);
        };
    }, []);

    const openConfirm = (kind: TabKey, id: number) => {
        if(kind === "bubbles") {
            const item = storeBubbles.get(id);
            if(!item || item.owned) return;
        }

        if(kind === "icons") {
            const item = storeIcons.get(id);
            if(!item || item.owned) return;
        }

        if(kind === "tokens") {
            const token = tokenItems.find(item => item.id === id);
            if(!token || token.owned || diamonds < token.price) return;

            try {
                setPurchaseBusy(true);

                const safety = window.setTimeout(() => {
                    setPurchaseBusy(false);
                    console.warn("[DiamondStore] Token purchase timed out (no server reply)");
                }, 8000);

                SendMessageComposer(new PurchaseTokenComposer(id));

                const clearOnAny = () => window.clearTimeout(safety);
                window.addEventListener(EVT_TOKENS_PURCHASE_OK_RAW, clearOnAny as EventListener, { once: true });
                window.addEventListener(EVT_TOKENS_PURCHASE_FAIL_RAW, clearOnAny as EventListener, { once: true });
            }
            catch(error) {
                setPurchaseBusy(false);
                console.error("[DiamondStore] PurchaseTokenComposer failed", error);
            }

            return;
        }

        setConfirmClosing(false);
        setConfirm({ kind, id });
    };

    const doPurchase = (kind: TabKey, id: number) => {
        if(kind === "bubbles") {
            const item = storeBubbles.get(id);
            if(!item || item.owned || diamonds < item.price) return closeConfirm();

            try {
                setPurchaseBusy(true);
                SendMessageComposer(new PurchaseChatBubbleComposer(id));
            }
            catch(error) {
                setPurchaseBusy(false);
                console.error("[DiamondStore] PurchaseChatBubbleComposer failed", error);
            }
            return;
        }

        if(kind === "icons") {
            const item = storeIcons.get(id);
            if(!item || item.owned || diamonds < item.price) return closeConfirm();

            try {
                setPurchaseBusy(true);
                SendMessageComposer(new PurchaseNameIconComposer(id));
            }
            catch(error) {
                setPurchaseBusy(false);
                console.error("[DiamondStore] PurchaseNameIconComposer failed", error);
            }
        }
    };

    const bubbleItems = useMemo(() => Array.from(storeBubbles.values()).sort((a, b) => a.id - b.id), [storeBubbles]);
    const iconItems = useMemo(() => Array.from(storeIcons.values()).sort((a, b) => a.id - b.id), [storeIcons]);
    const ownedBubbleCount = bubbleItems.filter(item => item.owned).length;
    const ownedIconCount = iconItems.filter(item => item.owned).length;
    const activeTokenCount = tokenItems.filter(item => !!item.owned && (!item.activeUntilTs || item.activeUntilTs > Date.now())).length;

    const FeaturedEmptyFallback: FeaturedPayload = {
        banners: [
            {
                id: "a",
                imageUrl: "/icons/store/promo1.png",
                headline: "Exclusive Christmas Package",
                sub: "Get prepared for the holiday season."
            },
            {
                id: "b",
                imageUrl: "/icons/store/promo2.png",
                headline: "VIP Perks",
                sub: "Unlock exclusive benefits"
            }
        ],
        bundles: [
            {
                id: 101,
                title: "Starter Bundle",
                description: "Coins + Diamonds + Bubble",
                price: 200,
                imageUrl: "/icons/store/promo3.png",
                tag: "NEW"
            },
            {
                id: 102,
                title: "VIP Bundle",
                description: "30d VIP + 300 Diamonds",
                price: 600,
                imageUrl: "/icons/store/promo4.png",
                tag: "BEST"
            },
            {
                id: 103,
                title: "Pet Bundle",
                description: "Get exclusive pet for 1000 diamonds!",
                price: 350,
                imageUrl: "/icons/store/promo5.png",
                tag: "HOT"
            }
        ]
    };

    const fmtHours = (hours?: number) => {
        if(!hours || hours <= 0) return "";
        if(hours % 24 === 0) return `${Math.floor(hours / 24)} day${hours >= 48 ? "s" : ""}`;
        return `${hours}h`;
    };

    const priceOf = (kind: TabKey, id: number): number => {
        if(kind === "bubbles") return storeBubbles.get(id)?.price ?? 0;
        if(kind === "icons") return storeIcons.get(id)?.price ?? 0;
        if(kind === "tokens") return tokenItems.find(item => item.id === id)?.price ?? 0;
        if(kind === "featured") return bundles.find(bundle => bundle.id === id)?.price ?? 0;
        return 0;
    };

    const currentTabMeta = {
        featured: {
            eyebrow: "Featured deals",
            title: "Seasonal bundles and premium packs",
            subtitle: "Discover curated offers, promos and limited-time rewards.",
            icon: "star",
            statLabel: `${(bundles.length ? bundles : FeaturedEmptyFallback.bundles).length} bundles`
        },
        bubbles: {
            eyebrow: "Speech style",
            title: "Upgrade your chat bubble collection",
            subtitle: "Buy new bubble looks with diamonds and equip them in your settings.",
            icon: "comment-dots",
            statLabel: `${ownedBubbleCount} owned`
        },
        icons: {
            eyebrow: "Identity flair",
            title: "Show off icons before your username",
            subtitle: "Unlock icon options and equip your favorite one from settings.",
            icon: "id-badge",
            statLabel: `${ownedIconCount} owned`
        },
        tokens: {
            eyebrow: "Perks and boosts",
            title: "Keep your roleplay perks active",
            subtitle: "VIP access, Double XP and future token perks all live here.",
            icon: "gem",
            statLabel: `${activeTokenCount} active`
        }
    }[activeTab];

    const renderStoreCard = (kind: "bubbles" | "icons", item: StoreItem) => {
        const isEquipped = kind === "bubbles" ? item.id === equippedBubbleId : item.id === equippedIconId;
        const isLocked = !item.owned;

        return (
            <button
                type="button"
                key={`${kind}-${item.id}`}
                className={`bubble-card ${isLocked ? "locked" : ""} ${isEquipped ? "selected" : ""}`}
                onClick={() => (isLocked ? openConfirm(kind, item.id) : undefined)}
                title={isLocked ? `Unlock for ${item.price}` : isEquipped ? "Equipped" : "Owned"}
                aria-label={isLocked
                    ? `Unlock ${kind === "bubbles" ? "bubble" : "name icon"} ${item.id}`
                    : `${kind === "bubbles" ? "Bubble" : "Name icon"} ${item.id} ${isEquipped ? "equipped" : "owned"}`}
            >
                {isLocked && <span className="ribbon">LOCKED</span>}
                {isEquipped && !isLocked && <span className="card-state-badge">Equipped</span>}
                <div className={`bubble-thumb ${kind} ${kind}-${item.id}`}>
                    {kind === "bubbles" ? <BubbleImg id={item.id} alt="" aria-hidden /> : <NameIconImg id={item.id} alt="" aria-hidden />}
                </div>
                <div className="price-row">
                    {isLocked
                        ? <span className="price"><i className="ico ico-diamond-sm" /> {item.price}</span>
                        : <span className={`owned ${isEquipped ? "is-equipped" : ""}`}>{isEquipped ? "Equipped" : "Owned"}</span>}
                </div>
            </button>
        );
    };

    return (
        <Shell title="Diamond Store" onClose={onClose}>
            <div className="rp-tabs ds-tabs" role="tablist" aria-label="Store categories">
                <button className={`rp-tab ${activeTab === "featured" ? "active" : ""}`} role="tab" aria-selected={activeTab === "featured"} onClick={() => setActiveTab("featured")}>
                    <FontAwesomeIcon className="rp-tab__icon" icon="star" />
                    <span className="rp-tab__label">Featured</span>
                </button>
                <button className={`rp-tab ${activeTab === "bubbles" ? "active" : ""}`} role="tab" aria-selected={activeTab === "bubbles"} onClick={() => setActiveTab("bubbles")}>
                    <FontAwesomeIcon className="rp-tab__icon" icon="comment-dots" />
                    <span className="rp-tab__label">Chat Bubbles</span>
                </button>
                <button className={`rp-tab ${activeTab === "icons" ? "active" : ""}`} role="tab" aria-selected={activeTab === "icons"} onClick={() => setActiveTab("icons")}>
                    <FontAwesomeIcon className="rp-tab__icon" icon="id-badge" />
                    <span className="rp-tab__label">Name Icons</span>
                </button>
                <button className={`rp-tab ${activeTab === "tokens" ? "active" : ""}`} role="tab" aria-selected={activeTab === "tokens"} onClick={() => setActiveTab("tokens")}>
                    <FontAwesomeIcon className="rp-tab__icon" icon="gem" />
                    <span className="rp-tab__label">Tokens</span>
                </button>
            </div>

            <div className="ds-topbar">
                <div className="ds-hero-card">
                    <div className="ds-hero-copy">
                        <div className="ds-hero-eyebrow">{currentTabMeta.eyebrow}</div>
                        <div className="ds-hero-title-row">
                            <FontAwesomeIcon className="ds-hero-icon" icon={currentTabMeta.icon as any} />
                            <h2 className="ds-hero-title">{currentTabMeta.title}</h2>
                        </div>
                        <p className="ds-hero-subtitle">{currentTabMeta.subtitle}</p>
                    </div>
                    <div className="ds-wallet-card" aria-label="Wallet">
                        <div className="ds-wallet-label">Available diamonds</div>
                        <div className="ds-wallet-value"><i className="ico ico-diamond-sm" /> {diamonds}</div>
                        <div className="ds-wallet-meta">{currentTabMeta.statLabel}</div>
                    </div>
                </div>

                <div className="ds-quick-stats">
                    <div className="ds-stat-chip"><span className="label">Chat bubbles</span><strong>{ownedBubbleCount}</strong></div>
                    <div className="ds-stat-chip"><span className="label">Name icons</span><strong>{ownedIconCount}</strong></div>
                    <div className="ds-stat-chip"><span className="label">Active perks</span><strong>{activeTokenCount}</strong></div>
                </div>
            </div>

            <div className="rp-tab-panel rp-tab-panel--animated ds-panel" key={activeTab}>
                {activeTab === "featured" && (
                    <div className="featured-wrap">
                        <div className="section-head">
                            <div>
                                <div className="section-title">Featured storefront</div>
                                <div className="section-subtitle">Highlighted packs and rotating offers.</div>
                            </div>
                        </div>

                        <div className="featured-banners">
                            {(banners.length ? banners : FeaturedEmptyFallback.banners ?? []).map(banner => (
                                <div
                                    key={banner.id}
                                    className="banner-tile"
                                    role={banner.link ? "button" : undefined}
                                    onClick={() => banner.link
                                        ? window.dispatchEvent(new CustomEvent("store_banner_click", { detail: { id: banner.id, link: banner.link } }))
                                        : null}>
                                    <img src={banner.imageUrl} alt={banner.headline || "banner"} draggable={false} />
                                    {(banner.headline || banner.sub) && (
                                        <div className="banner-copy">
                                            {banner.headline && <div className="banner-h">{banner.headline}</div>}
                                            {banner.sub && <div className="banner-s">{banner.sub}</div>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="feature-section store-section-card">
                            <div className="group-title with-sub">
                                <span>Bundles</span>
                                <small>Hand-picked packs with value pricing</small>
                            </div>
                            <div className="bundle-grid">
                                {(bundles.length ? bundles : FeaturedEmptyFallback.bundles).map(bundle => (
                                    <div key={bundle.id} className="bundle-card">
                                        {bundle.tag && <span className={`ribbon ribbon--${bundle.tag.toLowerCase()}`}>{bundle.tag}</span>}
                                        <div
                                            className="bundle-media"
                                            style={{
                                                backgroundImage: `url(${bundle.imageUrl ? bundle.imageUrl : storeTile(bundle.imageKey ?? `promo${bundle.id}`)})`
                                            }}
                                        />
                                        <div className="bundle-body">
                                            <div className="bundle-title">{bundle.title}</div>
                                            {bundle.description && <div className="bundle-desc">{bundle.description}</div>}
                                            <div className="bundle-actions">
                                                <span className="price"><i className="ico ico-diamond-sm" /> {bundle.price}</span>
                                                <button className="btn btn--buy" onClick={() => openConfirm("featured", bundle.id)}>Buy</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {featuredLoading && <div className="loading-row">Loading featured…</div>}
                        </div>
                    </div>
                )}

                {activeTab === "bubbles" && (
                    <div className="appearance-group store-section-card">
                        <div className="group-title with-sub">
                            <span>Chat Bubble Store</span>
                            <small>Click a locked item to unlock. Owned items can be equipped from Settings.</small>
                        </div>
                        <div className="bubble-grid">
                            {bubbleItems.map(item => renderStoreCard("bubbles", item))}
                        </div>
                    </div>
                )}

                {activeTab === "icons" && (
                    <div className="appearance-group store-section-card">
                        <div className="group-title with-sub">
                            <span>Name Icon Store</span>
                            <small>Unlock icons to place them before your username in speech bubbles.</small>
                        </div>
                        <div className="bubble-grid icons-mode">
                            {iconItems.map(item => renderStoreCard("icons", item))}
                        </div>
                    </div>
                )}

                {activeTab === "tokens" && (
                    <div className="tokens-wrap">
                        <div className="store-section-card">
                            <div className="group-title with-sub">
                                <span>Tokens &amp; Perks</span>
                                <small>VIP, Double XP and future roleplay boosts.</small>
                            </div>
                            <div className="token-grid">
                                {tokenItems.map(token => {
                                    const isActive = !!token.owned && (!token.activeUntilTs || token.activeUntilTs > Date.now());

                                    return (
                                        <div className={`token-card ${isActive ? "active" : ""}`} key={token.id}>
                                            {token.imageKey
                                                ? <img className="token-icon-img" src={`/icons/store/${token.imageKey}.png`} alt="" aria-hidden draggable={false} />
                                                : <div className={`token-icon token-${token.key.toLowerCase()}`} aria-hidden />}

                                            <div className="token-body">
                                                <div className="token-title">{token.title}</div>
                                                <div className="token-sub">
                                                    {token.durationHours ? fmtHours(token.durationHours) : "Permanent"}
                                                    {isActive && token.activeUntilTs
                                                        ? <span className="token-active"> • active until {new Date(token.activeUntilTs).toLocaleString()}</span>
                                                        : isActive
                                                            ? <span className="token-active"> • active</span>
                                                            : null}
                                                </div>
                                                <div className="token-actions">
                                                    {isActive
                                                        ? <span className="owned">Owned</span>
                                                        : (
                                                            <>
                                                                <span className="price"><i className="ico ico-diamond-sm" /> {token.price}</span>
                                                                <button className="btn btn--buy" onClick={() => openConfirm("tokens", token.id)}>Buy</button>
                                                            </>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {tokensLoading && <div className="loading-row">Loading tokens…</div>}
                        </div>
                    </div>
                )}
            </div>

            {confirm && (
                <div className={`overlay ${confirmClosing ? "is-closing" : "is-open"}`} role="dialog" aria-modal="true" aria-label="Confirm purchase">
                    <div className={`confirm-modal ${confirmClosing ? "is-closing" : "is-open"}`}>
                        <div className="cm-header">
                            {confirm.kind === "featured" && <>Purchase Bundle #{confirm.id}</>}
                            {confirm.kind === "tokens" && <>Purchase Token #{confirm.id}</>}
                            {confirm.kind === "bubbles" && <>Unlock Chat Bubble #{confirm.id}</>}
                            {confirm.kind === "icons" && <>Unlock Name Icon #{confirm.id}</>}
                        </div>
                        <div className="cm-body">
                            <div className="cm-thumb bubble-thumb bubble-preview">
                                {confirm.kind === "bubbles"
                                    ? <BubbleImg id={confirm.id} alt="" aria-hidden />
                                    : confirm.kind === "icons"
                                        ? <NameIconImg id={confirm.id} alt="" aria-hidden />
                                        : <div className="bundle-preview-block" />}
                            </div>
                            <div className="cm-copy">
                                <div className="line"><b>Price:</b> <span><i className="ico ico-diamond-sm" /> {priceOf(confirm.kind, confirm.id)}</span></div>
                                <div className="line"><b>Your balance:</b> <span><i className="ico ico-diamond-sm" /> {diamonds}</span></div>
                                {diamonds < priceOf(confirm.kind, confirm.id) && <div className="warn">Not enough diamonds.</div>}
                            </div>
                        </div>
                        <div className="cm-actions">
                            <button className="btn btn--cancel" onClick={() => closeConfirm()} disabled={purchaseBusy}>Cancel</button>
                            <button className="btn btn--confirm" onClick={() => doPurchase(confirm.kind, confirm.id)} disabled={purchaseBusy || diamonds < priceOf(confirm.kind, confirm.id)}>
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
