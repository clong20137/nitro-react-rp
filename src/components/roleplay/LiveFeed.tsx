import { FC, ReactNode, useEffect, useRef, useState } from "react";
import "./LiveFeed.scss";

import { SendMessageComposer } from "../../api";
import { EmsCallDecisionComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/EmsCallDecisionComposer";

type FeedMessage = {
    id: number;
    text: string;
    fullText?: string;
    username: string;
    figure: string;
    type?: string;
    persistent?: boolean;
    isPoliceCall?: boolean;
    isEMSCall?: boolean;
    victimId?: number;
    location?: string;
    virtualRoomId?: number;
    virtualRoomName?: string;
    closing?: boolean;
};

let messageId = 0;
const ANIM_MS = 250;

const stripLeadingEmoji = (value: string) =>
{
    if (!value) return "";

    return value
        .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, "")
        .trim();
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const inferSecondaryName = (message: string, primaryName: string) =>
{
    const cleaned = stripLeadingEmoji(message);
    const withoutPrimary = cleaned.replace(new RegExp(`^${ escapeRegExp(primaryName) }\s+`, "i"), "");

    const directPatterns = [
        /\bpardoned\s+([A-Za-z0-9_]+)/i,
        /\barrested\s+([A-Za-z0-9_]+)/i,
        /\bkilled\s+([A-Za-z0-9_]+)/i,
        /\bhit\s+([A-Za-z0-9_]+)/i,
        /\brobbed\s+([A-Za-z0-9_]+)/i,
        /\bfined\s+([A-Za-z0-9_]+)/i,
        /\brevived\s+([A-Za-z0-9_]+)/i,
        /\bhealed\s+([A-Za-z0-9_]+)/i,
        /\bsearched\s+([A-Za-z0-9_]+)/i,
        /\bescorted\s+([A-Za-z0-9_]+)/i,
        /\bjailed\s+([A-Za-z0-9_]+)/i,
        /\breleased\s+([A-Za-z0-9_]+)/i,
        /\bhelped\s+([A-Za-z0-9_]+)/i,
        /\bcharged\s+([A-Za-z0-9_]+)/i
    ];

    for (const pattern of directPatterns)
    {
        const match = withoutPrimary.match(pattern);

        if (match?.[1]) return match[1];
    }

    const words = withoutPrimary.split(/\s+/).filter(Boolean);

    if (words.length >= 2)
    {
        const candidate = words[1];

        if (/^[A-Za-z0-9_]+$/.test(candidate)) return candidate;
    }

    return "";
};

const renderMessageText = (msg: FeedMessage): ReactNode =>
{
    const cleaned = stripLeadingEmoji(msg.text);

    if (msg.isPoliceCall)
    {
        return (
            <>
                <span className="name-primary">{ msg.username }</span>
                <span className="feed-separator"> placed a police call</span>
                { (msg.virtualRoomId || msg.virtualRoomName) ? (
                    <span
                        className="vr-room-pill"
                        title={ `vRoom ${ msg.virtualRoomId ?? "?" }` }>
                        { msg.virtualRoomName ?? `VR ${ msg.virtualRoomId }` }
                    </span>
                ) : null }
            </>
        );
    }

    if (msg.isEMSCall)
    {
        return (
            <>
                <span className="name-primary">{ msg.username }</span>
                <span className="feed-separator"> requested medical assistance</span>
            </>
        );
    }

    const primaryName = msg.username || cleaned.split(/\s+/)[0] || "";
    const secondaryName = inferSecondaryName(cleaned, primaryName);

    let display = cleaned;

    if (primaryName)
    {
        const primaryPattern = new RegExp(`^${ escapeRegExp(primaryName) }\b\s*`, "i");
        display = display.replace(primaryPattern, "");
    }

    if (secondaryName)
    {
        const secondaryPattern = new RegExp(`\b${ escapeRegExp(secondaryName) }\b`, "i");

        if (secondaryPattern.test(display))
        {
            const parts = display.split(secondaryPattern);
            const match = display.match(secondaryPattern)?.[0] ?? secondaryName;

            return (
                <>
                    { primaryName ? <span className="name-primary">{ primaryName }</span> : null }
                    { primaryName ? <span className="feed-separator"> </span> : null }
                    <span>{ parts[0] }</span>
                    <span className="name-secondary">{ match }</span>
                    <span>{ parts.slice(1).join(match) }</span>
                </>
            );
        }
    }

    return (
        <>
            { primaryName ? <span className="name-primary">{ primaryName }</span> : null }
            { primaryName ? <span className="feed-separator"> </span> : null }
            <span>{ display }</span>
        </>
    );
};

export const LiveFeed: FC = () =>
{
    const [messages, setMessages] = useState<FeedMessage[]>([]);
    const [isVisible, setIsVisible] = useState(true);
    const audioMapRef = useRef<Map<number, HTMLAudioElement>>(new Map());

    const playLoop = (id: number, src: string, volume = 0.6) =>
    {
        try
        {
            const audio = new Audio(src);
            audio.loop = false;
            audio.volume = volume;
            audioMapRef.current.set(id, audio);
            audio.play().catch(() => {});
            window.setTimeout(() => stopLoop(id), 60_000);
        }
        catch {}
    };

    const stopLoop = (id: number) =>
    {
        const audio = audioMapRef.current.get(id);

        if (!audio) return;

        try
        {
            audio.pause();
            audio.currentTime = 0;
        }
        catch {}

        audioMapRef.current.delete(id);
    };

    const animateOutThenRemove = (id: number) =>
    {
        setMessages(prev => prev.map(message => (message.id === id ? { ...message, closing: true } : message)));

        window.setTimeout(() =>
        {
            setMessages(prev => prev.filter(message => message.id !== id));
        }, ANIM_MS);
    };

    useEffect(() =>
    {
        const handleEvent = (event: any) =>
        {
            const detail = event?.detail;

            if (!detail?.message) return;

            const isPoliceCall = detail.type === "[911]" || String(detail.message).startsWith("[911]");
            const isEMSCall = detail.type === "ems_call";

            const newMessage: FeedMessage = {
                id: messageId++,
                text: isPoliceCall ? "Police Call" : detail.message,
                fullText: detail.message,
                username: detail.username,
                figure: detail.figure,
                type: detail.type,
                isPoliceCall,
                isEMSCall,
                persistent: detail.persistent ?? (isPoliceCall || isEMSCall),
                victimId: detail.victimId,
                location: detail.location,
                virtualRoomId: detail.virtualRoomId,
                virtualRoomName: detail.virtualRoomName
            };

            setMessages(prev => [...prev, newMessage]);

            if (newMessage.isPoliceCall) playLoop(newMessage.id, "/sounds/police.mp3", 0.6);
            else if (newMessage.isEMSCall) playLoop(newMessage.id, "/sounds/ambulance.mp3", 0.6);
            else if (!newMessage.persistent)
            {
                window.setTimeout(() =>
                {
                    stopLoop(newMessage.id);
                    animateOutThenRemove(newMessage.id);
                }, 5000);
            }
        };

        window.addEventListener("live_feed_event", handleEvent);

        return () => window.removeEventListener("live_feed_event", handleEvent);
    }, []);

    useEffect(() =>
    {
        const stored = localStorage.getItem("liveFeedEnabled");
        setIsVisible(stored === null || JSON.parse(stored) === true);

        const handleToggle = (event: any) => setIsVisible(!!event.detail?.enabled);

        window.addEventListener("toggleLiveFeed", handleToggle);

        return () => window.removeEventListener("toggleLiveFeed", handleToggle);
    }, []);

    useEffect(() =>
    {
        return () =>
        {
            for (const id of audioMapRef.current.keys()) stopLoop(id);
        };
    }, []);

    if (!isVisible) return null;

    const dismiss = (id: number) =>
    {
        stopLoop(id);
        animateOutThenRemove(id);
    };

    const acceptEMS = (message: FeedMessage) =>
    {
        SendMessageComposer(new EmsCallDecisionComposer(message.username, true));
        dismiss(message.id);
    };

    const declineEMS = (message: FeedMessage) =>
    {
        SendMessageComposer(new EmsCallDecisionComposer(message.username, false));
        dismiss(message.id);
    };

    return (
        <div className="live-feed-container">
            { messages.map(message => (
                <div
                    key={ message.id }
                    className={[
                        "live-feed-message",
                        message.isPoliceCall ? "police-call" : "",
                        message.isEMSCall ? "ems-call" : "",
                        message.closing ? "closing" : "enter"
                    ].join(" ").trim()}>
                    <div className="message-text">
                        { renderMessageText(message) }
                    </div>

                    { message.isPoliceCall && (
                        <div className="call-buttons">
                            <button
                                className="habbo-action-button green"
                                onClick={ () =>
                                {
                                    window.dispatchEvent(
                                        new CustomEvent("open_police_call", {
                                            detail: {
                                                username: message.username,
                                                figure: message.figure,
                                                message: message.fullText ?? message.text,
                                                virtualRoomId: message.virtualRoomId ?? 0,
                                                virtualRoomName: message.virtualRoomName ?? ""
                                            }
                                        })
                                    );
                                    dismiss(message.id);
                                } }>
                                Open Call
                            </button>
                            <button className="habbo-action-button red" onClick={ () => dismiss(message.id) }>
                                Dismiss
                            </button>
                        </div>
                    ) }

                    { message.isEMSCall && (
                        <div className="call-buttons">
                            <button className="habbo-action-button green" onClick={ () => acceptEMS(message) }>
                                Accept
                            </button>
                            <button className="habbo-action-button red" onClick={ () => declineEMS(message) }>
                                Decline
                            </button>
                        </div>
                    ) }
                </div>
            )) }
        </div>
    );
};

export default LiveFeed;
