import React, { useEffect, useRef, useState } from "react";
import "./PhoneView.scss";

import { MessengerFriend } from "../../api";
import { FriendsListGroupView } from "../friends/views/friends-list/friends-list-group/FriendsListGroupView";
import { FriendsMessengerThreadView } from "../friends/views/messenger/messenger-thread/FriendsMessengerThreadView";

import { useMessenger, useFriends } from "../../hooks";
import { GetSessionDataManager } from "../../api";

export type PhoneApp = "home" | "friends" | "messages" | "settings";

interface PhoneViewProps {
    onClose: () => void;
}

// (kept in case you want them elsewhere)
export interface FriendEntry {
    id: number;
    username: string;
    figure?: string;
    online: boolean;
}

export interface ConversationEntry {
    id: number;
    friendId: number;
    friendName: string;
    lastMessage: string;
    unread: boolean;
}

export const PhoneView: React.FC<PhoneViewProps> = ({ onClose }) => {
    const [activeApp, setActiveApp] = useState<PhoneApp>("home");

    

    // REAL FRIEND DATA FROM STORE
    const { friends = [] } = useFriends(); // MessengerFriend[]

    // --- DRAG STATE (using left/top to avoid teleporting) ---
    const phoneRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState({ x: 50, y: 80 }); // starting pos (px)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging) return;
            setPosition((prev) => ({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            }));
        };

        const handleMouseUp = () => setDragging(false);

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [dragging, dragOffset]);

    const onMouseDownHeader = (e: React.MouseEvent) => {
        if (!phoneRef.current) return;
        const rect = phoneRef.current.getBoundingClientRect();
        setDragging(true);
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    

    // Called by FriendsApp when user taps a friend
    const handleMessageFriendFromFriendsApp = (friendId: number) => {
        setActiveApp("messages");
    };

    return (
        <div className="phone-root">
            <div
                ref={phoneRef}
                className="phone-frame phone-enter"
                style={{
                    left: position.x,
                    top: position.y,
                    position: "fixed",
                }}
            >
                <div className="phone-header" onMouseDown={onMouseDownHeader}>
                    <span className="phone-time">17:39</span>

                    {/* center notch */}
                    <span className="phone-notch" />

                    {/* close button to the right of the notch */}
                    <button className="phone-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {activeApp === "home" && (
                    <div className="phone-home">
                        <div className="phone-app-grid">
                            <PhoneAppIcon
                                label="Settings"
                                icon="⚙️"
                                onClick={() => setActiveApp("settings")}
                            />
                            <PhoneAppIcon
                                label="Contacts"
                                icon="👥"
                                onClick={() => setActiveApp("friends")}
                                badge={friends.length}
                            />
                            <PhoneAppIcon
                                label="Messages"
                                icon="💬"
                                onClick={() => setActiveApp("messages")}
                            />
                            <PhoneAppIcon
                                label="Achievements"
                                icon="🏆"
                                onClick={() => {}}
                            />
                            <PhoneAppIcon
                                label="YouTube"
                                icon="▶️"
                                onClick={() => {}}
                            />
                        </div>
                    </div>
                )}

                {activeApp === "friends" && (
                    <FriendsApp
                        friends={friends}
                        onBack={() => setActiveApp("home")}
                        onMessageFriend={handleMessageFriendFromFriendsApp}
                    />
                )}

                {activeApp === "messages" && (
                    <MessagesApp onBack={() => setActiveApp("home")} />
                )}

                {activeApp === "settings" && (
                    <SettingsApp onBack={() => setActiveApp("home")} />
                )}
            </div>
        </div>
    );
};

interface PhoneAppIconProps {
    label: string;
    icon: string;
    badge?: number;
    onClick: () => void;
}

const PhoneAppIcon: React.FC<PhoneAppIconProps> = ({
    label,
    icon,
    badge,
    onClick,
}) => (
    <button className="phone-app-icon" onClick={onClick}>
        <div className="phone-app-icon-inner">
            <span className="phone-app-icon-emoji">{icon}</span>
            {badge !== undefined && badge > 0 && (
                <span className="phone-app-icon-badge">{badge}</span>
            )}
        </div>
        <span className="phone-app-icon-label">{label}</span>
    </button>
);

/* =========================================================================
MESSAGES APP – list + chat views (clean UI, using MessengerThread.groups)
========================================================================= */

interface MessagesAppProps {
    onBack: () => void; // back to Phone home
}

const MessagesApp: React.FC<MessagesAppProps> = ({ onBack }) => {
    const {
        visibleThreads = [],
        activeThread = null,
        sendMessage = null,
        setActiveThreadId = null,
        closeThread = null,
    } = useMessenger();

    const [mode, setMode] = useState<"list" | "chat">("list");
    const [messageText, setMessageText] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const messagesBoxRef = useRef<HTMLDivElement | null>(null);

    const sessionUserId = GetSessionDataManager().userId;

    // ---- Helpers ---------------------------------------------------------

    const openThread = (threadId: number) => {
        if (setActiveThreadId) setActiveThreadId(threadId);
        setMode("chat");
    };

    const backToList = () => {
        setMode("list");
    };

    const handleSend = () => {
        if (!activeThread || !sendMessage || !messageText.trim()) return;

        sendMessage(activeThread, sessionUserId, messageText.trim());
        setMessageText("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSend();
    };

    // preview text for list rows – uses groups/chats
    const getLastMessagePreview = (thread: any): string => {
        const groups = (thread?.groups || []) as any[];

        if (!groups.length) return "New conversation";

        const lastGroup = groups[groups.length - 1];
        const chats = (lastGroup?.chats || []) as any[];

        if (!chats.length) return "New conversation";

        const lastChat = chats[chats.length - 1];
        return lastChat?.message || "New conversation";
    };

    // search on participant name
    const filteredThreads = visibleThreads.filter((thread: any) =>
        thread?.participant?.name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
    );

    // does this thread have any chats?
    const hasMessages =
        !!activeThread &&
        Array.isArray((activeThread as any).groups) &&
        (activeThread as any).groups.some(
            (g: any) => Array.isArray(g.chats) && g.chats.length > 0
        );

    // scroll chat to bottom when opening a thread / switching to chat mode
    useEffect(() => {
        if (mode !== "chat" || !messagesBoxRef.current) return;
        messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
    }, [mode, activeThread, (activeThread as any)?.groups?.length]);

    // ---- Render ----------------------------------------------------------

    return (
        <div className="phone-app phone-messages">
            {/* HEADER */}
            <div className="phone-subheader">
                {mode === "list" && (
                    <>
                        <button onClick={onBack} className="phone-back-btn">
                            ‹ Home
                        </button>
                        <span className="phone-subtitle">Messages</span>
                    </>
                )}

                {mode === "chat" && activeThread && (
                    <>
                        <button onClick={backToList} className="phone-back-btn">
                            ‹ Messages
                        </button>
                        <div className="phone-chat-title">
                            <div className="phone-chat-avatar" />
                            <span className="phone-subtitle">
                                {activeThread.participant?.name}
                            </span>
                        </div>
                    </>
                )}

                <span style={{ flex: 1 }} />
            </div>

            {/* SEARCH BAR (both modes) */}
            <div className="phone-searchbar">
                <input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                />
            </div>

            {/* LIST MODE ==================================================== */}
            {mode === "list" && (
                <div className="phone-messages-list-view">
                    <div className="phone-messages-list">
                        {filteredThreads.map((thread: any) => (
                            <div
                                key={thread.threadId}
                                className="phone-convo-row"
                                onClick={() => openThread(thread.threadId)}
                            >
                                <div className="phone-convo-avatar" />
                                <div className="phone-convo-main">
                                    <div className="phone-convo-name">
                                        {thread.participant?.name}
                                    </div>
                                    <div className="phone-convo-last">
                                        {getLastMessagePreview(thread)}
                                    </div>
                                </div>

                                {closeThread && (
                                    <button
                                        className="phone-convo-delete"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeThread(thread.threadId);
                                        }}
                                        title="Delete conversation"
                                    >
                                        🗑
                                    </button>
                                )}
                            </div>
                        ))}

                        {!filteredThreads.length && (
                            <div className="phone-empty centered">
                                No conversations yet.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CHAT MODE ==================================================== */}
            {mode === "chat" && activeThread && (
                <div className="phone-messages-chat-view">
                    <div className="phone-chat-body" ref={messagesBoxRef}>
                        {hasMessages ? (
                            // ✅ use the same renderer as the old UI
                            <FriendsMessengerThreadView
                                thread={activeThread as any}
                            />
                        ) : (
                            <div className="phone-chat-empty">
                                <div className="phone-chat-empty-icon" />
                                <div className="phone-chat-empty-title">
                                    No messages yet
                                </div>
                                <div className="phone-chat-empty-subtitle">
                                    Start a conversation with{" "}
                                    {activeThread.participant?.name}!
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="phone-chat-input">
                        <input
                            type="text"
                            placeholder="Click here to message…"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button onClick={handleSend}>Send</button>
                    </div>
                </div>
            )}

            {/* safety net */}
            {mode === "chat" && !activeThread && (
                <div className="phone-empty centered">
                    Select a conversation from the list.
                </div>
            )}
        </div>
    );
};

/* =========================================================================
FRIENDS (CONTACTS) APP – uses real MessengerFriend[]
======================================================================== */

interface FriendsAppProps {
    friends: MessengerFriend[];
    onBack: () => void;
    onMessageFriend: (friendId: number) => void;
}

const FriendsApp: React.FC<FriendsAppProps> = ({
    friends,
    onBack,
    onMessageFriend,
}) => {
    const [tab, setTab] = useState<"list" | "search">("list");
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<MessengerFriend[]>([]);
    const [selectedFriendsIds, setSelectedFriendsIds] = useState<number[]>([]);

    const { getMessageThread = null, setActiveThreadId = null } =
        useMessenger();

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        const lower = searchTerm.toLowerCase();
        const matches = friends.filter((f) =>
            f.name.toLowerCase().includes(lower)
        );

        setSearchResults(matches);
    };

    const selectFriend = (id: number) => {
        setSelectedFriendsIds([id]);

        // open / create thread for this friend in the messenger store
        if (getMessageThread && setActiveThreadId) {
            const thread = getMessageThread(id);
            if (thread) setActiveThreadId(thread.threadId);
        }

        // switch Phone to Messages app
        onMessageFriend(id);
    };

    const listToShow = tab === "list" ? friends : searchResults;

    return (
        <div className="phone-app phone-friends">
            <div className="phone-subheader">
                <button onClick={onBack} className="phone-back-btn">
                    ‹ Home
                </button>
                <span className="phone-subtitle">Contacts</span>
            </div>

            <div className="phone-tabs">
                <button
                    className={tab === "list" ? "active" : ""}
                    onClick={() => setTab("list")}
                >
                    All
                </button>
                <button
                    className={tab === "search" ? "active" : ""}
                    onClick={() => setTab("search")}
                >
                    Search
                </button>
            </div>

            <div className="phone-searchbar">
                <input
                    type="text"
                    placeholder={
                        tab === "search"
                            ? "Search by username…"
                            : "Filter friends…"
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) =>
                        e.key === "Enter" ? handleSearch() : null
                    }
                />
                <button onClick={handleSearch}>Go</button>
            </div>

            <div className="phone-list">
                {!listToShow.length && (
                    <div className="phone-empty">
                        {tab === "list" ? "No friends yet." : "No users found."}
                    </div>
                )}

                {!!listToShow.length && (
                    <FriendsListGroupView
                        list={listToShow}
                        selectedFriendsIds={selectedFriendsIds}
                        selectFriend={selectFriend}
                    />
                )}
            </div>
        </div>
    );
};

/* =========================================================================
SETTINGS
======================================================================== */

const SettingsApp: React.FC<{ onBack: () => void }> = ({ onBack }) => (
    <div className="phone-app phone-settings">
        <div className="phone-subheader">
            <button onClick={onBack} className="phone-back-btn">
                ‹ Home
            </button>
            <span className="phone-subtitle">Settings</span>
        </div>
        <div className="phone-list">
            <div className="phone-setting-row">
                <span>Do Not Disturb</span>
                <span className="phone-toggle placeholder" />
            </div>
            <div className="phone-setting-row">
                <span>Show Online Status</span>
                <span className="phone-toggle placeholder" />
            </div>
        </div>
    </div>
);
