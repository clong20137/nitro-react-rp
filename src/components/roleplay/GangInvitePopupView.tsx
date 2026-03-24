import { FC } from "react";
import "./GangInvitePopupView.scss";

interface GangInviteProps {
    inviter: string;
    gangName: string;
    onAccept: () => void;
    onDecline: () => void;
}

export const GangInvitePopupView: FC<GangInviteProps> = ({ inviter, gangName, onAccept, onDecline }) => {
    return (
        <div className="gang-invite-popup" role="dialog" aria-modal="true" aria-label="Gang invitation">
            <div className="popup-header">
                <span className="popup-title">Gang Invitation</span>
                <button className="popup-close" onClick={ onDecline } aria-label="Close" />
            </div>

            <div className="popup-body">
                <p className="invite-message">
                    <strong>{ inviter }</strong> has invited you to join <strong>{ gangName }</strong>.
                </p>

                <div className="popup-buttons">
                    <button className="popup-action popup-action--accept" onClick={ onAccept }>
                        Accept
                    </button>
                    <button className="popup-action popup-action--decline" onClick={ onDecline }>
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
};
