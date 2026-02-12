import React, {
    FC,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import "./HaircutOfferView.scss";

import { FigureSetIdsMessageEvent } from "@nitrots/nitro-renderer";
import { useMessageEvent } from "../../hooks";

import {
    AvatarEditorUtilities,
    FigureData,
    GetSessionDataManager,
} from "../../api";
import { HeadModel } from "../../api";

import { HaircutSelectStyleComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/HaircutSelectStyleComposer";

// ✅ use the SAME preview pipeline as the avatar editor (guaranteed to render)
import { AvatarEditorFigurePreviewView } from "../avatar-editor/views/AvatarEditorFigurePreviewView";

// ✅ keep palettes using the working component
import { AvatarEditorPaletteSetView } from "../avatar-editor/views/palette-set/AvatarEditorPaletteSetView";

interface HaircutOfferPayload {
    offerId: number;
    stylistId: number;
    stylistName: string;
    price: number;
    baseFigure: string;
}

interface HaircutOfferViewProps {
    onClose?: () => void;
}

const POS_KEY = "haircut-offer-pos";
const SIZE_KEY = "haircut-offer-size";

const STYLES_PER_PAGE = 24; // ✅ 3 rows x 8 columns

// if these are in /public/icons
const COIN_ICON_SRC = "/icons/coins_small.png";
const LOADING_PLACEHOLDER_SRC = "/icons/placeholder.png";

// ✅ your banner (bundled)
const BANNER_BG = require("../../icons/banner_hairstyle.gif");

const safeStr = (v: any) => (typeof v === "string" ? v : "");
const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const extractHrSegment = (figure: string) => {
    const parts = safeStr(figure).split(".");
    for (const p of parts) if (p.startsWith("hr-")) return p;
    return "";
};

export const HaircutOfferView: FC<HaircutOfferViewProps> = ({ onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    const [payload, setPayload] = useState<HaircutOfferPayload>({
        offerId: 0,
        stylistId: 0,
        stylistName: "",
        price: 0,
        baseFigure: "",
    });

    const [figureSetIds, setFigureSetIds] = useState<number[]>([]);
    const [boundFurnitureNames, setBoundFurnitureNames] = useState<string[]>(
        []
    );

    const [figureData, setFigureData] = useState<FigureData | null>(null);
    const [headModel, setHeadModel] = useState<HeadModel | null>(null);
    const [hairCategory, setHairCategory] = useState<any>(null);

    const [maxPaletteCount, setMaxPaletteCount] = useState(1);

    // ✅ paging (kills lag)
    const [page, setPage] = useState(0);

    // ✅ thumb refresh batching
    const [thumbTick, setThumbTick] = useState(0);
    const rafRef = useRef<number>(0);

    const containerRef = useRef<HTMLDivElement | null>(null);

    // position (draggable)
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 140,
        y: 140,
    });
    const dragging = useRef(false);
    const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // size (resizable)
    const [size, setSize] = useState<{ width: number; height: number }>({
        width: 760,
        height: 560,
    });
    const resizing = useRef(false);
    const resizeStart = useRef<{ x: number; y: number; w: number; h: number }>({
        x: 0,
        y: 0,
        w: 760,
        h: 560,
    });

    // ✅ SAME EVENT the avatar editor uses
    useMessageEvent<FigureSetIdsMessageEvent>(
        FigureSetIdsMessageEvent,
        (event) => {
            const parser = event.getParser();
            setFigureSetIds(parser?.figureSetIds || []);
            setBoundFurnitureNames(parser?.boundsFurnitureNames || []);
        }
    );

    const clampToViewport = (x: number, y: number) => {
        const el = containerRef.current;
        if (!el) return { x, y };

        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const maxX = Math.max(0, vw - rect.width);
        const maxY = Math.max(0, vh - rect.height);

        return {
            x: Math.min(Math.max(0, x), maxX),
            y: Math.min(Math.max(0, y), maxY),
        };
    };

    // load persisted pos/size
    useLayoutEffect(() => {
        try {
            const p = localStorage.getItem(POS_KEY);
            if (p) {
                const parsed = JSON.parse(p);
                const x = Number(parsed?.x);
                const y = Number(parsed?.y);

                setPosition({
                    x: Number.isFinite(x) ? x : 140,
                    y: Number.isFinite(y) ? y : 140,
                });
            }

            const s = localStorage.getItem(SIZE_KEY);
            if (s) {
                const parsed = JSON.parse(s);
                const w = Number(parsed?.width);
                const h = Number(parsed?.height);

                setSize({
                    width: Math.max(700, Number.isFinite(w) ? w : 760),
                    height: Math.max(520, Number.isFinite(h) ? h : 560),
                });
            }
        } catch {
            // ignore
        }
    }, []);

    // open from bridge event
    useEffect(() => {
        const handler = (ev: Event) => {
            const detail = (ev as CustomEvent).detail as
                | Partial<HaircutOfferPayload>
                | undefined;
            if (!detail) return;

            setPayload({
                offerId: safeNum(detail.offerId),
                stylistId: safeNum(detail.stylistId),
                stylistName: safeStr(detail.stylistName),
                price: safeNum(detail.price),
                baseFigure: safeStr(detail.baseFigure),
            });

            setPage(0);
            setClosing(false);
            setIsVisible(true);
        };

        window.addEventListener(
            "haircut_styles_offer",
            handler as EventListener
        );
        return () =>
            window.removeEventListener(
                "haircut_styles_offer",
                handler as EventListener
            );
    }, []);

    // init FigureData + HeadModel + hr category
    useEffect(() => {
        if (!isVisible) return;
        if (!payload.baseFigure) return;

        const gender = GetSessionDataManager()?.gender || FigureData.MALE;

        const fd = new FigureData();
        fd.loadAvatarData(payload.baseFigure, gender);

        // mimic AvatarEditorView globals (TS-safe)
        (AvatarEditorUtilities as any).CURRENT_FIGURE = fd;
        (AvatarEditorUtilities as any).FIGURE_SET_IDS = figureSetIds;
        (AvatarEditorUtilities as any).BOUND_FURNITURE_NAMES =
            boundFurnitureNames;

        const hm = new HeadModel();
        hm.init?.();

        const hair = hm?.categories?.get?.("hr") || null;

        if (hair) {
            hair.init?.();

            // ✅ batch notify updates to avoid re-render spam
            if (Array.isArray(hair.parts)) {
                for (const p of hair.parts) {
                    if (!p) continue;

                    try {
                        const prev = p.notify;

                        p.notify = () => {
                            try {
                                if (typeof prev === "function") prev();
                            } catch {}

                            cancelAnimationFrame(rafRef.current);
                            rafRef.current = requestAnimationFrame(() =>
                                setThumbTick((t) => t + 1)
                            );
                        };
                    } catch {}
                }
            }

            // set palette count based on selected part
            let max = 1;
            for (const part of hair.parts || []) {
                if (!part || !part.isSelected) continue;
                max = part.maxColorIndex || 1;
                break;
            }
            setMaxPaletteCount(max);
        }

        setFigureData(fd);
        setHeadModel(hm);
        setHairCategory(hair);

        return () => {
            (AvatarEditorUtilities as any).CURRENT_FIGURE = undefined;
            (AvatarEditorUtilities as any).FIGURE_SET_IDS = undefined;
            (AvatarEditorUtilities as any).BOUND_FURNITURE_NAMES = undefined;

            cancelAnimationFrame(rafRef.current);
        };
    }, [isVisible, payload.baseFigure, figureSetIds, boundFurnitureNames]);

    // styles list (ignore "clear")
    const stylesAll = useMemo(() => {
        const parts = hairCategory?.parts || [];
        return parts.filter((p: any) => p && !p.isClear);
    }, [hairCategory, thumbTick]);

    const stylesCount = stylesAll.length;

    const pageCount = useMemo(() => {
        return Math.max(1, Math.ceil(stylesCount / STYLES_PER_PAGE));
    }, [stylesCount]);

    // keep page valid if count changes
    useEffect(() => {
        if (!isVisible) return;
        setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
    }, [isVisible, pageCount]);

    const stylesPage = useMemo(() => {
        const start = page * STYLES_PER_PAGE;
        return stylesAll.slice(start, start + STYLES_PER_PAGE);
    }, [stylesAll, page]);

    const selectStyle = useCallback(
        (part: any) => {
            if (!part || !headModel || !hairCategory) return;

            try {
                headModel.selectPart?.(hairCategory.name, part.id);
            } catch {}

            setMaxPaletteCount(part.maxColorIndex || 1);
            setThumbTick((t) => t + 1);
        },
        [headModel, hairCategory]
    );

    // NOTE: palette clicks are handled internally by AvatarEditorPaletteSetView
    // (same as your working avatar editor). We only rerender on thumbTick.

    // drag handlers
    const startDragMouse = (e: React.MouseEvent) => {
        dragging.current = true;
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        document.body.style.userSelect = "none";
    };

    const startDragTouch = (e: React.TouchEvent) => {
        const t = e.touches[0];
        dragging.current = true;
        dragOffset.current = {
            x: t.clientX - position.x,
            y: t.clientY - position.y,
        };
        document.body.style.userSelect = "none";
    };

    const endDrag = () => {
        if (!dragging.current) return;
        dragging.current = false;
        document.body.style.userSelect = "";

        try {
            localStorage.setItem(POS_KEY, JSON.stringify(position));
        } catch {}
    };

    // resize handlers
    const startResizeMouse = (e: React.MouseEvent) => {
        e.stopPropagation();
        resizing.current = true;
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            w: size.width,
            h: size.height,
        };
        document.body.style.userSelect = "none";
    };

    const startResizeTouch = (e: React.TouchEvent) => {
        e.stopPropagation();
        const t = e.touches[0];
        resizing.current = true;
        resizeStart.current = {
            x: t.clientX,
            y: t.clientY,
            w: size.width,
            h: size.height,
        };
        document.body.style.userSelect = "none";
    };

    const endResize = () => {
        if (!resizing.current) return;
        resizing.current = false;
        document.body.style.userSelect = "";

        try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(size));
        } catch {}
    };

    // global listeners
    useEffect(() => {
        const mm = (e: MouseEvent) => {
            if (dragging.current) {
                setPosition(
                    clampToViewport(
                        e.clientX - dragOffset.current.x,
                        e.clientY - dragOffset.current.y
                    )
                );
            }

            if (resizing.current) {
                const dx = e.clientX - resizeStart.current.x;
                const dy = e.clientY - resizeStart.current.y;

                setSize({
                    width: Math.max(700, resizeStart.current.w + dx),
                    height: Math.max(520, resizeStart.current.h + dy),
                });
            }
        };

        const mu = () => {
            endDrag();
            endResize();
        };

        const tm = (e: TouchEvent) => {
            if (dragging.current) {
                const t = e.touches[0];
                setPosition(
                    clampToViewport(
                        t.clientX - dragOffset.current.x,
                        t.clientY - dragOffset.current.y
                    )
                );
            }

            if (resizing.current) {
                const t = e.touches[0];
                const dx = t.clientX - resizeStart.current.x;
                const dy = t.clientY - resizeStart.current.y;

                setSize({
                    width: Math.max(700, resizeStart.current.w + dx),
                    height: Math.max(520, resizeStart.current.h + dy),
                });
            }
        };

        const tu = () => {
            endDrag();
            endResize();
        };

        document.addEventListener("mousemove", mm);
        document.addEventListener("mouseup", mu);
        document.addEventListener("touchmove", tm, { passive: false });
        document.addEventListener("touchend", tu);

        return () => {
            document.removeEventListener("mousemove", mm);
            document.removeEventListener("mouseup", mu);
            document.removeEventListener("touchmove", tm as any);
            document.removeEventListener("touchend", tu);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [position, size]);

    const handleClose = () => setClosing(true);

    const submit = () => {
        if (!payload.offerId || !figureData) return;

        const hr = extractHrSegment(figureData.getFigureString());
        if (!hr) return;

        try {
            const anyWin = window as any;

            // ✅ This is the correct send path for Nitro
            if (anyWin?.Nitro?.connection) {
                anyWin.Nitro.connection.send(
                    new HaircutSelectStyleComposer(payload.offerId, hr)
                );
            } else {
                window.dispatchEvent(
                    new CustomEvent("haircut_submit", {
                        detail: { offerId: payload.offerId, hr },
                    })
                );
            }
        } catch {}

        setClosing(true);
    };

    if (!isVisible) return null;

    return (
        <div
            ref={containerRef}
            className={`haircut-offer-view ${closing ? "exit-br" : "enter-br"}`}
            onAnimationEnd={() => {
                if (!closing) return;

                setIsVisible(false);
                setClosing(false);

                if (typeof onClose === "function") onClose();
            }}
            style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
            }}
        >
            <div
                className="haircut-header"
                onMouseDown={startDragMouse}
                onTouchStart={startDragTouch}
            >
                <span>Haircut</span>

                <button
                    onClick={handleClose}
                    className="close-button"
                    aria-label="Close"
                />
            </div>

            <div className="haircut-content">
                {/* ✅ Banner background behind meta area */}
                <div
                    className="haircut-banner"
                    style={{ backgroundImage: `url(${BANNER_BG})` }}
                >
                    <div className="haircut-topbar">
                        <div className="haircut-meta">
                            <div className="line">
                                <span className="label">Stylist:</span>
                                <span className="value">
                                    {payload.stylistName || "Unknown"}
                                </span>
                            </div>

                            <div className="line">
                                <span className="label">Price:</span>
                                <span className="value price">
                                    <img
                                        className="coin-icon"
                                        src={COIN_ICON_SRC}
                                        alt=""
                                        draggable={false}
                                    />
                                    {payload.price || 0} credits
                                </span>
                            </div>

                            <div className="line">
                                <span className="label">Styles:</span>
                                <span className="value">{stylesCount}</span>
                            </div>
                        </div>

                        {/* ✅ Preview ALWAYS renders (same as avatar editor) */}
                        <div className="haircut-preview">
                            <div className="preview-frame">
                                {figureData ? (
                                    <AvatarEditorFigurePreviewView
                                        figureData={figureData}
                                    />
                                ) : (
                                    <div className="preview-placeholder">
                                        <div className="preview-shimmer" />
                                        <img
                                            className="preview-loading-icon"
                                            src={LOADING_PLACEHOLDER_SRC}
                                            alt="Loading"
                                            draggable={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="haircut-main">
                    {/* ✅ Styles (paged 3x8) */}
                    <div className="haircut-styles">
                        <div className="haircut-section-title">Styles</div>

                        <div className="styles-scroll">
                            <div className="styles-grid-scroll">
                                {stylesPage.map((p: any) => {
                                    const isSelected = !!p?.isSelected;
                                    const img = p?.imageUrl;

                                    return (
                                        <button
                                            key={`hair-${p.id}`}
                                            className={`style-tile ${
                                                isSelected ? "is-selected" : ""
                                            }`}
                                            onClick={() => selectStyle(p)}
                                            type="button"
                                            title={`Style ${p.id}`}
                                        >
                                            <div className="style-thumb">
                                                {!!img ? (
                                                    <img
                                                        src={img}
                                                        alt={`Style ${p.id}`}
                                                        draggable={false}
                                                        loading="lazy"
                                                        decoding="async"
                                                    />
                                                ) : (
                                                    <div className="thumb-loading">
                                                        <div className="thumb-shimmer" />
                                                        <img
                                                            className="loading-img"
                                                            src={
                                                                LOADING_PLACEHOLDER_SRC
                                                            }
                                                            alt="Loading"
                                                            draggable={false}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="style-label">{`Style ${p.id}`}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* ✅ pager */}
                            <div className="styles-pager">
                                <button
                                    className="pager-btn"
                                    type="button"
                                    onClick={() =>
                                        setPage((p) => Math.max(0, p - 1))
                                    }
                                    disabled={page <= 0}
                                >
                                    Prev
                                </button>

                                <div className="pager-info">
                                    Page {page + 1} / {pageCount}
                                </div>

                                <button
                                    className="pager-btn"
                                    type="button"
                                    onClick={() =>
                                        setPage((p) =>
                                            Math.min(pageCount - 1, p + 1)
                                        )
                                    }
                                    disabled={page >= pageCount - 1}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ✅ Colors scroll (uses the working avatar editor palette view) */}
                    <div className="haircut-colors">
                        <div className="haircut-section-title">Color</div>

                        <div className="colors-scroll">
                            <div className="palette-block">
                                <div className="palette-title">Palette 1</div>

                                {headModel && hairCategory && (
                                    <AvatarEditorPaletteSetView
                                        model={headModel}
                                        category={hairCategory}
                                        paletteSet={hairCategory.getPalette?.(
                                            0
                                        )}
                                        paletteIndex={0}
                                    />
                                )}
                            </div>

                            {maxPaletteCount >= 2 && (
                                <div className="palette-block">
                                    <div className="palette-title">
                                        Palette 2
                                    </div>

                                    {headModel && hairCategory && (
                                        <AvatarEditorPaletteSetView
                                            model={headModel}
                                            category={hairCategory}
                                            paletteSet={hairCategory.getPalette?.(
                                                1
                                            )}
                                            paletteIndex={1}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="haircut-footer">
                    <button
                        className="haircut-btn secondary"
                        onClick={handleClose}
                        type="button"
                    >
                        Cancel
                    </button>

                    <button
                        className="haircut-btn"
                        onClick={submit}
                        disabled={!figureData}
                        type="button"
                    >
                        Submit
                    </button>
                </div>
            </div>

            <div
                className="resize-handle"
                onMouseDown={startResizeMouse}
                onTouchStart={startResizeTouch}
            />
        </div>
    );
};
