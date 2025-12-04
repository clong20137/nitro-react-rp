import {
    RoomEngineObjectEvent,
    RoomObjectCategory,
    RoomObjectType,
    UserProfileEvent,
} from "@nitrots/nitro-renderer";
import { FC } from "react";
import {
    GetRoomSession,
    GetSessionDataManager,
    GetUserProfile,
} from "../../api";
import { useMessageEvent, useRoomEngineEvent } from "../../hooks";

export const UserProfileView: FC<{}> = () => {
    // 🔹 Listen for the core Habbo UserProfileEvent and forward it to RP UI
    useMessageEvent<UserProfileEvent>(UserProfileEvent, (event) => {
        const parser = event.getParser();
        if (!parser) return;

        const myId = GetSessionDataManager().userId;

        // Compact payload for MyProfileView / RP profile system
        const detail = {
            userId: parser.id,
            username: parser.username,
            figure: parser.figure,
            motto: parser.motto,
            registration: parser.registration, // "dd-MM-yyyy"
            secondsSinceLastVisit: parser.secondsSinceLastVisit,
            achievementPoints: parser.achievementPoints,
            friendsCount: parser.friendsCount,
            isOnline: parser.isOnline,
            isSelf: parser.id === myId,
        };

        // Optional flag so other code can know RP profile is handling things
        (window as any).__rpProfileActive = true;

        // 🔥 This is what your RP UI / MyProfileView parent should listen for
        window.dispatchEvent(new CustomEvent("rp_open_profile", { detail }));

        // NOTE: we do NOT set any local "userProfile" state and we do NOT
        // render the Nitro profile window anymore.
    });

    // 🔹 When you click a user in the room, still request their profile,
    // which will be routed above into rp_open_profile → MyProfileView.
    useRoomEngineEvent<RoomEngineObjectEvent>(
        RoomEngineObjectEvent.SELECTED,
        (event) => {
            if (event.category !== RoomObjectCategory.UNIT) return;

            const session = GetRoomSession();
            if (!session || !session.userDataManager) return;

            const userData = session.userDataManager.getUserDataByIndex(
                event.objectId
            );

            if (!userData || userData.type !== RoomObjectType.USER) return;

            // This triggers UserProfileComposer → UserProfileEvent → handler above
            GetUserProfile(userData.webID);
        }
    );

    // ❌ Never show the old Nitro profile UI
    return null;
};
