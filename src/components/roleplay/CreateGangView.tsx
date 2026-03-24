import { FC, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
    { name: "Pink Heart", src: "/icons/badges/DE21H.gif" }
];

interface CreateGangViewProps {
    onClose: () => void;
}

export const CreateGangView: FC<CreateGangViewProps> = ({ onClose }) => {
    const [name, setName] = useState("");
    const [primaryColor, setPrimaryColor] = useState("#FF0000");
    const [secondaryColor, setSecondaryColor] = useState("#000000");
    const [selectedIcon, setSelectedIcon] = useState<IconOpt["name"]>(ICON_OPTIONS[0]?.name ?? "");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [ccSwatches, setCcSwatches] = useState<string[]>([]);
    const [primPage, setPrimPage] = useState(0);
    const [secPage, setSecPage] = useState(0);
    const [iconPage, setIconPage] = useState(0);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 120, y: 120 });

    const SWATCHES_PER_PAGE = 18;
    const ICONS_PER_PAGE = 12;

    const posRef = useRef(position);
    const draggingRef = useRef(false);
    const deltaRef = useRef({ dx: 0, dy: 0 });
    const rootRef = useRef<HTMLDivElement | null>(null);

    const clampToClient = (x: number, y: number) => {
        const margin = 8;
        const width = rootRef.current?.offsetWidth ?? 760;
        const height = rootRef.current?.offsetHeight ?? 520;
        const maxX = Math.max(margin, window.innerWidth - width - margin);
        const maxY = Math.max(margin, window.innerHeight - height - margin);

        return {
            x: Math.min(Math.max(margin, x), maxX),
            y: Math.min(Math.max(margin, y), maxY)
        };
    };

    const centerInClient = () => {
        const width = rootRef.current?.offsetWidth ?? 760;
        const height = rootRef.current?.offsetHeight ?? 520;
        return clampToClient(Math.round((window.innerWidth - width) / 2), Math.round((window.innerHeight - height) / 2));
    };

    useLayoutEffect(() => {
        let next = centerInClient();
        const saved = localStorage.getItem("createGangPosition");

        if(saved)
        {
            try
            {
                const parsed = JSON.parse(saved);

                if(typeof parsed?.x === "number" && typeof parsed?.y === "number") next = clampToClient(parsed.x, parsed.y);
            }
            catch {}
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
        deltaRef.current = { dx: x - posRef.current.x, dy: y - posRef.current.y };
        document.body.classList.add("is-dragging");
    };

    const moveDrag = (x: number, y: number) => {
        if(!draggingRef.current) return;
        setPosition(clampToClient(x - deltaRef.current.dx, y - deltaRef.current.dy));
    };

    const stopDrag = () => {
        if(!draggingRef.current) return;
        draggingRef.current = false;
        localStorage.setItem("createGangPosition", JSON.stringify(posRef.current));
        document.body.classList.remove("is-dragging");
    };

    const onHeaderMouseDown = (event: React.MouseEvent) => {
        event.preventDefault();
        startDrag(event.clientX, event.clientY);

        const onMove = (moveEvent: MouseEvent) => moveDrag(moveEvent.clientX, moveEvent.clientY);
        const onUp = () => {
            stopDrag();
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const onHeaderTouchStart = (event: React.TouchEvent) => {
        const touch = event.touches[0];
        startDrag(touch.clientX, touch.clientY);

        const onMove = (moveEvent: TouchEvent) => moveDrag(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
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

    useEffect(() => () => {
        document.body.classList.remove("is-dragging");
        draggingRef.current = false;
    }, []);

    useEffect(() => {
        SendMessageComposer(new GetPartPaletteHexesComposer("cc"));

        const onHexes = (event: Event) => {
            const { part, hexes } = (event as CustomEvent).detail as { part: string; paletteId: number; hexes: string[] };

            if(part !== "cc") return;

            const nextSwatches = hexes.map(hex => `#${ hex.toUpperCase() }`);
            setCcSwatches(nextSwatches);

            if(!nextSwatches.length) return;
            if(!nextSwatches.includes(primaryColor)) setPrimaryColor(nextSwatches[0]);
            if(!nextSwatches.includes(secondaryColor)) setSecondaryColor(nextSwatches[Math.min(1, nextSwatches.length - 1)] ?? nextSwatches[0]);
        };

        window.addEventListener("palette_hexes_result", onHexes);
        return () => window.removeEventListener("palette_hexes_result", onHexes);
    }, []);

    const iconKeyFromSrc = (src: string) => {
        const match = src.match(/\/([^\/]+)\.(gif|png|jpg)$/i);
        return match ? match[1].toUpperCase() : "";
    };

    const selectedIconData = useMemo(() => ICON_OPTIONS.find(icon => icon.name === selectedIcon) ?? ICON_OPTIONS[0], [selectedIcon]);
    const selectedIconSrc = selectedIconData?.src ?? "";
    const selectedIconKey = iconKeyFromSrc(selectedIconSrc);

    const handleCreate = () => {
        if(submitting) return;
        if(name.trim().length < 3) return setError("Gang name must be at least 3 characters.");
        if(name.trim().length > 20) return setError("Gang name cannot exceed 20 characters.");
        if(!selectedIconKey) return setError("Please select a gang icon.");

        setSubmitting(true);
        SendMessageComposer(new CreateGangComposer(name.trim(), primaryColor, secondaryColor, selectedIconKey));
        onClose();
    };

    const primTotal = Math.max(1, Math.ceil(ccSwatches.length / SWATCHES_PER_PAGE));
    const secTotal = Math.max(1, Math.ceil(ccSwatches.length / SWATCHES_PER_PAGE));
    const primVisible = ccSwatches.slice(primPage * SWATCHES_PER_PAGE, primPage * SWATCHES_PER_PAGE + SWATCHES_PER_PAGE);
    const secVisible = ccSwatches.slice(secPage * SWATCHES_PER_PAGE, secPage * SWATCHES_PER_PAGE + SWATCHES_PER_PAGE);
    const iconTotal = Math.max(1, Math.ceil(ICON_OPTIONS.length / ICONS_PER_PAGE));
    const visibleIcons = ICON_OPTIONS.slice(iconPage * ICONS_PER_PAGE, iconPage * ICONS_PER_PAGE + ICONS_PER_PAGE);

    return (
        <div
            ref={ rootRef }
            className="create-gang-view show"
            style={ { position: "fixed", left: position.x, top: position.y, zIndex: 2500 } }>
            <div className="create-gang-header" onMouseDown={ onHeaderMouseDown } onTouchStart={ onHeaderTouchStart }>
                <div className="header-left">
                    <div className="top-badge" style={ { background: `linear-gradient(135deg, ${ primaryColor } 0%, ${ primaryColor } 50%, ${ secondaryColor } 50%, ${ secondaryColor } 100%)` } }>
                        { selectedIconSrc && <img className="top-badge-icon" src={ selectedIconSrc } alt="" /> }
                    </div>
                    <span>Create Gang</span>
                </div>
                <button className="c-button close-button" onClick={ onClose } />
            </div>

            <div className="create-gang-content">
                <div className="create-gang-main">
                    <div className="create-gang-form-card">
                        <div className="field-group">
                            <label htmlFor="create-gang-name">Gang Name</label>
                            <input
                                id="create-gang-name"
                                type="text"
                                value={ name }
                                maxLength={ 20 }
                                placeholder="Enter gang name"
                                onChange={ event => {
                                    setName(event.target.value);
                                    if(error) setError("");
                                } } />
                        </div>

                        <div className="field-group">
                            <div className="section-title-row">
                                <label>Gang Icon</label>
                                <div className="page-indicator">{ Math.min(iconPage + 1, iconTotal) } / { iconTotal }</div>
                            </div>

                            <div key={ `icon-page-${ iconPage }` } className="icon-grid">
                                { visibleIcons.map(icon => (
                                    <button
                                        key={ icon.name }
                                        type="button"
                                        className={ `icon-option ${ selectedIcon === icon.name ? "selected" : "" }` }
                                        onClick={ () => setSelectedIcon(icon.name) }
                                        title={ icon.name }>
                                        <img src={ icon.src } alt={ icon.name } />
                                    </button>
                                )) }
                            </div>

                            <div className="pagination-controls compact">
                                <button type="button" className="rp-global-button" onClick={ () => setIconPage(page => Math.max(page - 1, 0)) } disabled={ iconPage === 0 }>◀</button>
                                <button type="button" className="rp-global-button" onClick={ () => setIconPage(page => Math.min(page + 1, iconTotal - 1)) } disabled={ iconPage >= iconTotal - 1 }>▶</button>
                            </div>
                        </div>
                    </div>

                    <div className="create-gang-preview-card">
                        <div className="preview-stage">
                            <div className="preview-badge" style={ { background: `linear-gradient(135deg, ${ primaryColor } 0%, ${ primaryColor } 50%, ${ secondaryColor } 50%, ${ secondaryColor } 100%)` } }>
                                { selectedIconSrc && <img className="preview-icon" src={ selectedIconSrc } alt="" /> }
                            </div>
                            <div className="preview-copy">
                                <div className="preview-label">Preview</div>
                                <div className="preview-name">{ name.trim() || "Your Gang Name" }</div>
                                <div className="preview-subtitle">Primary and secondary colors update live.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="color-selection-row">
                    <div className="palette-card">
                        <div className="section-title-row">
                            <label>Primary Color</label>
                            <div className="page-indicator">{ Math.min(primPage + 1, primTotal) } / { primTotal }</div>
                        </div>
                        { !ccSwatches.length && <div className="swatch-loading">Loading colors…</div> }
                        {!!ccSwatches.length && (
                            <div key={ `prim-${ primPage }` } className="swatch-grid">
                                { primVisible.map(hex => (
                                    <button
                                        key={ hex }
                                        type="button"
                                        className={ `swatch ${ hex === primaryColor ? "selected" : "" }` }
                                        style={ { backgroundColor: hex } }
                                        onClick={ () => setPrimaryColor(hex) }
                                        title={ hex } />
                                )) }
                            </div>
                        ) }
                        <div className="pagination-controls swatch-controls">
                            <button type="button" className="rp-global-button" onClick={ () => setPrimPage(page => Math.max(page - 1, 0)) } disabled={ primPage === 0 }>◀</button>
                            <button type="button" className="rp-global-button" onClick={ () => setPrimPage(page => Math.min(page + 1, primTotal - 1)) } disabled={ primPage >= primTotal - 1 }>▶</button>
                        </div>
                    </div>

                    <div className="palette-card">
                        <div className="section-title-row">
                            <label>Secondary Color</label>
                            <div className="page-indicator">{ Math.min(secPage + 1, secTotal) } / { secTotal }</div>
                        </div>
                        { !ccSwatches.length && <div className="swatch-loading">Loading colors…</div> }
                        {!!ccSwatches.length && (
                            <div key={ `sec-${ secPage }` } className="swatch-grid">
                                { secVisible.map(hex => (
                                    <button
                                        key={ hex }
                                        type="button"
                                        className={ `swatch ${ hex === secondaryColor ? "selected" : "" }` }
                                        style={ { backgroundColor: hex } }
                                        onClick={ () => setSecondaryColor(hex) }
                                        title={ hex } />
                                )) }
                            </div>
                        ) }
                        <div className="pagination-controls swatch-controls">
                            <button type="button" className="rp-global-button" onClick={ () => setSecPage(page => Math.max(page - 1, 0)) } disabled={ secPage === 0 }>◀</button>
                            <button type="button" className="rp-global-button" onClick={ () => setSecPage(page => Math.min(page + 1, secTotal - 1)) } disabled={ secPage >= secTotal - 1 }>▶</button>
                        </div>
                    </div>
                </div>
            </div>

            { error && <div className="create-gang-error">{ error }</div> }

            <div className="create-gang-footer">
                <button className="rp-global-button is-primary" onClick={ handleCreate } disabled={ submitting }>
                    Create Gang
                </button>
            </div>
        </div>
    );
};
