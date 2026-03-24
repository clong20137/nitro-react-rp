import React, { useEffect, useMemo, useRef, useState } from "react";
import "./PhoneView.scss";

import { MessengerFriend, GetSessionDataManager, SendMessageComposer } from "../../api";
import { FriendsListGroupView } from "../friends/views/friends-list/friends-list-group/FriendsListGroupView";
import { FriendsMessengerThreadView } from "../friends/views/messenger/messenger-thread/FriendsMessengerThreadView";
import { useFriends, useMessenger } from "../../hooks";
import { LayoutAvatarImageView } from "../../common";

import { DoorDashOrderComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/DoorDashComposer";
import { AcceptDoorDashOrderComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/AcceptDoorDashOrderComposer";
import { DoorDashOrderData } from "@nitrots/nitro-renderer/src/nitro/communication/messages/parser/DoorDashOrdersParser";

export type PhoneApp = "home" | "friends" | "messages" | "settings" | "doordash" | "youtube";

type WallpaperOption = "classic" | "night" | "sunset";

interface PhoneViewProps {
    onClose: () => void;
}

const fmt12h = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));

    if (Number.isNaN(h) || Number.isNaN(m)) return "--:--";

    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mm = String(m).padStart(2, "0");

    return `${h12}:${mm} ${ampm}`;
};

const getDeviceTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const h12 = hours % 12 || 12;
    const ampm = hours >= 12 ? "PM" : "AM";

    return `${h12}:${minutes} ${ampm}`;
};


const getAvatarFigure = (value: any): string => {
    if (!value) return "";

    return (
        value.figureString ||
        value.figure ||
        value.avatarFigure ||
        value.look ||
        ""
    );
};

export const PhoneView: React.FC<PhoneViewProps> = ({ onClose }) => {
    const phoneRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);
    const splashTimeoutRef = useRef<number | null>(null);

    const { friends = [] } = useFriends();
    const { getMessageThread = null, setActiveThreadId = null } = useMessenger();

    const [activeApp, setActiveApp] = useState<PhoneApp>("home");
    const [splashApp, setSplashApp] = useState<string | null>(null);
    const [position, setPosition] = useState({ x: 50, y: 80 });
    const [dragging, setDragging] = useState(false);
    const [shake, setShake] = useState(false);
    const [doorDashBadge, setDoorDashBadge] = useState(0);


    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("phoneDarkMode") === "1");
    const [displayTime, setDisplayTime] = useState(getDeviceTime());
    const [worldTime, setWorldTime] = useState<string | null>(null);


    useEffect(() => {
        localStorage.setItem("phoneDarkMode", darkMode ? "1" : "0");
    }, [darkMode]);

    useEffect(() => {
        const interval = window.setInterval(() => setDisplayTime(getDeviceTime()), 1000);

        const handleTimeOfDay = (e: any) => {
            const detail = e?.detail as { hhmm?: string } | undefined;
            if (detail?.hhmm) setWorldTime(fmt12h(detail.hhmm));
        };

        window.addEventListener("time_of_day_update", handleTimeOfDay);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("time_of_day_update", handleTimeOfDay);
        };
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging || !dragRef.current) return;

            setPosition({
                x: e.clientX - dragRef.current.dx,
                y: e.clientY - dragRef.current.dy,
            });
        };

        const handleMouseUp = () => setDragging(false);

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [dragging]);

    useEffect(() => {
        const handler = () => {
            setShake(true);

            try {
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    (navigator as any).vibrate([120, 80, 120]);
                }
            } catch {}

            window.setTimeout(() => setShake(false), 500);
        };

        window.addEventListener("phone_shake", handler);

        return () => window.removeEventListener("phone_shake", handler);
    }, []);

    useEffect(() => {
        return () => {
            if (splashTimeoutRef.current) window.clearTimeout(splashTimeoutRef.current);
        };
    }, []);

    const onMouseDownHeader = (e: React.MouseEvent) => {
        if (!phoneRef.current) return;

        const rect = phoneRef.current.getBoundingClientRect();

        dragRef.current = {
            dx: e.clientX - rect.left,
            dy: e.clientY - rect.top,
        };

        setDragging(true);
    };

    const openApp = (app: PhoneApp, label: string) => {
        if (splashTimeoutRef.current) window.clearTimeout(splashTimeoutRef.current);

        setSplashApp(label);
        window.setTimeout(() => setActiveApp(app), 160);

        splashTimeoutRef.current = window.setTimeout(() => {
            setSplashApp(null);
        }, 520);
    };

    const handleMessageFriendFromFriendsApp = (friendId: number) => {
        const thread = getMessageThread?.(friendId);

        if (thread && setActiveThreadId) setActiveThreadId(thread.threadId);

        openApp("messages", "Messages");
    };

    const handleDoorDashOrdersUpdated = (orders: DoorDashOrderData[]) => setDoorDashBadge(orders.length);
    const handleDoorDashOrderAccepted = (orders: DoorDashOrderData[]) => setDoorDashBadge(orders.length);

    return (
        <div className="phone-root">
            <div
                ref={phoneRef}
                className={`phone-frame ${shake ? "phone-shake" : ""} ${darkMode ? "is-dark" : ""}`}
                style={{ left: position.x, top: position.y, position: "fixed" }}
            >
                <div className="phone-header" onMouseDown={onMouseDownHeader}>
                    <span className="phone-time">{worldTime || displayTime}</span>
                    <span className="phone-notch" />
                    <div className="phone-header-right">
                        <button
                            className="phone-close"
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClose();
                            }}
                        >
                            ✕
                        </button>
                        <span className="phone-battery" />
                    </div>
                </div>

                {splashApp && (
                    <div className="phone-splash-screen">
                        <div className="phone-splash-card">
                            <div className="phone-splash-icon">
                                <span className="phone-splash-bubble one" />
                                <span className="phone-splash-bubble two" />
                            </div>
                            <div className="phone-splash-title">{splashApp}</div>
                        </div>
                    </div>
                )}

                {activeApp === "home" && (
                    <div className="phone-home">
                        <div className="phone-app-grid">
                            <PhoneAppIcon label="Settings" iconSrc={require("../../icons/settings_icon.png")} onClick={() => openApp("settings", "Settings")} />
                            <PhoneAppIcon label="Contacts" iconSrc={require("../../icons/contacts.png")} onClick={() => openApp("friends", "Contacts")} badge={friends.length} />
                            <PhoneAppIcon label="Messages" iconSrc={require("../../icons/messages.png")} onClick={() => openApp("messages", "Messages")} />
                            <PhoneAppIcon label="YouTube" iconSrc={require("../../icons/camera.png")} onClick={() => openApp("youtube", "YouTube")} />
                            <PhoneAppIcon label="DoorDash" iconSrc={require("../../icons/doordash.png")} badge={doorDashBadge} onClick={() => openApp("doordash", "DoorDash")} />
                        </div>
                    </div>
                )}

                {activeApp === "friends" && (
                    <FriendsApp friends={friends} onBack={() => setActiveApp("home")} onMessageFriend={handleMessageFriendFromFriendsApp} />
                )}

                {activeApp === "messages" && <MessagesApp onBack={() => setActiveApp("home")} />}

                {activeApp === "settings" && (
                    <SettingsApp
                        onBack={() => setActiveApp("home")}

                        darkMode={darkMode}
                        setDarkMode={setDarkMode}
                    />
                )}

                {activeApp === "doordash" && (
                    <DoorDashApp
                        onBack={() => setActiveApp("home")}
                        onOrdersUpdated={handleDoorDashOrdersUpdated}
                        onOrderAccepted={handleDoorDashOrderAccepted}
                    />
                )}

                {activeApp === "youtube" && <YouTubeApp onBack={() => setActiveApp("home")} />}

                <div className="phone-home-indicator" />
            </div>
        </div>
    );
};

interface PhoneAppIconProps {
    label: string;
    iconSrc: string;
    badge?: number;
    onClick: () => void;
}

const PhoneAppIcon: React.FC<PhoneAppIconProps> = ({ label, iconSrc, badge, onClick }) => (
    <button className="phone-app-icon" type="button" onClick={onClick}>
        <div className="phone-app-icon-inner">
            <span className="phone-app-icon-shine" />
            <img className="phone-app-icon-img" src={iconSrc} alt={label} draggable={false} />
            {badge !== undefined && badge > 0 && <span className="phone-app-icon-badge">{badge}</span>}
        </div>
        <span className="phone-app-icon-label">{label}</span>
    </button>
);

type DoorDashAppProps = {
    onBack: () => void;
    onOrdersUpdated?: (orders: DoorDashOrderData[]) => void;
    onOrderAccepted?: (orders: DoorDashOrderData[]) => void;
};

const DoorDashApp: React.FC<DoorDashAppProps> = ({ onBack, onOrdersUpdated, onOrderAccepted }) => {
    const [isOrdering, setIsOrdering] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [orders, setOrders] = useState<DoorDashOrderData[]>([]);

    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<DoorDashOrderData[]>;
            const list = custom.detail || [];

            setOrders((prev) => {
                const prevIds = new Set(prev.map((o) => o.orderId));
                const hasNew = list.some((o) => !prevIds.has(o.orderId));

                if (hasNew) window.dispatchEvent(new CustomEvent("phone_shake"));
                if (onOrdersUpdated) onOrdersUpdated(list);

                return list;
            });
        };

        window.addEventListener("doordash_orders", handler);
        return () => window.removeEventListener("doordash_orders", handler);
    }, [onOrdersUpdated]);

    const handlePizzaOrder = () => {
        if (isOrdering) return;

        setIsOrdering(true);
        setStatus("Placing your pizza order…");

        try {
            SendMessageComposer(new DoorDashOrderComposer(1));
            setStatus("Order sent! Waiting for a delivery driver…");
        } catch (e) {
            console.error(e);
            setStatus("Something went wrong sending your order.");
            setIsOrdering(false);
        }
    };

    const handleAcceptOrder = (orderId: number) => {
        try {
            SendMessageComposer(new AcceptDoorDashOrderComposer(orderId));

            setOrders((prev) => {
                const next = prev.filter((o) => o.orderId !== orderId);

                if (onOrderAccepted) onOrderAccepted(next);
                else if (onOrdersUpdated) onOrdersUpdated(next);

                return next;
            });
        } catch (e) {
            console.error(e);
        }
    };

    const minutesAgo = (ageSeconds: number) => Math.floor(Math.max(0, ageSeconds || 0) / 60);

    return (
        <div className="phone-app phone-doordash">
            <PhoneSubHeader title="DoorDash" onBack={onBack} />

            <div className="phone-list phone-scrollable-body">
                <div className="phone-card dd-card-customer">
                    <div className="phone-card-title">Pizza Delivery</div>
                    <div className="phone-card-body">
                        <p className="dd-card-text-main">Get a hot pizza delivered to your current location.</p>
                        <p className="hint dd-pricing">
                            Base price: <b>3 credits</b> + <b>1 credit</b> per room of travel.
                        </p>
                        <button className="phone-primary-btn dd-primary-btn" disabled={isOrdering} onClick={handlePizzaOrder}>
                            {isOrdering ? "Ordering…" : "Order Pizza"}
                        </button>
                        {status && <div className="phone-status-text dd-status">{status}</div>}
                    </div>
                </div>

                <div className="phone-card dd-card-driver">
                    <div className="phone-card-title">Active Orders</div>
                    <div className="phone-card-body">
                        {!orders.length && <p className="hint dd-empty">No active orders right now.</p>}

                        {!!orders.length && (
                            <div className="dd-order-list">
                                {orders.map((o) => (
                                    <div key={o.orderId} className="dd-order-row">
                                        <div className="dd-order-main">
                                            <div className="dd-order-customer">{o.username}</div>
                                            <div className="dd-order-location">{o.virtualRoomName || `vRoom ${o.virtualRoomId}`}</div>
                                            <div className="dd-order-meta">
                                                {minutesAgo(o.ageSeconds)} min ago • #{o.orderId}
                                            </div>
                                        </div>
                                        <button className="dd-order-accept-btn" onClick={() => handleAcceptOrder(o.orderId)}>
                                            Accept
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PhoneSubHeader: React.FC<{ title: string; onBack: () => void; rightContent?: React.ReactNode; avatarFigure?: string | null }> = ({ title, onBack, rightContent, avatarFigure = null }) => {
    const [isBacking, setIsBacking] = useState(false);

    const handleBack = () => {
        if (isBacking) return;

        setIsBacking(true);
        window.setTimeout(() => onBack(), 140);
    };

    return (
        <div className={`phone-subheader ${isBacking ? "is-backing" : ""}`}>
            <button type="button" onClick={handleBack} className="phone-back-btn">
                ‹
            </button>

            <div className="phone-subheader-main">
                {avatarFigure && (
                    <div className="phone-subheader-avatar">
                        <LayoutAvatarImageView figure={avatarFigure} headOnly={true} direction={2} />
                    </div>
                )}

                <span className="phone-subtitle">{title}</span>
            </div>

            <div className="phone-subheader-right">{rightContent || <span className="phone-subheader-spacer" />}</div>
        </div>
    );
};

interface MessagesAppProps {
    onBack: () => void;
}

const MessagesApp: React.FC<MessagesAppProps> = ({ onBack }) => {
    const { visibleThreads = [], activeThread = null, sendMessage = null, setActiveThreadId = null, closeThread = null } = useMessenger();
    const [mode, setMode] = useState<"list" | "chat">("list");
    const [messageText, setMessageText] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const messagesBoxRef = useRef<HTMLDivElement | null>(null);
    const sessionUserId = GetSessionDataManager().userId;

    const openThread = (threadId: number) => {
        if (setActiveThreadId) setActiveThreadId(threadId);
        setMode("chat");
    };

    const handleSend = () => {
        if (!activeThread || !sendMessage || !messageText.trim()) return;
        sendMessage(activeThread, sessionUserId, messageText.trim());
        setMessageText("");
    };

    const getLastMessagePreview = (thread: any): string => {
        const groups = (thread?.groups || []) as any[];
        if (!groups.length) return "New conversation";

        const lastGroup = groups[groups.length - 1];
        const chats = (lastGroup?.chats || []) as any[];
        if (!chats.length) return "New conversation";

        return chats[chats.length - 1]?.message || "New conversation";
    };

    const filteredThreads = visibleThreads.filter((thread: any) =>
        thread?.participant?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const hasMessages =
        !!activeThread &&
        Array.isArray((activeThread as any).groups) &&
        (activeThread as any).groups.some((g: any) => Array.isArray(g.chats) && g.chats.length > 0);

    useEffect(() => {
        if (mode !== "chat" || !messagesBoxRef.current) return;
        messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
    }, [mode, activeThread, (activeThread as any)?.groups?.length]);

    if (mode === "chat" && activeThread) {
        return (
            <div className="phone-app phone-messages">
                <PhoneSubHeader title={activeThread.participant?.name || "Messages"} avatarFigure={getAvatarFigure(activeThread.participant)} onBack={() => setMode("list")} />

                <div className="phone-messages-chat-view">
                    <div className="phone-chat-body" ref={messagesBoxRef}>
                        {hasMessages ? (
                            <FriendsMessengerThreadView thread={activeThread as any} />
                        ) : (
                            <div className="phone-empty-state chat-empty">
                                <div className="phone-empty-state__bubble" />
                                <div className="phone-empty-state__title">No messages yet</div>
                                <div className="phone-empty-state__text">Start a conversation with {activeThread.participant?.name}.</div>
                            </div>
                        )}
                    </div>

                    <div className="phone-chat-input">
                        <input
                            type="text"
                            placeholder="Message"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        />
                        <button type="button" onClick={handleSend}>
                            Send
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="phone-app phone-messages">
            <PhoneSubHeader title="Messages" onBack={onBack} />

            <div className="phone-searchbar">
                <span className="phone-search-icon">⌕</span>
                <input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                />
            </div>

            <div className="phone-thread-list">
                {!filteredThreads.length && (
                    <div className="phone-empty-state">
                        <div className="phone-empty-state__bubble" />
                        <div className="phone-empty-state__title">No conversations</div>
                        <div className="phone-empty-state__text">
                            Start a conversation by messaging someone from your friends list if you have any.
                        </div>
                    </div>
                )}

                {filteredThreads.map((thread: any) => (
                    <button key={thread.threadId} type="button" className="phone-thread-row" onClick={() => openThread(thread.threadId)}>
                        <div className="phone-thread-avatar">
                            {getAvatarFigure(thread.participant) ? (
                                <LayoutAvatarImageView figure={getAvatarFigure(thread.participant)} headOnly={true} direction={2} />
                            ) : (
                                <span className="phone-thread-avatar-fallback">{(thread.participant?.name || "?").charAt(0)}</span>
                            )}
                        </div>
                        <div className="phone-thread-main">
                            <div className="phone-thread-top">
                                <div className="phone-thread-name">{thread.participant?.name}</div>
                                <div className="phone-thread-time">now</div>
                            </div>
                            <div className="phone-thread-bottom">
                                <div className="phone-thread-preview">{getLastMessagePreview(thread)}</div>
                            </div>
                        </div>
                        {closeThread && (
                            <span
                                className="phone-thread-delete"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeThread(thread.threadId);
                                }}
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

interface FriendsAppProps {
    friends: MessengerFriend[];
    onBack: () => void;
    onMessageFriend: (friendId: number) => void;
}

const FriendsApp: React.FC<FriendsAppProps> = ({ friends, onBack, onMessageFriend }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedFriendsIds, setSelectedFriendsIds] = useState<number[]>([]);
    const filteredFriends = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term.length) return friends;
        return friends.filter((f) => f.name.toLowerCase().includes(term));
    }, [friends, searchTerm]);

    const selectFriend = (id: number) => {
        setSelectedFriendsIds([id]);
        onMessageFriend(id);
    };

    return (
        <div className="phone-app phone-friends">
            <PhoneSubHeader title="Contacts" onBack={onBack} />

            <div className="phone-searchbar">
                <span className="phone-search-icon">⌕</span>
                <input type="text" placeholder="Search contacts" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <div className="phone-list phone-scrollable-body">
                {!filteredFriends.length && <div className="phone-empty centered">No users found.</div>}

                {!!filteredFriends.length && (
                    <FriendsListGroupView list={filteredFriends} selectedFriendsIds={selectedFriendsIds} selectFriend={selectFriend} />
                )}
            </div>
        </div>
    );
};

const wallpaperOptions: Array<{ id: WallpaperOption; label: string }> = [
    { id: "classic", label: "Classic" },
    { id: "night", label: "Night" },
    { id: "sunset", label: "Sunset" },
];


const SettingsApp: React.FC<{
    onBack: () => void;
    darkMode: boolean;
    setDarkMode: (value: boolean) => void;
}> = ({ onBack, darkMode, setDarkMode }) => {
    return (
        <div className="phone-app phone-settings">
            <PhoneSubHeader title="Settings" onBack={onBack} />

            <div className="phone-settings-list phone-scrollable-body">
                <details className="phone-settings-group" open>
                    <summary className="phone-settings-nav-item">
                        <span>Wallpaper</span>
                        <span>›</span>
                    </summary>
                    <div className="phone-settings-panel">
                       
                    </div>
                </details>

                <details className="phone-settings-group" open>
                    <summary className="phone-settings-nav-item">
                        <span>Display</span>
                        <span>›</span>
                    </summary>
                    <div className="phone-settings-panel">
                        <label className="phone-switch-row">
                            <span>Dark Mode</span>
                            <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
                        </label>
                    </div>
                </details>

                <button type="button" className="phone-settings-nav-item static-row">
                    <span>Privacy</span>
                    <span>›</span>
                </button>
            </div>
        </div>
    );
};

const YouTubeApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [search, setSearch] = useState("");
    const [videoUrl, setVideoUrl] = useState("");

    const playVideo = () => {
        const value = search.trim();
        if (!value.length) return;

        if (value.includes("watch?v=")) {
            const id = value.split("watch?v=")[1]?.split("&")[0];
            if (id) {
                setVideoUrl(`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1`);
                return;
            }
        }

        if (value.includes("youtu.be/")) {
            const id = value.split("youtu.be/")[1]?.split("?")[0];
            if (id) {
                setVideoUrl(`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1`);
                return;
            }
        }

        setVideoUrl(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(value)}&autoplay=1&playsinline=1`);
    };

    return (
        <div className="phone-app phone-youtube">
            <PhoneSubHeader
                title="YouTube"
                onBack={onBack}
                rightContent={
                    <button type="button" className="phone-youtube-close" onClick={onBack}>
                        ✕
                    </button>
                }
            />

            <div className="phone-youtube-searchbar">
                <div className="phone-youtube-search-input">
                    <span className="phone-search-icon">⌕</span>
                    <input
                        type="text"
                        value={search}
                        placeholder="Search YouTube videos"
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && playVideo()}
                    />
                </div>
                <button type="button" className="phone-youtube-search-button" onClick={playVideo}>
                    Search
                </button>
            </div>

            <div className="phone-youtube-player-wrap">
                {videoUrl ? (
                    <iframe
                        src={videoUrl}
                        title="Phone YouTube Player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <div className="phone-youtube-placeholder">Search for a YouTube video by name or paste a link.</div>
                )}
            </div>
        </div>
    );
};
