import React, { useEffect, useRef, useState } from "react";
import "./PhoneView.scss";

import { MessengerFriend } from "../../api";
import { FriendsListGroupView } from "../friends/views/friends-list/friends-list-group/FriendsListGroupView";

import { useMessenger, useFriends } from "../../hooks";
import { GetSessionDataManager } from "../../api";

// ✅ Re-use Nitro’s thread renderer so messages show correctly
import { FriendsMessengerThreadView } from "../friends/views/messenger/messenger-thread/FriendsMessengerThreadView";
// ✅ Use real avatar heads
import { LayoutAvatarImageView } from "../../common";

export type PhoneApp = "home" | "contacts" | "messages" | "settings";

interface PhoneViewProps {
    onClose: () => void;
}

export const PhoneView: React.FC<PhoneViewProps> = ({ onClose }) => {
    const [activeApp, setActiveApp] = useState<PhoneApp>("contacts");

    // REAL FRIEND DATA FROM STORE
    const { friends = [] } = useFriends(); // MessengerFriend[]

    // --- DRAG STATE (fixed so it doesn't jump) ---
    const phoneRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState({ x: 0, y: 0 });

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

    // Called by Contacts when user taps a friend
    const handleMessageFriendFromContacts = () => {
        setActiveApp("messages");
    };

    return (
        <div className="phone-root">
            <div
                ref={phoneRef}
                className="phone-frame phone-enter"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                }}
            >
                <div className="phone-header" onMouseDown={onMouseDownHeader}>
                    <span className="phone-time">17:39</span>
                    <span className="phone-notch" />
                    <button className="phone-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* HOME: we’ll start on Contacts for now */}
                {activeApp === "home" && (
                    <div className="phone-home">
                        <div className="phone-app-grid">
                            <PhoneAppIcon
                                label="Contacts"
                                icon="👥"
                                onClick={() => setActiveApp("contacts")}
                                badge={friends.length}
                            />
                            <PhoneAppIcon
                                label="Messages"
                                icon="💬"
                                onClick={() => setActiveApp("messages")}
                            />
                            <PhoneAppIcon
                                label="Settings"
                                icon="⚙️"
                                onClick={() => setActiveApp("settings")}
                            />
                        </div>
                    </div>
                )}

                {activeApp === "contacts" && (
                    <ContactsApp
                        friends={friends}
                        onBack={() => setActiveApp("home")}
                        onMessageFriend={handleMessageFriendFromContacts}
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

/* =========================================================================
PHONE APP ICONS
========================================================================= */

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
MESSAGES APP – INBOX + THREAD VIEW (uses FriendsMessengerThreadView)
========================================================================= */

interface MessagesAppProps {
    onBack: () => void;
}

const MessagesApp: React.FC<MessagesAppProps> = ({ onBack }) => {
    const {
        visibleThreads = [],
        activeThread = null,
        sendMessage = null,
        setActiveThreadId = null,
        closeThread = null,
    } = useMessenger();

    const [view, setView] = useState<"inbox" | "thread">("inbox");
    const [messageText, setMessageText] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const messagesBoxRef = useRef<HTMLDivElement | null>(null);

    const filteredThreads = visibleThreads.filter((t: any) =>
        t.participant?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // When a thread becomes active (e.g. from Contacts), jump into thread view
    useEffect(() => {
        if (activeThread) setView("thread");
    }, [activeThread]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (!activeThread || !messagesBoxRef.current) return;
        messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
    }, [activeThread]);

    const hasMessages =
        !!(activeThread as any)?.messages &&
        (activeThread as any).messages.length > 0;

    const openThread = (threadId: number) => {
        setActiveThreadId && setActiveThreadId(threadId);
        setView("thread");
    };

    const backToInbox = () => {
        setView("inbox");
        // keep activeThread so it stays selected in list
    };

    const handleSend = () => {
        if (!activeThread || !sendMessage || !messageText.trim()) return;

        sendMessage(
            activeThread,
            GetSessionDataManager().userId,
            messageText.trim()
        );

        setMessageText("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSend();
    };

    if (view === "inbox") {
        return (
            <div className="phone-app phone-messages phone-messages-inbox">
                <div className="phone-subheader">
                    <button onClick={onBack} className="phone-back-btn">
                        ‹ Home
                    </button>
                    <span className="phone-subtitle">Messages</span>
                </div>

                <div className="phone-searchbar">
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="phone-list phone-inbox-list">
                    {filteredThreads.length === 0 && (
                        <div className="phone-empty centered">
                            No conversations yet.
                        </div>
                    )}

                    {filteredThreads.map((thread: any) => (
                        <div
                            key={thread.threadId}
                            className={
                                "phone-inbox-row" +
                                (activeThread &&
                                activeThread.threadId === thread.threadId
                                    ? " selected"
                                    : "")
                            }
                            onClick={() => openThread(thread.threadId)}
                        >
                            <div className="phone-inbox-avatar">
                                {thread.participant?.figure && (
                                    <LayoutAvatarImageView
                                        figure={thread.participant.figure}
                                        headOnly={true}
                                        direction={3}
                                    />
                                )}
                            </div>
                            <div className="phone-inbox-main">
                                <div className="phone-inbox-name">
                                    {thread.participant?.name}
                                </div>
                                <div className="phone-inbox-preview">
                                    New conversation
                                </div>
                            </div>
                            {closeThread && (
                                <button
                                    className="phone-inbox-delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closeThread(thread.threadId);
                                    }}
                                >
                                    🗑
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // THREAD VIEW
    return (
        <div className="phone-app phone-messages phone-messages-thread">
            <div className="phone-subheader">
                <button onClick={backToInbox} className="phone-back-btn">
                    ‹ Messages
                </button>
                <span className="phone-subtitle">
                    {activeThread?.participant?.name || "Chat"}
                </span>
            </div>

            {!activeThread ? (
                <div className="phone-empty centered">
                    Select a conversation
                </div>
            ) : (
                <>
                    <div className="phone-chat-body" ref={messagesBoxRef}>
                        {hasMessages ? (
                            <FriendsMessengerThreadView thread={activeThread} />
                        ) : (
                            <div className="phone-chat-empty">
                                <div className="phone-chat-empty-bubble" />
                                <div className="phone-chat-empty-title">
                                    No messages yet
                                </div>
                                <div className="phone-chat-empty-sub">
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
                </>
            )}
        </div>
    );
};

/* =========================================================================
CONTACTS APP – ONLINE/OFFLINE + REAL AVATARS
========================================================================= */

interface ContactsAppProps {
    friends: MessengerFriend[];
    onBack: () => void;
    onMessageFriend: (friendId: number) => void;
}

const ContactsApp: React.FC<ContactsAppProps> = ({
    friends,
    onBack,
    onMessageFriend,
}) => {
    const [searchTerm, setSearchTerm] = useState("");

    const { getMessageThread = null, setActiveThreadId = null } =
        useMessenger();

    const lower = searchTerm.toLowerCase();

    const online = friends
        .filter((f: any) => f.online)
        .filter((f: any) => f.name.toLowerCase().includes(lower));
    const offline = friends
        .filter((f: any) => !f.online)
        .filter((f: any) => f.name.toLowerCase().includes(lower));

    const selectFriend = (id: number) => {
        // open / create thread for this friend
        if (getMessageThread && setActiveThreadId) {
            const thread = getMessageThread(id);
            if (thread) setActiveThreadId(thread.threadId);
        }

        onMessageFriend(id);
    };

    const renderFriendRow = (friend: any) => (
        <div
            key={friend.id}
            className="phone-friend-row"
            onClick={() => selectFriend(friend.id)}
        >
            <div className="phone-friend-avatar">
                {friend.figure && (
                    <LayoutAvatarImageView
                        figure={friend.figure}
                        headOnly={true}
                        direction={3}
                    />
                )}
                <span
                    className={
                        "status-dot " + (friend.online ? "online" : "offline")
                    }
                />
            </div>
            <div className="phone-friend-main">
                <div className="phone-friend-name">{friend.name}</div>
                <div className="phone-friend-status">
                    {friend.online ? "Online" : "Offline"}
                </div>
            </div>
        </div>
    );

    return (
        <div className="phone-app phone-friends">
            <div className="phone-subheader">
                <button onClick={onBack} className="phone-back-btn">
                    ‹ Home
                </button>
                <span className="phone-subtitle">Contacts</span>
            </div>

            <div className="phone-searchbar">
                <input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="phone-list">
                {online.length > 0 && (
                    <>
                        <div className="phone-section-header">
                            <span>Online</span>
                            <span>{online.length}</span>
                        </div>
                        {online.map(renderFriendRow)}
                    </>
                )}

                {offline.length > 0 && (
                    <>
                        <div className="phone-section-header">
                            <span>Offline</span>
                            <span>{offline.length}</span>
                        </div>
                        {offline.map(renderFriendRow)}
                    </>
                )}

                {!online.length && !offline.length && (
                    <div className="phone-empty centered">
                        No friends found.
                    </div>
                )}
            </div>
        </div>
    );
};

/* =========================================================================
SETTINGS
========================================================================= */

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
