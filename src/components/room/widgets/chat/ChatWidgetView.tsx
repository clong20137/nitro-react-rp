import { IWorkerEventTracker, RoomChatSettings } from "@nitrots/nitro-renderer";
import { NameIconEquippedEvent } from "@nitrots/nitro-renderer/src/nitro/communication/messages/incoming/roleplay/NameIconEquippedEvent";
import { FC, useEffect, useRef, useState } from "react";
import {
    AddWorkerEventTracker,
    ChatBubbleMessage,
    DoChatsOverlap,
    GetConfiguration,
    RemoveWorkerEventTracker,
    SendWorkerEvent,
} from "../../../../api";
import { useChatWidget, useMessageEvent } from "../../../../hooks";
import { ChatWidgetMessageView } from "./ChatWidgetMessageView";

const nameIconByUserId = new Map<number, string>();
(window as any).__nameIconByUserId = nameIconByUserId;

function upsertUserIcon(userId: number, iconKey?: string, iconId?: number) {
    const key =
        (iconKey && String(iconKey)) ||
        (typeof iconId === "number" && iconId > 0 ? String(iconId) : null);

    if (!userId) return;

    if (!key) {
        nameIconByUserId.delete(userId);
        return;
    }

    nameIconByUserId.set(userId, key);
}

function resolveNameIconKeyFor(userId: number): string | null {
    const k = nameIconByUserId.get(userId);
    return k ? String(k) : null;
}

let TIMER_TRACKER = 0;

export const ChatWidgetView: FC<{}> = () => {
    const [timerId] = useState(TIMER_TRACKER++);
    const {
        chatMessages = [],
        setChatMessages = null,
        chatSettings = null,
        getScrollSpeed = 6000,
        removeHiddenChats = null,
        moveAllChatsUp = null,
    } = useChatWidget();

    const elementRef = useRef<HTMLDivElement>();

    useMessageEvent<NameIconEquippedEvent>(NameIconEquippedEvent, event => {
        const parser = event.getParser();

        if (!parser) return;

        upsertUserIcon(parser.userId, parser.iconKey, parser.iconId);

        window.dispatchEvent(
            new CustomEvent("name_icon_equipped_for_user", {
                detail: {
                    userId: parser.userId,
                    iconId: parser.iconId,
                    iconKey: parser.iconKey,
                },
            })
        );

        setChatMessages(prev => {
            if (!prev?.length) return prev;

            let changed = false;

            for (const msg of prev) {
                if (!msg || msg.senderId !== parser.userId) continue;

                (msg as any).nameIconKey =
                    parser.iconKey ||
                    (parser.iconId > 0 ? String(parser.iconId) : null);
                (msg as any).showNameIcon = parser.iconId > 0;
                changed = true;
            }

            return changed ? [...prev] : prev;
        });
    });

    useEffect(() => {
        const onSingle = (e: Event) => {
            const { detail } = e as CustomEvent<{
                userId: number;
                iconKey?: string;
                iconId?: number;
            }>;

            if (!detail) return;

            upsertUserIcon(detail.userId, detail.iconKey, detail.iconId);
        };

        const onBulk = (e: Event) => {
            const { detail } = e as CustomEvent<{
                users: Array<{
                    userId: number;
                    iconKey?: string;
                    iconId?: number;
                }>;
            }>;

            if (!detail?.users) return;

            for (const u of detail.users) {
                upsertUserIcon(u.userId, u.iconKey, u.iconId);
            }
        };

        window.addEventListener(
            "name_icon_equipped_for_user",
            onSingle as EventListener
        );
        window.addEventListener(
            "name_icon_equipped_bulk",
            onBulk as EventListener
        );

        return () => {
            window.removeEventListener(
                "name_icon_equipped_for_user",
                onSingle as EventListener
            );
            window.removeEventListener(
                "name_icon_equipped_bulk",
                onBulk as EventListener
            );
        };
    }, []);

    useEffect(() => {
        setChatMessages(prev => {
            if (!prev) return prev;

            let changed = false;

            for (const msg of prev) {
                if (!msg || !msg.senderId || (msg as any).nameIconKey !== undefined)
                    continue;

                const resolved = resolveNameIconKeyFor(msg.senderId);

                (msg as any).nameIconKey = resolved;
                (msg as any).showNameIcon = !!resolved;
                changed = true;
            }

            return changed ? [...prev] : prev;
        });
    }, [setChatMessages, chatMessages?.length]);

    const checkOverlappingChats = (
        chat: ChatBubbleMessage,
        moved: number,
        temp: ChatBubbleMessage[]
    ) => {
        const total = chatMessages.length;
        if (!total) return;

        for (let i = total - 1; i >= 0; i--) {
            const collides = chatMessages[i];
            if (
                !collides ||
                chat === collides ||
                temp.indexOf(collides) >= 0 ||
                collides.top + collides.height - moved > chat.top + chat.height
            )
                continue;

            chat.skipMovement = true;

            if (DoChatsOverlap(chat, collides, -moved, 0)) {
                const amount = Math.abs(
                    collides.top + collides.height - chat.top
                );
                temp.push(collides);
                collides.top -= amount;
                collides.skipMovement = true;
                checkOverlappingChats(collides, amount, temp);
            }
        }
    };

    const makeRoom = (chat: ChatBubbleMessage) => {
        if (chatSettings.mode === RoomChatSettings.CHAT_MODE_FREE_FLOW) {
            chat.skipMovement = true;
            checkOverlappingChats(chat, 0, [chat]);
            removeHiddenChats();
        } else {
            const lowestPoint = chat.top + chat.height;
            const requiredSpace = chat.height;
            const spaceAvailable =
                elementRef.current.offsetHeight - lowestPoint;
            const amount = requiredSpace - spaceAvailable;

            if (spaceAvailable < requiredSpace) {
                chatMessages.forEach(existing => {
                    if (existing === chat) return;
                    existing.top -= amount;
                });

                removeHiddenChats();
            }
        }
    };

    useEffect(() => {
        const resize = () => {
            if (!elementRef || !elementRef.current) return;

            const currentHeight = elementRef.current.offsetHeight;
            const newHeight = Math.round(
                document.body.offsetHeight *
                    GetConfiguration<number>("chat.viewer.height.percentage")
            );
            elementRef.current.style.height = `${newHeight}px`;

            setChatMessages(prev => {
                if (prev)
                    prev.forEach(
                        chat => (chat.top -= currentHeight - newHeight)
                    );
                return prev;
            });
        };

        window.addEventListener("resize", resize);
        resize();

        return () => window.removeEventListener("resize", resize);
    }, [setChatMessages]);

    useEffect(() => {
        const workerTracker: IWorkerEventTracker = {
            workerMessageReceived: (message: { [k: string]: any }) => {
                switch (message.type) {
                    case "MOVE_CHATS":
                        moveAllChatsUp(15);
                        return;
                }
            },
        };

        AddWorkerEventTracker(workerTracker);

        SendWorkerEvent({
            type: "CREATE_INTERVAL",
            time: getScrollSpeed,
            timerId,
            response: { type: "MOVE_CHATS" },
        });

        return () => {
            SendWorkerEvent({ type: "REMOVE_INTERVAL", timerId });
            RemoveWorkerEventTracker(workerTracker);
        };
    }, [getScrollSpeed, moveAllChatsUp, timerId]);

    useEffect(() => {
        if (!chatMessages.length) return;

        const chat = chatMessages[chatMessages.length - 1];

        if (!chat || chat.visible) return;

        chat.visible = true;
        makeRoom(chat);
    }, [chatMessages]);

return (
    <div
        ref={elementRef}
        className="chat-widget"
        style={{ pointerEvents: "none" }}
    >
        {chatMessages.map((chat) => (
            <ChatWidgetMessageView
                key={chat.id}
                chat={chat}
                makeRoom={makeRoom}
            />
        ))}
    </div>
);
};
