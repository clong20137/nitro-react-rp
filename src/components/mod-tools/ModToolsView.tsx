import {
    ILinkEventTracker,
    RoomEngineEvent,
    RoomId,
    RoomObjectCategory,
    RoomObjectType,
} from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import {
    AddEventLinkTracker,
    CreateLinkEvent,
    GetRoomSession,
    ISelectedUser,
    RemoveLinkEventTracker,
} from "../../api";
import { Base, Button } from "../../common";
import {
    useModTools,
    useObjectSelectedEvent,
    useRoomEngineEvent,
} from "../../hooks";
import { ModToolsChatlogView } from "./views/room/ModToolsChatlogView";
import { ModToolsRoomView } from "./views/room/ModToolsRoomView";
import { ModToolsTicketsView } from "./views/tickets/ModToolsTicketsView";
import { ModToolsUserChatlogView } from "./views/user/ModToolsUserChatlogView";
import { ModToolsUserView } from "./views/user/ModToolsUserView";

type ModToolsSection = "room" | "chatlog" | "user" | "report";

const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

/**
 * 24x24 room -> 6x6 sections -> 4x4 = 16 virtual rooms.
 * id: 1..16 (left->right, top->bottom)
 */
const computeVirtualRoomIdFromTile = (x: number, y: number) => {
    const sectionX = Math.floor(x / 6);
    const sectionY = Math.floor(y / 6);

    if (sectionX < 0 || sectionY < 0 || sectionX > 3 || sectionY > 3) return -1;

    return sectionY * 4 + sectionX + 1;
};

export const ModToolsView: FC<{}> = (props) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentRoomId, setCurrentRoomId] = useState<number>(-1);
    const [selectedUser, setSelectedUser] = useState<ISelectedUser>(null);
    const [isTicketsVisible, setIsTicketsVisible] = useState(false);
    const [activeSection, setActiveSection] = useState<ModToolsSection>("room");

    // Virtual Room ID we display in the panel
    const [virtualRoomId, setVirtualRoomId] = useState<number>(-1);

    // ---- Draggable state (we keep it centered by default) ----
    const [position, setPosition] = useState<{ x: number; y: number } | null>(
        null
    );
    const dragRef = useRef<{
        dragging: boolean;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    }>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

    const panelRef = useRef<HTMLDivElement>(null);

    const {
        openRooms = [],
        openRoomChatlogs = [],
        openUserChatlogs = [],
        openUserInfos = [],
        openRoomInfo = null,
        closeRoomInfo = null,
        toggleRoomInfo = null,
        openRoomChatlog = null,
        closeRoomChatlog = null,
        toggleRoomChatlog = null,
        openUserInfo = null,
        closeUserInfo = null,
        toggleUserInfo = null,
        openUserChatlog = null,
        closeUserChatlog = null,
        toggleUserChatlog = null,
    } = useModTools();

    // ---- Room load/unload ----
    useRoomEngineEvent<RoomEngineEvent>(
        [RoomEngineEvent.INITIALIZED, RoomEngineEvent.DISPOSED],
        (event) => {
            if (RoomId.isRoomPreviewerId(event.roomId)) return;

            switch (event.type) {
                case RoomEngineEvent.INITIALIZED:
                    setCurrentRoomId(event.roomId);
                    return;

                case RoomEngineEvent.DISPOSED:
                    setCurrentRoomId(-1);
                    setVirtualRoomId(-1);
                    return;
            }
        }
    );

    // ---- When user is selected, update selected user + jump to User tab ----
    useObjectSelectedEvent((event) => {
        if (event.category !== RoomObjectCategory.UNIT) return;

        const roomSession = GetRoomSession();
        if (!roomSession) return;

        const userData = roomSession.userDataManager.getUserDataByIndex(
            event.id
        );
        if (!userData || userData.type !== RoomObjectType.USER) return;

        setSelectedUser({ userId: userData.webID, username: userData.name });
        setActiveSection("user");
    });

    // ---- Link tracker ----
    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split("/");
                if (parts.length < 2) return;

                switch (parts[1]) {
                    case "show":
                        setIsVisible(true);
                        return;
                    case "hide":
                        setIsVisible(false);
                        return;
                    case "toggle":
                        setIsVisible((prevValue) => !prevValue);
                        return;

                    case "open-room-info":
                        openRoomInfo(Number(parts[2]));
                        return;
                    case "close-room-info":
                        closeRoomInfo(Number(parts[2]));
                        return;
                    case "toggle-room-info":
                        toggleRoomInfo(Number(parts[2]));
                        return;

                    case "open-room-chatlog":
                        openRoomChatlog(Number(parts[2]));
                        return;
                    case "close-room-chatlog":
                        closeRoomChatlog(Number(parts[2]));
                        return;
                    case "toggle-room-chatlog":
                        toggleRoomChatlog(Number(parts[2]));
                        return;

                    case "open-user-info":
                        openUserInfo(Number(parts[2]));
                        return;
                    case "close-user-info":
                        closeUserInfo(Number(parts[2]));
                        return;
                    case "toggle-user-info":
                        toggleUserInfo(Number(parts[2]));
                        return;

                    case "open-user-chatlog":
                        openUserChatlog(Number(parts[2]));
                        return;
                    case "close-user-chatlog":
                        closeUserChatlog(Number(parts[2]));
                        return;
                    case "toggle-user-chatlog":
                        toggleUserChatlog(Number(parts[2]));
                        return;
                }
            },
            eventUrlPrefix: "mod-tools/",
        };

        AddEventLinkTracker(linkTracker);
        return () => RemoveLinkEventTracker(linkTracker);
    }, [
        openRoomInfo,
        closeRoomInfo,
        toggleRoomInfo,
        openRoomChatlog,
        closeRoomChatlog,
        toggleRoomChatlog,
        openUserInfo,
        closeUserInfo,
        toggleUserInfo,
        openUserChatlog,
        closeUserChatlog,
        toggleUserChatlog,
    ]);

    const canUseRoom = currentRoomId > 0;
    const canUseUser = !!selectedUser;

    const subtitle = useMemo(() => {
        switch (activeSection) {
            case "room":
                return "Room tools & quick actions";
            case "chatlog":
                return "Room chat logs";
            case "user":
                return "Selected user tools";
            case "report":
                return "Reports & tickets";
            default:
                return "";
        }
    }, [activeSection]);

    // ------------------------------------------------------------
    // Virtual Room ID updater:
    // Attempts to read the local avatar tile from room session user data,
    // then computes VR id via 6x6 grid sections.
    // ------------------------------------------------------------
    useEffect(() => {
        const interval = window.setInterval(() => {
            try {
                const roomSession: any = GetRoomSession();
                if (!roomSession) return;

                // Most builds have something like: roomSession.userDataManager.getUserData(roomSession.ownUserId)
                const ownId =
                    roomSession.ownUserId ??
                    roomSession._ownUserId ??
                    roomSession.habboId ??
                    null;

                const ownData =
                    ownId !== null && roomSession.userDataManager?.getUserData
                        ? roomSession.userDataManager.getUserData(ownId)
                        : null;

                // If your build exposes x/y directly on the user data:
                const x = ownData?.x ?? ownData?.location?.x ?? null;
                const y = ownData?.y ?? ownData?.location?.y ?? null;

                if (typeof x === "number" && typeof y === "number") {
                    const vrId = computeVirtualRoomIdFromTile(x, y);
                    if (vrId !== virtualRoomId) setVirtualRoomId(vrId);
                }
            } catch {
                /* no-op */
            }
        }, 350);

        return () => window.clearInterval(interval);
    }, [virtualRoomId]);

    // ------------------------------------------------------------
    // Drag logic (header drag)
    // ------------------------------------------------------------
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragRef.current.dragging) return;
            if (!panelRef.current) return;

            const rect = panelRef.current.getBoundingClientRect();

            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;

            // Keep panel inside viewport a bit
            const nextX = dragRef.current.originX + dx;
            const nextY = dragRef.current.originY + dy;

            const maxX = window.innerWidth - rect.width - 8;
            const maxY = window.innerHeight - rect.height - 8;

            setPosition({
                x: clamp(nextX, 8, Math.max(8, maxX)),
                y: clamp(nextY, 8, Math.max(8, maxY)),
            });
        };

        const onUp = () => {
            dragRef.current.dragging = false;
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, []);

    const beginDrag = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // left click only

        // If we've never set a position, start from current center position
        if (!position) {
            const rect = panelRef.current?.getBoundingClientRect();
            const startX = rect ? rect.left : window.innerWidth / 2;
            const startY = rect ? rect.top : window.innerHeight / 2;
            setPosition({ x: startX, y: startY });
        }

        const current =
            position ??
            (() => {
                const rect = panelRef.current?.getBoundingClientRect();
                return { x: rect?.left ?? 0, y: rect?.top ?? 0 };
            })();

        dragRef.current.dragging = true;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.originX = current.x;
        dragRef.current.originY = current.y;
    };

    const doToggleRoomTool = () => {
        if (!canUseRoom) return;
        CreateLinkEvent(`mod-tools/toggle-room-info/${currentRoomId}`);
    };

    const doToggleRoomChatlog = () => {
        if (!canUseRoom) return;
        CreateLinkEvent(`mod-tools/toggle-room-chatlog/${currentRoomId}`);
    };

    const doToggleUserTool = () => {
        if (!canUseUser) return;
        CreateLinkEvent(`mod-tools/toggle-user-info/${selectedUser.userId}`);
    };

    const doToggleUserChatlog = () => {
        if (!canUseUser) return;
        CreateLinkEvent(`mod-tools/toggle-user-chatlog/${selectedUser.userId}`);
    };

    // Position style:
    // - If position is null => centered via CSS transform
    // - If set => absolute top/left (dragging)
    const positionStyle: React.CSSProperties = position
        ? { left: position.x, top: position.y, transform: "none" }
        : {};

    return (
        <>
            {isVisible && (
                <div
                    ref={panelRef}
                    className="mod-tools-panel"
                    style={positionStyle}
                >
                    <div className="module-header" onMouseDown={beginDrag}>
                        <span>Mod Tools</span>
                        <button
                            className="close-btn"
                            onClick={() => setIsVisible(false)}
                            aria-label="Close"
                        />
                    </div>

                    <div className="mod-tools-body">
                        {/* LEFT NAV */}
                        <div className="mod-tools-nav">
                            <button
                                className={`mod-tools-tab ${
                                    activeSection === "room" ? "is-active" : ""
                                }`}
                                onClick={() => setActiveSection("room")}
                            >
                                <Base className="icon icon-small-room" />
                                <span>Room</span>
                            </button>

                            <button
                                className={`mod-tools-tab ${
                                    activeSection === "chatlog"
                                        ? "is-active"
                                        : ""
                                }`}
                                onClick={() => setActiveSection("chatlog")}
                            >
                                <Base className="icon icon-chat-history" />
                                <span>Chatlogs</span>
                            </button>

                            <button
                                className={`mod-tools-tab ${
                                    activeSection === "user" ? "is-active" : ""
                                }`}
                                onClick={() => setActiveSection("user")}
                            >
                                <Base className="icon icon-user" />
                                <span>User</span>
                            </button>

                            <button
                                className={`mod-tools-tab ${
                                    activeSection === "report"
                                        ? "is-active"
                                        : ""
                                }`}
                                onClick={() => setActiveSection("report")}
                            >
                                <Base className="icon icon-tickets" />
                                <span>Reports</span>
                            </button>

                            <div className="mod-tools-context">
                                <div className="ctx-row">
                                    <span className="ctx-label">Virtual</span>
                                    <span className="ctx-value">
                                        {virtualRoomId > 0
                                            ? `#${virtualRoomId}`
                                            : "—"}
                                    </span>
                                </div>

                                <div className="ctx-row">
                                    <span className="ctx-label">User</span>
                                    <span className="ctx-value">
                                        {canUseUser
                                            ? selectedUser.username
                                            : "—"}
                                    </span>
                                </div>

                                <div className="ctx-hint">
                                    Tip: click a user in-room to auto-select
                                    them.
                                </div>
                            </div>
                        </div>

                        {/* RIGHT CONTENT */}
                        <div className="mod-tools-main">
                            <div className="mod-tools-title">
                                <div className="title">{subtitle}</div>
                                <div className="desc">
                                    Use the buttons below to open the
                                    corresponding mod window.
                                </div>
                            </div>

                            {activeSection === "room" && (
                                <div className="mod-tools-actions">
                                    <Button
                                        className="mod-action"
                                        disabled={!canUseRoom}
                                        onClick={doToggleRoomTool}
                                    >
                                        <Base className="icon icon-small-room me-2" />{" "}
                                        Open Room Tool
                                    </Button>

                                    <Button
                                        className="mod-action"
                                        disabled={!canUseRoom}
                                        onClick={doToggleRoomChatlog}
                                    >
                                        <Base className="icon icon-chat-history me-2" />{" "}
                                        Open Room Chatlog
                                    </Button>
                                </div>
                            )}

                            {activeSection === "chatlog" && (
                                <div className="mod-tools-actions">
                                    <Button
                                        className="mod-action"
                                        disabled={!canUseRoom}
                                        onClick={doToggleRoomChatlog}
                                    >
                                        <Base className="icon icon-chat-history me-2" />{" "}
                                        Open Room Chatlog
                                    </Button>

                                    <div className="mod-note">
                                        Room chatlog opens in a separate window
                                        for easier viewing.
                                    </div>
                                </div>
                            )}

                            {activeSection === "user" && (
                                <div className="mod-tools-actions">
                                    <Button
                                        className="mod-action"
                                        disabled={!canUseUser}
                                        onClick={doToggleUserTool}
                                    >
                                        <Base className="icon icon-user me-2" />{" "}
                                        Open User Tool
                                    </Button>

                                    <Button
                                        className="mod-action"
                                        disabled={!canUseUser}
                                        onClick={doToggleUserChatlog}
                                    >
                                        <Base className="icon icon-chat-history me-2" />{" "}
                                        Open User Chatlog
                                    </Button>

                                    {!canUseUser && (
                                        <div className="mod-note">
                                            Select a user in-room first.
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSection === "report" && (
                                <div className="mod-tools-actions">
                                    <Button
                                        className="mod-action"
                                        onClick={() =>
                                            setIsTicketsVisible((prev) => !prev)
                                        }
                                    >
                                        <Base className="icon icon-tickets me-2" />{" "}
                                        {isTicketsVisible ? "Hide" : "Open"}{" "}
                                        Report Tool
                                    </Button>

                                    <div className="mod-note">
                                        Reports open in a dedicated ticket
                                        window.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {openRooms.length > 0 &&
                openRooms.map((roomId) => (
                    <ModToolsRoomView
                        key={roomId}
                        roomId={roomId}
                        onCloseClick={() =>
                            CreateLinkEvent(
                                `mod-tools/close-room-info/${roomId}`
                            )
                        }
                    />
                ))}

            {openRoomChatlogs.length > 0 &&
                openRoomChatlogs.map((roomId) => (
                    <ModToolsChatlogView
                        key={roomId}
                        roomId={roomId}
                        onCloseClick={() =>
                            CreateLinkEvent(
                                `mod-tools/close-room-chatlog/${roomId}`
                            )
                        }
                    />
                ))}

            {openUserInfos.length > 0 &&
                openUserInfos.map((userId) => (
                    <ModToolsUserView
                        key={userId}
                        userId={userId}
                        onCloseClick={() =>
                            CreateLinkEvent(
                                `mod-tools/close-user-info/${userId}`
                            )
                        }
                    />
                ))}

            {openUserChatlogs.length > 0 &&
                openUserChatlogs.map((userId) => (
                    <ModToolsUserChatlogView
                        key={userId}
                        userId={userId}
                        onCloseClick={() =>
                            CreateLinkEvent(
                                `mod-tools/close-user-chatlog/${userId}`
                            )
                        }
                    />
                ))}

            {isTicketsVisible && (
                <ModToolsTicketsView
                    onCloseClick={() => setIsTicketsVisible(false)}
                />
            )}
        </>
    );
};
