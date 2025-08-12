import { FC, useEffect, useRef, useState } from "react";
import "./LiveFeed.scss";

interface FeedMessage {
    id: number;
    text: string;
    username: string;
    figure: string;
    isPoliceCall?: boolean;
    persistent?: boolean;
}

let messageId = 0;

export const LiveFeed: FC = () => {
    const [messages, setMessages] = useState<FeedMessage[]>([]);
    const [isVisible, setIsVisible] = useState(true);

    // Keep an audio element per message id
    const audioMapRef = useRef<Map<number, HTMLAudioElement>>(new Map());

    const playPoliceLoop = (id: number) => {
        try {
            const audio = new Audio("/sounds/police.mp3");
            audio.loop = false;
            audio.volume = 0.6; // tweak volume if you want
            audioMapRef.current.set(id, audio);
            audio.play().catch(() => {
                // Browser blocked autoplay; it'll start once the user interacts.
                // We still keep the audio instance to .play() later if needed.
            });

            // Safety auto-stop after 60s in case nobody clicks anything
            window.setTimeout(() => stopPoliceLoop(id), 60_000);
        } catch {
            /* ignore */
        }
    };

    const stopPoliceLoop = (id: number) => {
        const audio = audioMapRef.current.get(id);
        if (audio) {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch {
                /* noop */
            }
            audioMapRef.current.delete(id);
        }
    };

    useEffect(() => {
        const handleEvent = (event: any) => {
            if (!event.detail?.message) return;

            const isPoliceCall =
                event.detail.type === "[911]" ||
                String(event.detail.message).startsWith("[911]");

            const newMsg: FeedMessage = {
                id: messageId++,
                text: event.detail.message,
                username: event.detail.username,
                figure: event.detail.figure,
                isPoliceCall,
                // 911s persist by default
                persistent: event.detail.persistent ?? isPoliceCall,
            };

            setMessages((prev) => [...prev, newMsg]);

            if (newMsg.isPoliceCall) {
                // loop the siren until user acts
                playPoliceLoop(newMsg.id);
            } else if (!newMsg.persistent) {
                // auto-dismiss non-persistent regular feed items
                window.setTimeout(() => {
                    setMessages((prev) =>
                        prev.filter((m) => m.id !== newMsg.id)
                    );
                }, 5000);
            }
        };

        window.addEventListener("live_feed_event", handleEvent);
        return () => window.removeEventListener("live_feed_event", handleEvent);
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem("liveFeedEnabled");
        setIsVisible(stored === null || JSON.parse(stored) === true);

        const handleToggle = (e: any) => setIsVisible(!!e.detail?.enabled);

        window.addEventListener("toggleLiveFeed", handleToggle);
        return () => window.removeEventListener("toggleLiveFeed", handleToggle);
    }, []);

    // Clean up all sounds if the component ever unmounts
    useEffect(() => {
        return () => {
            for (const id of audioMapRef.current.keys()) stopPoliceLoop(id);
        };
    }, []);

    if (!isVisible) return null;

    const handleDismiss = (id: number) => {
        stopPoliceLoop(id);
        setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    return (
        <div className="live-feed-container">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`live-feed-message ${
                        msg.isPoliceCall ? "police-call" : ""
                    }`}
                >
                    <img
                        className="avatar-head"
                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${msg.figure}&direction=2&headonly=1&size=m`}
                        alt={`${msg.username}'s avatar`}
                    />
                    <span>{msg.text}</span>

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
                                                message: msg.text,
                                                roomName: "Oasis Hospital",
                                                responder: "Huss",
                                            },
                                        })
                                    );
                                    handleDismiss(msg.id);
                                }}
                            >
                                Open Call
                            </button>
                            <button
                                className="habbo-action-button red"
                                onClick={() => handleDismiss(msg.id)}
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
