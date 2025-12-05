import {
    Dispose,
    DropBounce,
    EaseOut,
    JumpBy,
    Motions,
    NitroToolbarAnimateIconEvent,
    PerkAllowancesMessageEvent,
    PerkEnum,
    Queue,
    Wait,
} from "@nitrots/nitro-renderer";
import { FC, useCallback, useState } from "react";
import {
    CreateLinkEvent,
    GetSessionDataManager,
    MessengerIconState,
    OpenMessengerChat,
} from "../../api";
import {
    Base,
    Flex,
    LayoutAvatarImageView,
    LayoutItemCountView,
    TransitionAnimation,
    TransitionAnimationTypes,
} from "../../common";
import {
    useAchievements,
    useFriends,
    useInventoryUnseenTracker,
    useMessageEvent,
    useMessenger,
    useRoomEngineEvent,
    useSessionInfo,
} from "../../hooks";

// ❌ Me Menu — now fully disabled
// import { ToolbarMeView } from "./ToolbarMeView";

export const ToolbarView: FC<{ isInRoom: boolean }> = ({ isInRoom }) => {
    const [isMeExpanded, setMeExpanded] = useState(false);
    const [useGuideTool, setUseGuideTool] = useState(false);

    const { userFigure = null } = useSessionInfo();
    const { getFullCount = 0 } = useInventoryUnseenTracker();
    const { getTotalUnseen = 0 } = useAchievements();
    const { requests = [] } = useFriends();
    const { iconState = MessengerIconState.HIDDEN } = useMessenger();
    const isMod = GetSessionDataManager().isModerator;

    useMessageEvent<PerkAllowancesMessageEvent>(
        PerkAllowancesMessageEvent,
        (event) => {
            const parser = event.getParser();
            setUseGuideTool(parser.isAllowed(PerkEnum.USE_GUIDE_TOOL));
        }
    );

    const animationIconToToolbar = useCallback(
        (iconName: string, image: HTMLImageElement, x: number, y: number) => {
            const target = document.body.getElementsByClassName(
                iconName
            )[0] as HTMLElement;
            if (!target) return;

            image.className = "toolbar-icon-animation";
            image.style.visibility = "visible";
            image.style.left = x + "px";
            image.style.top = y + "px";
            document.body.append(image);

            const targetBounds = target.getBoundingClientRect();
            const imageBounds = image.getBoundingClientRect();

            const left = imageBounds.x - targetBounds.x;
            const top = imageBounds.y - targetBounds.y;
            const squared = Math.sqrt(left * left + top * top);
            const wait = 500 - Math.abs((1 / squared) * 100 * 500 * 0.5);
            const height = 20;

            const motionName = `ToolbarBouncing[${iconName}]`;

            if (!Motions.getMotionByTag(motionName)) {
                Motions.runMotion(
                    new Queue(
                        new Wait(wait + 8),
                        new DropBounce(target, 400, 12)
                    )
                ).tag = motionName;
            }

            const motion = new Queue(
                new EaseOut(
                    new JumpBy(
                        image,
                        wait,
                        targetBounds.x - imageBounds.x + height,
                        targetBounds.y - imageBounds.y,
                        100,
                        1
                    ),
                    1
                ),
                new Dispose(image)
            );

            Motions.runMotion(motion);
        },
        []
    );

    useRoomEngineEvent<NitroToolbarAnimateIconEvent>(
        NitroToolbarAnimateIconEvent.ANIMATE_ICON,
        (event) => {
            animationIconToToolbar(
                "icon-inventory",
                event.image,
                event.x,
                event.y
            );
        }
    );

    return (
        <>
            {/* ❌======================
ME MENU DISABLED
======================*/}

            {/*
<TransitionAnimation
type={TransitionAnimationTypes.FADE_IN}
inProp={isMeExpanded}
timeout={300}
>
<ToolbarMeView
useGuideTool={useGuideTool}
unseenAchievementCount={getTotalUnseen}
setMeExpanded={setMeExpanded}
/>
</TransitionAnimation>
*/}

            <Flex
                alignItems="center"
                justifyContent="between"
                gap={2}
                className="nitro-toolbar py-1 px-3"
            >
                {/* LEFT SIDE */}
                <Flex gap={2} alignItems="center">
                    <Flex alignItems="center" gap={2}>
                        {/* ❌ Avatar no longer clickable — removed pointer + onClick */}

                        {/* Blue Chip Tray (no Me menu anymore) */}
                    </Flex>

                    {/* Chat anchor */}
                    <Flex
                        alignItems="center"
                        id="toolbar-chat-input-container"
                    />
                </Flex>

                {/* RIGHT SIDE */}
                <Flex alignItems="center" gap={2}>
                    <Flex gap={2}>
                        {(iconState === MessengerIconState.SHOW ||
                            iconState === MessengerIconState.UNREAD) && (
                            <Base
                                pointer
                                role="button"
                                aria-label="Open Messenger"
                                className={`navigation-item icon icon-message ${
                                    iconState === MessengerIconState.UNREAD &&
                                    "is-unseen"
                                }`}
                                onClick={() => OpenMessengerChat()}
                            />
                        )}
                    </Flex>
                    <Base
                        id="toolbar-friend-bar-container"
                        className="d-none d-lg-block"
                    />
                </Flex>
            </Flex>
        </>
    );
};
