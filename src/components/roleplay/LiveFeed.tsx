import { FC, useEffect, useRef, useState } from "react";
import "./LiveFeed.scss";

import { SendMessageComposer } from "../../api";
import { EmsCallDecisionComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EmsCallDecisionComposer";

type FeedMessage = {
    id: number;

    // What we DISPLAY in the feed:
    text: string;

    // Full original message for Police view:
    fullText?: string;

    username: string;
    figure: string;
    type?: string;
    persistent?: boolean;

    isPoliceCall?: boolean;
    isEMSCall?: boolean;

    victimId?: number;
    location?: string;

    // Virtual room metadata (provided by PoliceCallEvent bridge):
    virtualRoomId?: number;
    virtualRoomName?: string;

    closing?: boolean;
};

let messageId = 0;
const ANIM_MS = 250;

export const LiveFeed: FC = () => {
    const [messages, setMessages] = useState<FeedMessage[]>([]);
    const [isVisible, setIsVisible] = useState(true);
    const audioMapRef = useRef<Map<number, HTMLAudioElement>>(new Map());

    const playLoop = (id: number, src: string, volume = 0.6) => {
        try {
            const audio = new Audio(src);
            audio.loop = false;
            audio.volume = volume;
            audioMapRef.current.set(id, audio);
            audio.play().catch(() => {});
            window.setTimeout(() => stopLoop(id), 60_000);
        } catch {}
    };

    const stopLoop = (id: number) => {
        const audio = audioMapRef.current.get(id);
        if (audio) {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch {}
            audioMapRef.current.delete(id);
        }
    };

    const animateOutThenRemove = (id: number) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, closing: true } : m))
        );
        window.setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== id));
        }, ANIM_MS);
    };

    // Handle both: generic live feed AND dedicated police call bridge
    useEffect(() => {
        const handleEvent = (event: any) => {
            const d = event?.detail;
            if (!d?.message) return;

            const isPoliceCall =
                d.type === "[911]" || String(d.message).startsWith("[911]");
            const isEMSCall = d.type === "ems_call";

            const newMsg: FeedMessage = {
                id: messageId++,

                // show label for police calls
                text: isPoliceCall ? "Police Call" : d.message,

                // ✅ keep raw message for the modal
                fullText: d.message,

                username: d.username,
                figure: d.figure,
                type: d.type,
                isPoliceCall,
                isEMSCall,
                persistent: d.persistent ?? (isPoliceCall || isEMSCall),

                victimId: d.victimId,
                location: d.location,

                virtualRoomId: d.virtualRoomId,
                virtualRoomName: d.virtualRoomName,
            };

            setMessages((prev) => [...prev, newMsg]);

            if (newMsg.isPoliceCall)
                playLoop(newMsg.id, "/sounds/police.mp3", 0.6);
            else if (newMsg.isEMSCall)
                playLoop(newMsg.id, "/sounds/ambulance.mp3", 0.6);
            else if (!newMsg.persistent) {
                window.setTimeout(() => {
                    stopLoop(newMsg.id);
                    animateOutThenRemove(newMsg.id);
                }, 5000);
            }
        };

        // ✅ only one event source
        window.addEventListener("live_feed_event", handleEvent);

        return () => {
            window.removeEventListener("live_feed_event", handleEvent);
        };
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem("liveFeedEnabled");
        setIsVisible(stored === null || JSON.parse(stored) === true);

        const handleToggle = (e: any) => setIsVisible(!!e.detail?.enabled);
        window.addEventListener("toggleLiveFeed", handleToggle);
        return () => window.removeEventListener("toggleLiveFeed", handleToggle);
    }, []);

    useEffect(() => {
        return () => {
            for (const id of audioMapRef.current.keys()) stopLoop(id);
        };
    }, []);

    if (!isVisible) return null;

    const dismiss = (id: number) => {
        stopLoop(id);
        animateOutThenRemove(id);
    };

    const acceptEMS = (msg: FeedMessage) => {
        SendMessageComposer(new EmsCallDecisionComposer(msg.username, true));
        dismiss(msg.id);
    };

    const declineEMS = (msg: FeedMessage) => {
        SendMessageComposer(new EmsCallDecisionComposer(msg.username, false));
        dismiss(msg.id);
    };

    return (
        <div className="live-feed-container">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={[
                        "live-feed-message",
                        msg.isPoliceCall ? "police-call" : "",
                        msg.isEMSCall ? "ems-call" : "",
                        msg.closing ? "closing" : "enter",
                    ]
                        .join(" ")
                        .trim()}
                >
                    <img
                        className="avatar-head"
                        src={`https://imager.olympusrp.pw/?figure=${msg.figure}&direction=2&headonly=1&size=m`}
                        alt={`${msg.username}'s avatar`}
                    />

                    <span className="message-text">
                        {msg.text}
                        {msg.isPoliceCall &&
                        (msg.virtualRoomId || msg.virtualRoomName) ? (
                            <span
                                className="vr-room-pill"
                                title={`vRoom ${msg.virtualRoomId ?? "?"}`}
                            >
                                {msg.virtualRoomName ??
                                    `VR ${msg.virtualRoomId}`}
                            </span>
                        ) : null}
                    </span>

                    {msg.isPoliceCall && (
                        <div className="call-buttons">
                            <button
                                className="habbo-action-button green"
                                onClick={() => {
                                    window.dispatchEvent(
                                        new CustomEvent("open_police_call", {
                                            detail: {
                                                username: msg.username,
                                                figure: msg.figure,
                                                message:
                                                    msg.fullText ?? msg.text,
                                                virtualRoomId:
                                                    msg.virtualRoomId ?? 0,
                                                virtualRoomName:
                                                    msg.virtualRoomName ?? "",
                                            },
                                        })
                                    );
                                    dismiss(msg.id);
                                }}
                            >
                                Open Call
                            </button>
                            <button
                                className="habbo-action-button red"
                                onClick={() => dismiss(msg.id)}
                            >
                                Decline
                            </button>
                        </div>
                    )}

                    {msg.isEMSCall && (
                        <div className="call-buttons">
                            <button
                                className="habbo-action-button green"
                                onClick={() => acceptEMS(msg)}
                            >
                                Accept
                            </button>
                            <button
                                className="habbo-action-button red"
                                onClick={() => declineEMS(msg)}
                            >
                                Decline
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default LiveFeed;
