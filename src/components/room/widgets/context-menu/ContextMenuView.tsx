import {
    FixedSizeStack,
    NitroPoint,
    NitroRectangle,
    RoomObjectType,
} from "@nitrots/nitro-renderer";
import {
    CSSProperties,
    FC,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    GetNitroInstance,
    GetRoomObjectBounds,
    GetRoomObjectScreenLocation,
    GetRoomSession,
    GetTicker,
    SendMessageComposer,
} from "../../../../api";
import { Base, BaseProps } from "../../../../common";
import { ContextMenuCaretView } from "./ContextMenuCaretView";
import { InspectUserStatsComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/InspectUserStatsComposer";

/* If you’re no longer using this anywhere else, you can delete this import */
// import { GetSessionDataManager } from "../../../../api";

interface ContextMenuViewProps extends BaseProps<HTMLDivElement> {
    objectId: number;
    category: number;
    userType?: number;
    fades?: boolean;
    onClose: () => void;
    collapsable?: boolean;
}

/* ---------------- constants ---------------- */

const LOCATION_STACK_SIZE = 25;
const BUBBLE_DROP_SPEED = 3;
const FADE_DELAY = 5000;
const FADE_LENGTH = 75;
const SPACE_AROUND_EDGES = 10;

let COLLAPSED = false;
let FIXED_STACK: FixedSizeStack = null as unknown as FixedSizeStack;
let MAX_STACK = -1000000;
let FADE_TIME = 1;

/* ---------------- utils ---------------- */

const readBool = (k: string, fallback = false) => {
    try {
        const raw = localStorage.getItem(k);
        if (raw === null) return fallback;
        const v = JSON.parse(raw);
        return typeof v === "boolean" ? v : !!v;
    } catch {
        return fallback;
    }
};

export const ContextMenuView: FC<ContextMenuViewProps> = (props) => {
    const {
        objectId = -1,
        category = -1,
        userType = -1,
        fades = false,
        onClose = null,
        position = "absolute",
        classNames = [],
        style = {},
        children = null,
        collapsable = false,
        ...rest
    } = props;

    /* ------------- respect “Disable Context Menu” & Click-Through ------------- */

    const [contextMenuDisabled, setContextMenuDisabled] = useState<boolean>(
        () => readBool("contextMenuDisabled", false)
    );

    // Click-through flag (seed from global, update via bridge)
    const [ctEnabled, setCtEnabled] = useState<boolean>(
        () => !!(window as any).__ctEnabled
    );

    useEffect(() => {
        const onToggle = (e: Event) => {
            const det = (e as CustomEvent)?.detail;
            if (!det) return;
            const disabled = !!det.disabled;
            setContextMenuDisabled(disabled);
            if (disabled && onClose) onClose();
        };

        const onCT = (e: Event) => {
            const enabled = !!(e as CustomEvent)?.detail?.enabled;
            setCtEnabled(enabled);
            if (enabled && onClose) onClose(); // hide immediately when CT turns on
        };

        const onStorage = (ev: StorageEvent) => {
            if (ev.key === "contextMenuDisabled") {
                const disabled = readBool("contextMenuDisabled", false);
                setContextMenuDisabled(disabled);
                if (disabled && onClose) onClose();
            }
        };

        window.addEventListener("toggleContextMenu", onToggle as EventListener);
        window.addEventListener("click_through_state", onCT as EventListener);
        window.addEventListener("storage", onStorage);

        // sync once from global in case CT was toggled before mount
        const syncFromGlobal = () => {
            const now = !!(window as any).__ctEnabled;
            setCtEnabled(now);
            if (now && onClose) onClose();
        };
        setTimeout(syncFromGlobal, 0);

        return () => {
            window.removeEventListener(
                "toggleContextMenu",
                onToggle as EventListener
            );
            window.removeEventListener(
                "click_through_state",
                onCT as EventListener
            );
            window.removeEventListener("storage", onStorage);
        };
    }, [onClose]);

    // If disabled or click-through is enabled, do not render at all
    if (contextMenuDisabled || ctEnabled) return null;

    /* ---------------- state ---------------- */

    const [pos, setPos] = useState<{ x: number | null; y: number | null }>({
        x: null,
        y: null,
    });

    const userData =
        GetRoomSession().userDataManager.getUserDataByIndex(objectId);

    // Only trigger stats explicitly (on click) — no more auto on hover
    const toggleStats = useCallback(() => {
        if (objectId <= 0 || !userData) return;

        // Ask server for latest stats
        SendMessageComposer(new InspectUserStatsComposer(userData.webID));

        // Fire client-side event so the overlay opens
        window.dispatchEvent(
            new CustomEvent("user_inspect_stats", {
                detail: {
                    userId: userData.webID, // use webID (actual userId), not room index
                },
            })
        );
    }, [objectId, userData]);

    const [opacity, setOpacity] = useState(1);
    const [isFading, setIsFading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(COLLAPSED);
    const elementRef = useRef<HTMLDivElement>(null);

    /* ---------------- position / fade calcs ---------------- */

    const updateFade = useCallback(
        (time: number) => {
            if (!isFading) return;
            FADE_TIME += time;
            const newOpacity = 1 - FADE_TIME / FADE_LENGTH;
            if (newOpacity <= 0) {
                onClose?.();
                return;
            }
            setOpacity(newOpacity);
        },
        [isFading, onClose]
    );

    const updatePosition = useCallback(
        (bounds: NitroRectangle, location: NitroPoint) => {
            if (!bounds || !location || !FIXED_STACK || !elementRef.current)
                return;

            let offset = -elementRef.current.offsetHeight;
            if (
                userType > -1 &&
                (userType === RoomObjectType.USER ||
                    userType === RoomObjectType.BOT ||
                    userType === RoomObjectType.RENTABLE_BOT)
            ) {
                offset += bounds.height > 50 ? 15 : 0;
            } else {
                offset -= 14;
            }

            FIXED_STACK.addValue(location.y - bounds.top);
            let maxStack = FIXED_STACK.getMax();
            if (maxStack < MAX_STACK - BUBBLE_DROP_SPEED)
                maxStack = MAX_STACK - BUBBLE_DROP_SPEED;
            MAX_STACK = maxStack;

            const deltaY = location.y - maxStack;
            let x = Math.floor(location.x - elementRef.current.offsetWidth / 2);
            let y = Math.floor(deltaY + offset);

            const maxLeft =
                GetNitroInstance().width -
                elementRef.current.offsetWidth -
                SPACE_AROUND_EDGES;
            const maxTop =
                GetNitroInstance().height -
                elementRef.current.offsetHeight -
                SPACE_AROUND_EDGES;

            x = Math.min(Math.max(x, SPACE_AROUND_EDGES), maxLeft);
            y = Math.min(Math.max(y, SPACE_AROUND_EDGES), maxTop);

            setPos({ x, y });
        },
        [userType]
    );

    const getClassNames = useMemo(() => {
        const newClassNames: string[] = ["nitro-context-menu"];
        if (isCollapsed) newClassNames.push("menu-hidden");
        newClassNames.push(pos.x !== null ? "visible" : "invisible");
        if (classNames.length) newClassNames.push(...classNames);
        return newClassNames;
    }, [pos, classNames, isCollapsed]);

    const getStyle = useMemo(() => {
        const newStyle: CSSProperties = {
            left: pos.x || 0,
            top: pos.y || 0,
            opacity,
        };
        return { ...newStyle, ...style };
    }, [pos, opacity, style]);

    /* ---------------- effects ---------------- */

    useEffect(() => {
        const ticker = GetTicker();

        const update = (time: number) => {
            try {
                if (!elementRef.current) return;

                updateFade(time);

                const session = GetRoomSession();
                if (!session) return;

                const bounds = GetRoomObjectBounds(
                    session.roomId,
                    objectId,
                    category
                );
                const location = GetRoomObjectScreenLocation(
                    session.roomId,
                    objectId,
                    category
                );

                if (bounds && location) updatePosition(bounds, location);
            } catch {
                // swallow any frame errors to avoid black screen
            }
        };

        ticker.add(update);
        return () => {
            ticker.remove(update);
        };
    }, [objectId, category, updateFade, updatePosition]);

    useEffect(() => {
        if (!fades) return;
        const timeout = setTimeout(() => setIsFading(true), FADE_DELAY);
        return () => clearTimeout(timeout);
    }, [fades]);

    useEffect(() => {
        COLLAPSED = isCollapsed;
    }, [isCollapsed]);

    useEffect(() => {
        FIXED_STACK = new FixedSizeStack(LOCATION_STACK_SIZE);
        MAX_STACK = -1000000;
        FADE_TIME = 1;
    }, []);

    // 🔥 REMOVED: the auto-fire inspect effect so it DOES NOT trigger on hover
    //
    // useEffect(() => {
    // if (ctEnabled) return; // do not auto-open when click-through is enabled
    // if (userType !== RoomObjectType.USER) return;
    //
    // const currentUserId = GetSessionDataManager().userId;
    // if (!userData || userData.webID === currentUserId) return;
    //
    // toggleStats();
    // }, [objectId, userType, userData, ctEnabled, toggleStats]);

    /* ---------------- render ---------------- */

    return (
        <Base
            innerRef={elementRef}
            position={position}
            classNames={getClassNames}
            style={getStyle}
            {...rest}
        >
            {!(collapsable && COLLAPSED) && (
                <>
                    {children}

                    <div
                        className="context-menu-option"
                        onClick={() => {
                            // Explicitly open stats ONLY when this is clicked
                            toggleStats();
                            setIsCollapsed(true);
                        }}
                    />
                </>
            )}

            {collapsable && (
                <ContextMenuCaretView
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    collapsed={isCollapsed}
                />
            )}
        </Base>
    );
};
