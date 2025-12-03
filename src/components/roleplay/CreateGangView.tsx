import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./CreateGangView.scss";
import { SendMessageComposer } from "../../api";
import { CreateGangComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/CreateGangComposer";
import { GetPartPaletteHexesComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/GetPartPaletteHExesComposer";

type IconOpt = { name: string; src: string };

const ICON_OPTIONS: IconOpt[] = [
    { name: "Swords", src: "/icons/badges/ALW09.gif" },
    { name: "Skull", src: "/icons/badges/DE10K.gif" },
    { name: "Fire", src: "/icons/badges/EFM19.gif" },
    { name: "Shield", src: "/icons/badges/FRK42.gif" },
    { name: "Target", src: "/icons/badges/TC913.gif" },
    { name: "Crown", src: "/icons/badges/TC944.gif" },
    { name: "Bomb", src: "/icons/badges/TC969.gif" },
    { name: "Snake", src: "/icons/badges/FRH52.gif" },
    { name: "Rocket Ship", src: "/icons/badges/BR815.gif" },
    { name: "Blue Snake", src: "/icons/badges/COM51.gif" },
    { name: "Pirate Flag", src: "/icons/badges/COM74.gif" },
    { name: "Bloody Duck", src: "/icons/badges/COM73.gif" },
    { name: "Blue Shield", src: "/icons/badges/CP001.gif" },
    { name: "Mexican Skull", src: "/icons/badges/NB067.gif" },
    { name: "Ghost", src: "/icons/badges/HNN06.gif" },
    { name: "Eyeball", src: "/icons/badges/DE51J.gif" },
    { name: "Star", src: "/icons/badges/ES08Q.gif" },
    { name: "Donkey", src: "/icons/badges/MIN22.gif" },
    { name: "Green Pumpkin", src: "/icons/badges/APC08.gif" },
    { name: "Mushroom", src: "/icons/badges/CAV06.gif" },
    { name: "Pride", src: "/icons/badges/ES64A.gif" },
    { name: "Fire Skull", src: "/icons/badges/FR189.gif" },
    { name: "Green Skull", src: "/icons/badges/HGH11.gif" },
    { name: "Green Monster", src: "/icons/badges/FV2.gif" },
    { name: "Dark Pickle", src: "/icons/badges/TC861.gif" },
    { name: "Basketball", src: "/icons/badges/TC825.gif" },
    { name: "Lips", src: "/icons/badges/PTD74.gif" },
    { name: "Cow", src: "/icons/badges/TC792.gif" },
    { name: "Boxing Gloves", src: "/icons/badges/ITH03.gif" },
    { name: "Black Cat", src: "/icons/badges/US530.gif" },
    { name: "Golden Crown", src: "/icons/badges/FRH44.gif" },
    { name: "Cowboy Hat", src: "/icons/badges/US515.gif" },
    { name: "Dog", src: "/icons/badges/US484.gif" },
    { name: "Pink Heart", src: "/icons/badges/DE21H.gif" },
];

interface CreateGangViewProps {
    onClose: () => void;
}

export const CreateGangView: FC<CreateGangViewProps> = ({ onClose }) => {
    const [name, setName] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#FF0000");
    const [secondaryColor, setSecondaryColor] = useState("#000000");
    const [selectedIcon, setSelectedIcon] = useState<IconOpt["name"]>(
        ICON_OPTIONS[0]?.name ?? ""
    );
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [ccSwatches, setCcSwatches] = useState<string[]>([]);

    /* paging config */
    const SWATCHES_PER_PAGE = 30; // 3 rows * 10 cols
    const ICONS_PER_PAGE = 9; // 3x3

    const [primPage, setPrimPage] = useState(0);
    const [secPage, setSecPage] = useState(0);
    const [iconPage, setIconPage] = useState(0);

    /* -------------------- drag positioning (kept) -------------------- */
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 120,
        y: 120,
    });
    const posRef = useRef(position);
    const draggingRef = useRef(false);
    const deltaRef = useRef({ dx: 0, dy: 0 });
    const rootRef = useRef<HTMLDivElement | null>(null);

    const clampToClient = (x: number, y: number) => {
        const margin = 8;
        const w = rootRef.current?.offsetWidth ?? 400;
        const h = rootRef.current?.offsetHeight ?? 300;
        const maxX = Math.max(margin, window.innerWidth - w - margin);
        const maxY = Math.max(margin, window.innerHeight - h - margin);
        return {
            x: Math.min(Math.max(margin, x), maxX),
            y: Math.min(Math.max(margin, y), maxY),
        };
    };

    const centerInClient = () => {
        const w = rootRef.current?.offsetWidth ?? 400;
        const h = rootRef.current?.offsetHeight ?? 300;
        const x = Math.round((window.innerWidth - w) / 2);
        const y = Math.round((window.innerHeight - h) / 2);
        return clampToClient(x, y);
    };

    useLayoutEffect(() => {
        let next = centerInClient();
        const saved = localStorage.getItem("createGangPosition");
        if (saved) {
            try {
                const p = JSON.parse(saved);
                if (typeof p?.x === "number" && typeof p?.y === "number")
                    next = clampToClient(p.x, p.y);
            } catch {}
        }
        setPosition(next);
        posRef.current = next;
    }, []);

    useEffect(() => {
        posRef.current = position;
    }, [position]);

    useEffect(() => {
        const onResize = () => {
            const clamped = clampToClient(posRef.current.x, posRef.current.y);
            setPosition(clamped);
            posRef.current = clamped;
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const startDrag = (x: number, y: number) => {
        draggingRef.current = true;
        deltaRef.current = {
            dx: x - posRef.current.x,
            dy: y - posRef.current.y,
        };
        document.body.classList.add("is-dragging");
    };
    const moveDrag = (x: number, y: number) => {
        if (!draggingRef.current) return;
        setPosition(
            clampToClient(x - deltaRef.current.dx, y - deltaRef.current.dy)
        );
    };
    const stopDrag = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        localStorage.setItem(
            "createGangPosition",
            JSON.stringify(posRef.current)
        );
        document.body.classList.remove("is-dragging");
    };

    const onHeaderMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
        const onMove = (ev: MouseEvent) => moveDrag(ev.clientX, ev.clientY);
        const onUp = () => {
            stopDrag();
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };
    const onHeaderTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        startDrag(t.clientX, t.clientY);
        const onMove = (ev: TouchEvent) =>
            moveDrag(ev.touches[0].clientX, ev.touches[0].clientY);
        const onEnd = () => {
            stopDrag();
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend", onEnd);
            window.removeEventListener("touchcancel", onEnd);
        };
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onEnd);
        window.addEventListener("touchcancel", onEnd);
    };
    useEffect(
        () => () => {
            document.body.classList.remove("is-dragging");
            draggingRef.current = false;
        },
        []
    );

    /* ----------------------- fetch palette hexes (kept) ----------------------- */
    useEffect(() => {
        SendMessageComposer(new GetPartPaletteHexesComposer("cc"));
        const onHexes = (ev: Event) => {
            const { part, hexes } = (ev as CustomEvent).detail as {
                part: string;
                paletteId: number;
                hexes: string[];
            };
            if (part !== "cc") return;
            const withHash = hexes.map((h) => `#${h.toUpperCase()}`);
            setCcSwatches(withHash);
            if (withHash.length) {
                if (!withHash.includes(primaryColor))
                    setPrimaryColor(withHash[0]);
                if (!withHash.includes(secondaryColor))
                    setSecondaryColor(withHash[0]);
            }
        };
        window.addEventListener("palette_hexes_result", onHexes);
        return () =>
            window.removeEventListener("palette_hexes_result", onHexes);
    }, []); // once

    /* ----------------------- helpers ----------------------- */
    const iconKeyFromSrc = (src: string) => {
        const m = src.match(/\/([^\/]+)\.(gif|png|jpg)$/i);
        return m ? m[1].toUpperCase() : "";
    };
    const selectedIconSrc =
        ICON_OPTIONS.find((i) => i.name === selectedIcon)?.src ?? "";
    const selectedIconKey = iconKeyFromSrc(selectedIconSrc);

    const handleCreate = () => {
        if (submitting) return; // guard (feels instantaneous)
        if (name.trim().length < 3)
            return setError("Gang name must be at least 3 characters.");
        if (name.trim().length > 20)
            return setError("Gang name cannot exceed 20 characters.");
        if (!selectedIconKey) return setError("Please select a gang icon.");

        setSubmitting(true);
        SendMessageComposer(
            new CreateGangComposer(
                name.trim(),
                primaryColor,
                secondaryColor,
                selectedIconKey
            )
        );
        onClose(); // optimistic close
    };

    /* ----------------------- paging slices ----------------------- */
    const primTotal = Math.max(
        1,
        Math.ceil(ccSwatches.length / SWATCHES_PER_PAGE)
    );
    const secTotal = Math.max(
        1,
        Math.ceil(ccSwatches.length / SWATCHES_PER_PAGE)
    );

    const primStart = primPage * SWATCHES_PER_PAGE;
    const secStart = secPage * SWATCHES_PER_PAGE;

    const primVisible = ccSwatches.slice(
        primStart,
        primStart + SWATCHES_PER_PAGE
    );
    const secVisible = ccSwatches.slice(secStart, secStart + SWATCHES_PER_PAGE);

    const iconTotal = Math.ceil(ICON_OPTIONS.length / ICONS_PER_PAGE);
    const iconStart = iconPage * ICONS_PER_PAGE;
    const visibleIcons = ICON_OPTIONS.slice(
        iconStart,
        iconStart + ICONS_PER_PAGE
    );

    /* ----------------------- render ----------------------- */
    return (
        <div
            ref={rootRef}
            className="create-gang-view show"
            style={{
                position: "fixed",
                left: position.x,
                top: position.y,
                zIndex: 2500,
            }}
        >
            <div
                className="create-gang-header"
                onMouseDown={onHeaderMouseDown}
                onTouchStart={onHeaderTouchStart}
            >
                <div className="header-left">
                    {/* live mini badge uses current colors + icon, shrunk to fit */}
                    <div
                        className="top-badge"
                        style={{
                            background: `linear-gradient(90deg, ${primaryColor} 50%, ${secondaryColor} 50%)`,
                        }}
                    >
                        {selectedIconSrc && (
                            <img
                                className="top-badge-icon"
                                src={selectedIconSrc}
                                alt=""
                            />
                        )}
                    </div>
                    Create Gang
                </div>
                <button
                    className="c-button close-button"
                    onClick={onClose}
                ></button>
            </div>

            <div className="create-gang-body-horizontal">
                {/* LEFT: Name + Icon */}
                <div className="gang-column gang-name-icon">
                    <label>Gang Name</label>
                    <input
                        type="text"
                        value={name}
                        maxLength={20}
                        onChange={(e) => setName(e.target.value)}
                    />

                    <label>Gang Icon</label>
                    <div key={`icon-page-${iconPage}`} className="icon-page">
                        {visibleIcons.map((icon) => (
                            <div
                                key={icon.name}
                                className={`icon-option ${
                                    selectedIcon === icon.name ? "selected" : ""
                                }`}
                                onClick={() => setSelectedIcon(icon.name)}
                                title={icon.name}
                            >
                                <img src={icon.src} alt={icon.name} />
                            </div>
                        ))}
                    </div>

                    <div className="pagination-controls">
                        <button
                            className="habbo-action-button"
                            onClick={() =>
                                setIconPage((p) => Math.max(p - 1, 0))
                            }
                            disabled={iconPage === 0}
                        >
                            ◀
                        </button>
                        <span>
                            {Math.min(iconPage + 1, iconTotal)} /{" "}
                            {Math.max(iconTotal, 1)}
                        </span>
                        <button
                            className="habbo-action-button"
                            onClick={() =>
                                setIconPage((p) =>
                                    Math.min(p + 1, iconTotal - 1)
                                )
                            }
                            disabled={iconPage >= iconTotal - 1}
                        >
                            ▶
                        </button>
                    </div>
                </div>

                <div className="gang-divider" />

                {/* MIDDLE: Palettes (centered; secondary below primary) */}
                <div className="gang-column gang-color-chooser">
                    <div className="palette-stack">
                        {/* Primary */}
                        <div className="palette-block">
                            {/* side arrows */}
                            <button
                                className="pager-btn left"
                                onClick={() =>
                                    setPrimPage((p) => Math.max(p - 1, 0))
                                }
                                disabled={primPage === 0}
                                aria-label="Previous primary colors"
                            >
                                ◀
                            </button>
                            <button
                                className="pager-btn right"
                                onClick={() =>
                                    setPrimPage((p) =>
                                        Math.min(p + 1, primTotal - 1)
                                    )
                                }
                                disabled={primPage >= primTotal - 1}
                                aria-label="Next primary colors"
                            >
                                ▶
                            </button>

                            <div className="palette-header">
                                <div>Primary Color</div>
                                <div className="page-indicator">
                                    {Math.min(primPage + 1, primTotal)} /{" "}
                                    {Math.max(primTotal, 1)}
                                </div>
                            </div>

                            {!ccSwatches.length && (
                                <div className="swatch-loading">
                                    Loading colors…
                                </div>
                            )}
                            {!!ccSwatches.length && (
                                <div
                                    key={`prim-${primPage}`}
                                    className="swatch-page"
                                >
                                    {primVisible.map((hex) => (
                                        <button
                                            key={hex}
                                            className={
                                                "swatch" +
                                                (hex === primaryColor
                                                    ? " selected"
                                                    : "")
                                            }
                                            style={{ backgroundColor: hex }}
                                            onClick={() => setPrimaryColor(hex)}
                                            title={hex}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Secondary */}
                        <div className="palette-block">
                            <button
                                className="pager-btn left"
                                onClick={() =>
                                    setSecPage((p) => Math.max(p - 1, 0))
                                }
                                disabled={secPage === 0}
                                aria-label="Previous secondary colors"
                            >
                                ◀
                            </button>
                            <button
                                className="pager-btn right"
                                onClick={() =>
                                    setSecPage((p) =>
                                        Math.min(p + 1, secTotal - 1)
                                    )
                                }
                                disabled={secPage >= secTotal - 1}
                                aria-label="Next secondary colors"
                            >
                                ▶
                            </button>

                            <div className="palette-header">
                                <div>Secondary Color</div>
                                <div className="page-indicator">
                                    {Math.min(secPage + 1, secTotal)} /{" "}
                                    {Math.max(secTotal, 1)}
                                </div>
                            </div>

                            {!ccSwatches.length && (
                                <div className="swatch-loading">
                                    Loading colors…
                                </div>
                            )}
                            {!!ccSwatches.length && (
                                <div
                                    key={`sec-${secPage}`}
                                    className="swatch-page"
                                >
                                    {secVisible.map((hex) => (
                                        <button
                                            key={hex}
                                            className={
                                                "swatch" +
                                                (hex === secondaryColor
                                                    ? " selected"
                                                    : "")
                                            }
                                            style={{ backgroundColor: hex }}
                                            onClick={() =>
                                                setSecondaryColor(hex)
                                            }
                                            title={hex}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="gang-divider" />

                {/* RIGHT: Preview (no shield; same footprint) */}
                <div className="gang-column gang-preview">
                    <div className="preview-box">
                        <div
                            className="shield-wrap"
                            style={{
                                background: `linear-gradient(90deg, ${primaryColor} 50%, ${secondaryColor} 50%)`,
                            }}
                        >
                            {selectedIconSrc && (
                                <img
                                    className="shield-icon"
                                    src={selectedIconSrc}
                                    alt=""
                                />
                            )}
                        </div>
                        <div className="gang-preview-name">
                            {name || "Your Gang Name"}
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div
                    style={{
                        color: "#b00020",
                        padding: "0 12px 6px",
                        fontWeight: 700,
                    }}
                >
                    {error}
                </div>
            )}

            <div className="create-gang-footer">
                <button
                    className="habbo-action-button green"
                    onClick={handleCreate}
                    disabled={submitting}
                >
                    Create Gang for 500 💵
                </button>
            </div>

            {/* optional resize handle kept if you hook it up later */}
            <div className="resize-handle" />
        </div>
    );
};
