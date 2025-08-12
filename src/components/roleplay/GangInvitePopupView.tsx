import { FC } from 'react';
import './GangInvitePopupView.scss';

interface GangInviteProps {
    inviter: string;
    gangName: string;
    onAccept: () => void;
    onDecline: () => void;
}



export const GangInvitePopupView: FC<GangInviteProps> = ({ inviter, gangName, onAccept, onDecline }) => {
    return (
        <div className="gang-invite-popup">
            <div className="popup-header">
                <span>Gang Invitation</span>
                <button className="popup-close" onClick={onDecline}>✖</button>
            </div>
            <div className="popup-body">
                <p><strong>{inviter}</strong> has invited you to join <strong>{gangName}</strong>.</p>
                <div className="popup-buttons">
                    <button className="habbo-action-button green" onClick={onAccept}>Accept</button>
                    <button className="habbo-action-button red" onClick={onDecline}>Decline</button>
                </div>
            </div>
        </div>
    );
};