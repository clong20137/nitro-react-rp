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
import { GetSessionDataManager } from "../../../../api";
import { stringify } from "querystring";
import { GetRoomEngine } from "../../../../api";
interface ContextMenuViewProps extends BaseProps<HTMLDivElement> {
    objectId: number;
    category: number;
    userType?: number;
    fades?: boolean;
    onClose: () => void;
    collapsable?: boolean;
}

const LOCATION_STACK_SIZE: number = 25;
const BUBBLE_DROP_SPEED: number = 3;
const FADE_DELAY = 5000;
const FADE_LENGTH = 75;
const SPACE_AROUND_EDGES = 10;

let COLLAPSED = false;
let FIXED_STACK: FixedSizeStack = null;
let MAX_STACK = -1000000;
let FADE_TIME = 1;

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

    const [pos, setPos] = useState<{ x: number; y: number }>({
        x: null,
        y: null,
    });
    const userData =
        GetRoomSession().userDataManager.getUserDataByIndex(objectId);

    const toggleStats = () => {
        if (objectId <= 0) return;

        SendMessageComposer(new InspectUserStatsComposer(userData.webID));
        console.log(
            `[Inspect] Sending InspectUserStatsComposer for objectId: ${userData}`
        );
        console.log(
            `[Inspect] Sending InspectUserStatsComposer for objectId: ${userData.webID}`
        );
    };

    const [opacity, setOpacity] = useState(1);
    const [isFading, setIsFading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(COLLAPSED);
    const elementRef = useRef<HTMLDivElement>(null);

    const updateFade = useCallback(
        (time: number) => {
            if (!isFading) return;
            FADE_TIME += time;

            const newOpacity = 1 - FADE_TIME / FADE_LENGTH;
            if (newOpacity <= 0) {
                onClose();
                return false;
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

    useEffect(() => {
        const update = (time: number) => {
            if (!elementRef.current) return;

            updateFade(time);

            const bounds = GetRoomObjectBounds(
                GetRoomSession().roomId,
                objectId,
                category
            );
            const location = GetRoomObjectScreenLocation(
                GetRoomSession().roomId,
                objectId,
                category
            );

            if (bounds && location) {
                updatePosition(bounds, location);
            }
        };

        const ticker = GetTicker();
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

    // ✅ Auto-fire inspect event on context menu open
    useEffect(() => {
        if (userType !== RoomObjectType.USER) return;

        const currentUserId = GetSessionDataManager().userId;

        if (objectId === currentUserId) return; // 👈 prevent inspecting yourself
        console.log(
            "Packet sent from ContextMenu.tsx for " + currentUserId + ""
        );
        toggleStats(); // send inspect packet for other users only
    }, [objectId, userType]);

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
                            window.dispatchEvent(
                                new CustomEvent("user_inspect_stats", {
                                    detail: {
                                        userId: objectId,
                                        username: "Opponent",
                                        figure: "hr-100.hd-180-1.ch-255-66.lg-275-82",
                                        health: 45,
                                        maxHealth: 100,
                                        energy: 70,
                                        maxEnergy: 100,
                                        hunger: 20,
                                        maxHunger: 100,
                                        aggression: 35,
                                    },
                                })
                            );
                            setIsCollapsed(true);
                        }}
                    ></div>
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
