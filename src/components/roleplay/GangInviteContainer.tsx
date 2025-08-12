import { FC, useEffect, useState } from "react";
import { GangInvitePopupView } from "./GangInvitePopupView";
import { SendMessageComposer } from "../../api";
import { GangInviteResponseComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/GangInviteResponseComposer";

export const GangInviteContainer: FC = () => {
    const [inviter, setInviter] = useState("");
    const [gangName, setGangName] = useState("");
    const [visible, setVisible] = useState(false);
    const [inviterId, setInviterId] = useState<number>(0); // 👈 Add this if you’ll use ID (else drop it)

    useEffect(() => {
        const handler = (event: any) => {
            console.log("[POPUP EVENT]", event.detail);

            if (!event.detail || !event.detail.inviter || !event.detail.gangName) {
                window.postMessage({
                    type: "notification",
                    message: "Something went wrong with get Inviter",
                });
                return;
            }

            const { inviter, gangName, inviterId } = event.detail;

            setInviter(inviter);
            setGangName(gangName);
            if (inviterId) setInviterId(inviterId); // Optional, if you pass it
            setVisible(true);
        };

        window.addEventListener("gang_invite_popup", handler);
        return () => window.removeEventListener("gang_invite_popup", handler);
    }, []);

    const handleAccept = () => {
        setVisible(false);
        SendMessageComposer(new GangInviteResponseComposer(true, inviterId));
    };

    const handleDecline = () => {
        setVisible(false);
        SendMessageComposer(new GangInviteResponseComposer(false, inviterId));
    };

    if (!visible) return null;

    return (
        <GangInvitePopupView
            inviter={inviter}
            gangName={gangName}
            onAccept={handleAccept}
            onDecline={handleDecline}
        />
    );
};
