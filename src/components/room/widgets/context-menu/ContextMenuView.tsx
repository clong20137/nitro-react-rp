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

/**
 * TODO: Replace these with your real composers (or create them server-side):
 *
 * - InspectBotStatsComposer(botId)
 * - BotActionComposer(botId, action)
 *
 * The pattern is correct; only the message class names may differ.
 */
// import { InspectBotStatsComposer } from "...";
// import { BotActionComposer } from "...";

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
            if (enabled && onClose) onClose();
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

    if (contextMenuDisabled || ctEnabled) return null;

    /* ---------------- state ---------------- */

    const [pos, setPos] = useState<{ x: number | null; y: number | null }>({
        x: null,
        y: null,
    });

    const userData =
        GetRoomSession().userDataManager.getUserDataByIndex(objectId);

    const isBot =
        userType === RoomObjectType.BOT ||
        userType === RoomObjectType.RENTABLE_BOT;

    const isUser = userType === RoomObjectType.USER;

    /**
     * ⚠️ VERY IMPORTANT:
     * For USERS you correctly use userData.webID as the real userId.
     * For BOTS you need the bot's id. Depending on your Nitro fork,
     * the bot id may be in one of these:
     *
     * - userData.webID
     * - userData.id
     * - userData.roomIndex / index
     *
     * We’ll pick the most likely: webID first, fall back to objectId.
     */
    const botId = useMemo(() => {
        if (!userData) return objectId;
        return userData.webID && userData.webID > 0 ? userData.webID : objectId;
    }, [userData, objectId]);

    // Only trigger stats explicitly (on click)
    const toggleStats = useCallback(() => {
        if (objectId <= 0 || !userData) return;

        SendMessageComposer(new InspectUserStatsComposer(userData.webID));

        window.dispatchEvent(
            new CustomEvent("user_inspect_stats", {
                detail: { userId: userData.webID },
            })
        );

        onClose?.();
    }, [objectId, userData, onClose]);

    /**
     * BOT: Inspect
     * Replace with your real composer + event name.
     */
    const inspectBot = useCallback(() => {
        if (!userData) return;

        // Example pattern:
        // SendMessageComposer(new InspectBotStatsComposer(botId));

        window.dispatchEvent(
            new CustomEvent("bot_inspect_stats", {
                detail: { botId },
            })
        );

        onClose?.();
    }, [userData, botId, onClose]);

    /**
     * BOT: Action sender (attack, heal, cuff, etc.)
     * Replace with your real composer.
     */
    const botAction = useCallback(
        (action: string) => {
            if (!userData) return;

            // Example pattern:
            // SendMessageComposer(new BotActionComposer(botId, action));

            window.dispatchEvent(
                new CustomEvent("bot_action", {
                    detail: { botId, action },
                })
            );

            onClose?.();
        },
        [userData, botId, onClose]
    );

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

                if (bounds && location) {
                    updatePosition(bounds, location);
                }
            } catch {
                // swallow frame errors
            }
        };

        ticker.add(update);

        // ✅ CLEANUP — THIS IS THE IMPORTANT PART
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

    useEffect(() => {
        setIsCollapsed(false);
        COLLAPSED = false;
    }, [objectId, category]);

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

                    {/* ✅ USER MENU */}
                    {isUser && <div className="context-menu-options"></div>}

                    {/* ✅ BOT MENU */}
                    {isBot && (
                        <div className="context-menu-options">
                            <div className="context-menu-divider" />
                        </div>
                    )}

                    {/* collapse after click if desired */}
                    {/* If you want collapse-on-any-action, just setIsCollapsed(true) inside actions */}
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
