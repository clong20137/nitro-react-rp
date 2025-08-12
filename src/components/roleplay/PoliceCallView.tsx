import { FC, useEffect, useState } from "react";
import "./PoliceCallView.scss";

interface PoliceCallData {
    username: string;
    figure: string;
    message: string;
    roomName: string;
    responder?: string;
}

interface PoliceCallViewProps {
    onTaxi: () => void;
}

export const PoliceCallView: FC<PoliceCallViewProps> = ({ onTaxi }) => {
    const [visible, setVisible] = useState(false);
    const [data, setData] = useState<PoliceCallData | null>(null);

    useEffect(() => {
        const handleOpen = (event: Event) => {
            const customEvent = event as CustomEvent<PoliceCallData>;
            if (!customEvent.detail) return;

            setData(customEvent.detail);
            setVisible(true);
        };

        window.addEventListener("open_police_call", handleOpen);
        return () => window.removeEventListener("open_police_call", handleOpen);
    }, []);

    if (!visible || !data) return null;

    const handleClose = () => {
        setVisible(false);
        setData(null);
    };

    return (
        <div className="police-call-view draggable-module">
            <div className="module-header">
                Police Call
                <button className="close-btn" onClick={handleClose}>
                    ✖
                </button>
            </div>

            <div className="call-body">
                <img
                    className="full-avatar"
                    src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${data.figure}&direction=2&size=l`}
                    alt="avatar"
                />

                <div className="call-info">
                    <div className="username_request">Vessel</div>
                    <div className="message_request">Help!</div>
                    <div className="room-link" onClick={onTaxi}>
                        @Room1
                    </div>
                </div>

                <div className="action-buttons">
                    {data.responder && (
                        <div className="response-tag">
                            Has not been responded too!
                        </div>
                    )}
                    
                </div>
            </div>
            <div className="police-call-buttons">
                <button
                    className="habbo-action-button green"
                   
                >
                    Helpful
                </button>
                <button
                    className="habbo-action-button red"
                  
                >
                    Abuse
                </button>
            </div>
            <div className="pagination">
                <button className="habbo-action-button">{"<"}</button>
                <span>1 / 100</span>
                <button className="habbo-action-button">{">"}</button>
            </div>
        </div>
    );
};
