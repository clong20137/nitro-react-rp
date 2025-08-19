import React, {
    FC,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createRoot, Root } from "react-dom/client";

/* Reuse your global theme + blackjack classes */
//import "../blackjack/BlackjackView.scss";

/* ---- Wire these to your actual server composers ---- */
import { SendMessageComposer } from "../../api";

// - MarketplaceRequestMyListingsComposer()
// - MarketplaceCreateListingComposer(price: number, inventoryId: number, qty: number)
// - MarketplaceCancelListingComposer(listingId: number)
//import { MarketplaceRequestMyListingsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MarketplaceRequestMyListingsComposer";
//import { MarketplaceCreateListingComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MarketplaceCreateListingComposer";
//import { MarketplaceCancelListingComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/MarketplaceCancelListingComposer";

/* ========= Bootstrap ========= */
const MOUNT_ID = "olrp-market-root";
let marketRoot: Root | null = null;
let mounted = false;

function ensureMount() {
    if (mounted) return;
    let host = document.getElementById(MOUNT_ID);
    if (!host) {
        host = document.createElement("div");
        host.id = MOUNT_ID;
        document.body.appendChild(host);
    }
    if (!marketRoot) marketRoot = createRoot(host!);
    marketRoot!.render(<MarketplaceView />);
    mounted = true;
}

function replay(detail: any) {
    const d = { ...(detail || {}), __viaBootstrap: true };
    window.dispatchEvent(
        new CustomEvent("marketplace_module_result", { detail: d })
    );
}

function bootstrapListener(e: Event) {
    const ce = e as CustomEvent;
    const detail = ce.detail || {};
    if (detail.__viaBootstrap) return;
    ensureMount();
    setTimeout(() => replay(detail), 0);
}
window.addEventListener(
    "marketplace_module_result",
    bootstrapListener as EventListener
);

/* ========= Types ========= */
type Listing = {
    id: number;
    price: number;
    qty: number;
    itemId: number;
    displayName: string;
    iconUrl?: string;
    durability?: number; // 0..100
    maxDurability?: number; // 0..100
};

type MPState = {
    listings: Listing[];
};

type InventoryEntry = {
    inventoryId: number; // unique per user item
    baseId: number;
    name: string;
    iconUrl?: string;
    qty: number; // stack size (1 for equipment, >1 for consumables)
    durability?: number; // 0..100
    maxDurability?: number; // 0..100
    tradable?: boolean;
};

/* ========= Small helpers ========= */
const on = <T extends Event>(type: string, cb: (e: T) => void) =>
    window.addEventListener(type, cb as EventListener);
const off = <T extends Event>(type: string, cb: (e: T) => void) =>
    window.removeEventListener(type, cb as EventListener);

const POS_KEY = "olrp.market.pos";
const SIZE_KEY = "olrp.market.size";

/* ========= Row (My Listings) ========= */
const ListingRow: FC<{
    listing: Listing;
    onCancel: (id: number) => void;
}> = ({ listing, onCancel }) => {
    const {
        id,
        displayName,
        iconUrl,
        price,
        qty,
        durability = 100,
        maxDurability = 100,
    } = listing;

    const pct = Math.max(
        0,
        Math.min(100, Math.round((durability / (maxDurability || 100)) * 100))
    );

    return (
        <div className="mp-row">
            <div className="left">
                <div className="thumb">
                    {iconUrl ? (
                        <img src={iconUrl} alt={displayName} />
                    ) : (
                        <div className="thumb-fallback" />
                    )}
                    {qty > 1 && <span className="q">{qty}</span>}
                </div>
                <div className="meta">
                    <div className="name">{displayName}</div>
                    <div className="sub">
                        Durability: {pct}%{" "}
                        <span className="dur-bar">
                            <span style={{ width: `${pct}%` }} />
                        </span>
                    </div>
                    <div className="sub">Max Durability: {maxDurability}%</div>
                </div>
            </div>

            <div className="right">
                <div className="price">${price}</div>
                <button className="bj-btn" onClick={() => onCancel(id)}>
                    Cancel
                </button>
            </div>
        </div>
    );
};

/* ========= Inventory Picker ========= */
const InventoryGrid: FC<{
    items: InventoryEntry[];
    selectedId: number | null;
    onPick: (entry: InventoryEntry) => void;
}> = ({ items, selectedId, onPick }) => {
    return (
        <div className="mp-grid">
            {items.map((it) => {
                const pct = Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            (Number(it.durability || 0) /
                                (it.maxDurability || 100)) *
                                100
                        )
                    )
                );
                const chosen = selectedId === it.inventoryId;

                return (
                    <button
                        key={it.inventoryId}
                        className={`mp-cell ${chosen ? "chosen" : ""}`}
                        onClick={() => onPick(it)}
                        title={it.name}
                    >
                        <div className="icon">
                            {it.iconUrl ? (
                                <img src={it.iconUrl} alt={it.name} />
                            ) : (
                                <div className="thumb-fallback" />
                            )}
                            {it.qty > 1 && <span className="q">{it.qty}</span>}
                        </div>
                        <div className="info">
                            <div className="nm">{it.name}</div>
                            <div className="dur">
                                <span className="dur-bar">
                                    <span style={{ width: `${pct}%` }} />
                                </span>
                                <span className="pct">{pct}%</span>
                            </div>
                        </div>
                    </button>
                );
            })}
            {items.length === 0 && (
                <div className="mp-grid-empty">
                    No tradable items in your inventory.
                </div>
            )}
        </div>
    );
};

/* ========= Create dialog ========= */
const CreateDialog: FC<{
    open: boolean;
    onClose: () => void;
    onCreate: (price: number, inventoryId: number, qty: number) => void;
    inventory: InventoryEntry[];
}> = ({ open, onClose, onCreate, inventory }) => {
    const [price, setPrice] = useState<number>(150);
    const [qty, setQty] = useState<number>(1);
    const [picked, setPicked] = useState<InventoryEntry | null>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        // reset when opened
        if (open) {
            setPicked(null);
            setQty(1);
            setPrice(150);
        }
    }, [open]);

    if (!open) return null;

    const maxQty = Math.max(1, picked?.qty || 1);
    const canCreate = !!picked && price > 0 && qty > 0 && qty <= maxQty;

    return (
        <div className="mp-dialog">
            <div className="mp-panel">
                <div className="mp-title">Create Listing</div>

                {/* Picker */}
                <div className="mp-subtitle">Select an item</div>
                <InventoryGrid
                    items={inventory}
                    selectedId={picked?.inventoryId ?? null}
                    onPick={(it) => {
                        setPicked(it);
                        setQty(Math.min(it.qty || 1, qty));
                    }}
                />

                {/* Form */}
                <div className="mp-form">
                    <label>
                        Quantity
                        <input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={qty}
                            onChange={(e) =>
                                setQty(
                                    Math.min(
                                        maxQty,
                                        Math.max(1, Number(e.target.value) || 1)
                                    )
                                )
                            }
                            disabled={!picked}
                        />
                        <span className="hint">max {maxQty}</span>
                    </label>

                    <label>
                        Price
                        <input
                            type="number"
                            min={1}
                            value={price}
                            onChange={(e) =>
                                setPrice(
                                    Math.max(1, Number(e.target.value) || 1)
                                )
                            }
                        />
                    </label>
                </div>

                <div className="mp-actions">
                    <button className="bj-btn" onClick={onClose}>
                        Back
                    </button>
                    <button
                        className="bj-btn green"
                        disabled={!canCreate}
                        onClick={() =>
                            picked &&
                            onCreate(
                                price,
                                picked.inventoryId,
                                Math.min(qty, maxQty)
                            )
                        }
                    >
                        Create Listing
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ========= Main View ========= */
export const MarketplaceView: FC = () => {
    const [open, setOpen] = useState(false);

    // Drag / resize (same pattern as Blackjack)
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ w: 920, h: 620 });
    const dragging = useRef(false);
    const dragOff = useRef({ dx: 0, dy: 0 });
    const resizing = useRef(false);
    const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

    useLayoutEffect(() => {
        try {
            const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
            const s = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
            if (p && typeof p.x === "number" && typeof p.y === "number")
                setPos(p);
            if (s && typeof s.w === "number" && typeof s.h === "number")
                setSize(s);
        } catch {}
        if (!localStorage.getItem(POS_KEY)) {
            const vw = window.innerWidth,
                vh = window.innerHeight;
            setPos({
                x: Math.max(0, Math.round((vw - size.w) / 2)),
                y: Math.max(0, Math.round((vh - size.h) / 2)),
            });
        }
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (dragging.current) {
                setPos((p) => {
                    const x = e.clientX - dragOff.current.dx;
                    const y = e.clientY - dragOff.current.dy;
                    const maxX = Math.max(0, window.innerWidth - size.w);
                    const maxY = Math.max(0, window.innerHeight - size.h);
                    return {
                        x: Math.min(Math.max(0, x), maxX),
                        y: Math.min(Math.max(0, y), maxY),
                    };
                });
            } else if (resizing.current) {
                const dx = e.clientX - resizeStart.current.x;
                const dy = e.clientY - resizeStart.current.y;
                const W = Math.min(
                    Math.max(780, resizeStart.current.w + dx),
                    window.innerWidth - pos.x
                );
                const H = Math.min(
                    Math.max(520, resizeStart.current.h + dy),
                    window.innerHeight - pos.y
                );
                setSize({ w: W, h: H });
            }
        };
        const onUp = () => {
            if (dragging.current) {
                dragging.current = false;
                localStorage.setItem(POS_KEY, JSON.stringify(pos));
            }
            if (resizing.current) {
                resizing.current = false;
                localStorage.setItem(SIZE_KEY, JSON.stringify(size));
            }
            document.body.classList.remove("no-select");
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [pos, size]);

    const startDrag = (e: React.MouseEvent) => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        dragging.current = true;
        dragOff.current = {
            dx: e.clientX - rect.left,
            dy: e.clientY - rect.top,
        };
        document.body.classList.add("no-select");
    };
    const startResize = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        resizing.current = true;
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            w: rect.width,
            h: rect.height,
        };
        document.body.classList.add("no-select");
    };
    const close = () => setOpen(false);

    // Data
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [inventory, setInventory] = useState<InventoryEntry[]>([]);

    const refresh = () => {
        setLoading(true);
        try {
           // SendMessageComposer(new MarketplaceRequestMyListingsComposer());
        } catch {}
    };

    // Bootstrap: open UI
    useEffect(() => {
        const onOpen = (_e: CustomEvent) => {
            setOpen(true);
            setShowCreate(false);
            refresh();
        };
        on<CustomEvent>("marketplace_module_result", onOpen);
        return () => off<CustomEvent>("marketplace_module_result", onOpen);
    }, []);

    // Listings state from server
    useEffect(() => {
        const onState = (e: CustomEvent) => {
            const s = (e.detail || {}) as MPState;
            if (Array.isArray(s.listings)) setListings(s.listings);
            setLoading(false);
        };
        on<CustomEvent>("marketplace_state", onState);
        return () => off<CustomEvent>("marketplace_state", onState);
    }, []);

    // Inventory state from server (push this when module opens)
    useEffect(() => {
        const onInv = (e: CustomEvent) => {
            const detail = e.detail || {};
            const items = Array.isArray(detail.items) ? detail.items : [];
            // sanitize
            const safe: InventoryEntry[] = items.map((it: any) => ({
                inventoryId: Number(it.inventoryId) || 0,
                baseId: Number(it.baseId) || 0,
                name: String(it.name || "Unknown"),
                iconUrl: it.iconUrl || "",
                qty: Math.max(1, Number(it.qty) || 1),
                durability:
                    Number(it.durability ?? it.durabilityCurrent ?? 100) || 0,
                maxDurability: Number(it.maxDurability ?? 100) || 100,
                tradable: !!it.tradable,
            }));
            setInventory(safe.filter((x) => x.tradable !== false));
        };
        on<CustomEvent>("marketplace_inventory", onInv);
        return () => off<CustomEvent>("marketplace_inventory", onInv);
    }, []);

    // Actions
    const cancelListing = (id: number) => {
        try {
            //SendMessageComposer(new MarketplaceCancelListingComposer(id));
            setListings((rows) => rows.filter((r) => r.id !== id)); // optimistic
        } catch {}
    };

    const createListing = (price: number, inventoryId: number, qty: number) => {
        try {
          //  SendMessageComposer(
               // new MarketplaceCreateListingComposer(price, inventoryId, qty)
          //  );
        } finally {
            setShowCreate(false);
            setTimeout(refresh, 400);
        }
    };

    if (!open) return null;

    return (
        <div
            ref={rootRef}
            className="blackjack-view market-view"
            style={{
                position: "fixed",
                zIndex: 1100,
                left: pos.x,
                top: pos.y,
                width: size.w,
                height: size.h,
            }}
            role="dialog"
            aria-modal="true"
        >
            <div className="bj-header" onMouseDown={startDrag}>
                <button
                    className="bj-btn"
                    onClick={close}
                    style={{ marginRight: 8 }}
                >
                    Back
                </button>
                <span>Manage Sales</span>
                <div className="spacer" />
                <button
                    className="bj-btn green"
                    onClick={() => setShowCreate(true)}
                >
                    Create Listing
                </button>
            </div>

            <div className="market-body">
                <div className="market-title">My Listings</div>

                <div className={`market-scroll ${loading ? "loading" : ""}`}>
                    {listings.length === 0 && !loading ? (
                        <div className="market-empty">
                            You have no active listings.
                        </div>
                    ) : (
                        listings.map((row) => (
                            <ListingRow
                                key={row.id}
                                listing={row}
                                onCancel={cancelListing}
                            />
                        ))
                    )}
                </div>
            </div>

            <div
                className="resize-handle"
                onMouseDown={startResize}
                title="Resize"
            />

            {/* Create Listing dialog */}
            <CreateDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={createListing}
                inventory={inventory}
            />
        </div>
    );
};

export default MarketplaceView;
