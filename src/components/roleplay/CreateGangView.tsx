import { FC, useEffect, useRef, useState } from "react";
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

    // Swatches received from server for part "cc"
    const [ccSwatches, setCcSwatches] = useState<string[]>([]);

    const ICONS_PER_PAGE = 16;
    const [currentPage, setCurrentPage] = useState(0);
    const totalPages = Math.ceil(ICON_OPTIONS.length / ICONS_PER_PAGE);
    const visibleIcons = ICON_OPTIONS.slice(
        currentPage * ICONS_PER_PAGE,
        (currentPage + 1) * ICONS_PER_PAGE
    );

    // ---- DRAGGING STATE ----midd
    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 120,
        y: 120,
    });
    const posRef = useRef(position);
    const draggingRef = useRef(false);
    const deltaRef = useRef({ dx: 0, dy: 0 });
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem("createGangPosition");
        if (saved) {
            try {
                const p = JSON.parse(saved);
                setPosition(p);
                posRef.current = p;
            } catch {}
        }
    }, []);

    useEffect(() => {
        posRef.current = position;
    }, [position]);

    const startDrag = (clientX: number, clientY: number) => {
        draggingRef.current = true;
        deltaRef.current = {
            dx: clientX - posRef.current.x,
            dy: clientY - posRef.current.y,
        };
        document.body.classList.add("is-dragging");
    };

    const moveDrag = (clientX: number, clientY: number) => {
        if (!draggingRef.current) return;
        const x = clientX - deltaRef.current.dx;
        const y = clientY - deltaRef.current.dy;

        const winW = window.innerWidth,
            winH = window.innerHeight;
        const node = rootRef.current;
        const w = node?.offsetWidth ?? 400;
        const h = node?.offsetHeight ?? 300;

        const nx = Math.min(Math.max(8, x), winW - w - 8);
        const ny = Math.min(Math.max(8, y), winH - h - 8);
        setPosition({ x: nx, y: ny });
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

    // ---- FETCH ALLOWED COLORS (palette for part "cc") ----
    useEffect(() => {
        // ask server which hexes are valid for clothing part "cc"
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

    // ---- ACTIONS ----
    const handleCreate = () => {
        if (name.length < 3)
            return setError("Gang name must be at least 3 characters.");
        if (name.length > 20)
            return setError("Gang name cannot exceed 20 characters.");

        SendMessageComposer(
            new CreateGangComposer(name, primaryColor, secondaryColor)
        );
        onClose();
    };

    const SwatchGrid: FC<{
        value: string;
        onChange: (hex: string) => void;
    }> = ({ value, onChange }) => (
        <div className="swatch-grid">
            {ccSwatches.map((hex) => (
                <button
                    key={hex}
                    className={"swatch" + (hex === value ? " selected" : "")}
                    style={{ backgroundColor: hex }}
                    onClick={() => onChange(hex)}
                    title={hex}
                />
            ))}
            {!ccSwatches.length && (
                <div className="swatch-loading">Loading colors…</div>
            )}
        </div>
    );

    return (
        <div
            ref={rootRef}
            className="create-gang-view"
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
                Create Gang
                <button className="close-button" onClick={onClose}>
                    ✖
                </button>
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
                    <div className="icon-selector">
                        {visibleIcons.map((icon) => (
                            <div
                                key={icon.name}
                                className={`icon-option ${
                                    selectedIcon === icon.name ? "selected" : ""
                                }`}
                                onClick={() => setSelectedIcon(icon.name)}
                            >
                                <img src={icon.src} alt={icon.name} />
                            </div>
                        ))}
                    </div>

                    <div className="pagination-controls">
                        <button
                            className="habbo-action-button"
                            onClick={() =>
                                setCurrentPage((p) => Math.max(p - 1, 0))
                            }
                            disabled={currentPage === 0}
                        >
                            ◀
                        </button>
                        <span>
                            {currentPage + 1} / {totalPages}
                        </span>
                        <button
                            className="habbo-action-button"
                            onClick={() =>
                                setCurrentPage((p) =>
                                    Math.min(p + 1, totalPages - 1)
                                )
                            }
                            disabled={currentPage >= totalPages - 1}
                        >
                            ▶
                        </button>
                    </div>
                </div>

                <div className="gang-divider" />

                {/* MIDDLE: Colors (compact) */}
                <div className="gang-column gang-color-chooser">
                    <div className="color-rows">
                        <div className="color-block">
                            <label>Primary Color</label>
                            <SwatchGrid
                                value={primaryColor}
                                onChange={setPrimaryColor}
                            />
                        </div>
                        <div className="color-block">
                            <label>Secondary Color</label>
                            <SwatchGrid
                                value={secondaryColor}
                                onChange={setSecondaryColor}
                            />
                        </div>
                    </div>
                </div>

                <div className="gang-divider" />

                {/* RIGHT: Preview */}
                <div className="gang-column gang-preview">
                    <div className="preview-box">
                        <div
                            className="preview-colors"
                            style={{
                                background: `linear-gradient(to right, ${primaryColor} 50%, ${secondaryColor} 50%)`,
                            }}
                        >
                            <img
                                src={
                                    ICON_OPTIONS.find(
                                        (i) => i.name === selectedIcon
                                    )?.src ?? ""
                                }
                                alt=""
                                className="icon-overlay"
                            />
                        </div>
                        <div className="gang-preview-name">
                            {name || "Your Gang Name"}
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="create-gang-footer">
                <button
                    className="habbo-action-button green"
                    onClick={handleCreate}
                >
                    Create Gang for 100 💵
                </button>
            </div>
        </div>
    );
};
