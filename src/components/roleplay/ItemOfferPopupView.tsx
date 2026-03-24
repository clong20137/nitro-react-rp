import { FC, useEffect, useRef, useState } from "react";
import "./ItemOfferPopupView.scss";
import { AcceptItemOfferComposer } from "@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/roleplay/AcceptItemOfferComposer";
import { SendMessageComposer } from "../../api";

interface ItemOfferData {
    offerId: number;
    fromUserId: number;
    fromUsername: string;
    itemName: string;
    itemIcon: string;
    itemCost: number;
}

interface Props {
    data: ItemOfferData;
    onAccept: () => void;
    onDeny: () => void;
}

export const ItemOfferPopupView: FC<Props> = ({ data, onAccept, onDeny }) => {
    const [visible, setVisible] = useState(true);
    const [closing, setClosing] = useState(false);

    const popupRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ x: number; y: number }>({
        x: window.innerWidth / 2 - 150,
        y: 80,
    });

    useEffect(() => {
        setVisible(true);
        setClosing(false);
    }, [data]);

    useEffect(() => {
        if (!popupRef.current) return;

        popupRef.current.style.left = `${pos.x}px`;
        popupRef.current.style.top = `${pos.y}px`;
    }, [pos]);

    if (!visible) return null;

    const startDrag = (e: React.MouseEvent) => {
        if (closing) return;

        const startX = e.clientX - pos.x;
        const startY = e.clientY - pos.y;

        const move = (ev: MouseEvent) => {
            setPos({
                x: ev.clientX - startX,
                y: ev.clientY - startY,
            });
        };

        const up = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
        };

        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
    };

    const handleAccept = () => {
        if (closing) return;

        setClosing(true);

        setTimeout(() => {
            SendMessageComposer(
                new AcceptItemOfferComposer(data.offerId, true),
            );
            onAccept?.();
        }, 180);
    };

    const handleDeny = () => {
        if (closing) return;

        setClosing(true);

        setTimeout(() => {
            SendMessageComposer(
                new AcceptItemOfferComposer(data.offerId, false),
            );
            onDeny?.();
        }, 180);
    };

    return (
        <div
            ref={popupRef}
            className={`item-offer-popup ${closing ? "closing" : ""}`}
        >
            <div className="popup-header" onMouseDown={startDrag}>
                <span className="popup-title">Item Offer</span>
                <button
                    className="popup-close"
                    onClick={handleDeny}
                    aria-label="Close item offer popup"
                />
            </div>
            <div className="popup-body">
                <div className="item-details">
                    <img src={data.itemIcon} alt={data.itemName} />
                    <div className="item-info">
                        <strong>
                            You have been offered a {data.itemName} for{" "}
                            {data.itemCost} credits.
                        </strong>
                    </div>
                </div>
                <div className="item-offer-buttons">
                    <button
                        className="habbo-action-button gold"
                        onClick={handleAccept}
                    >
                        Accept
                    </button>
                    <button
                        className="habbo-action-button red"
                        onClick={handleDeny}
                    >
                        Deny
                    </button>
                </div>
            </div>
        </div>
    );
};
