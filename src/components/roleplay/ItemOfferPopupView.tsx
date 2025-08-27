import { FC, useEffect, useState } from "react";
import "./ItemOfferPopupEvent.scss";
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

    useEffect(() => {
        setVisible(true);
    }, [data]);

    if (!visible) return null;

    const handleAccept = () => {
        SendMessageComposer(new AcceptItemOfferComposer(data.offerId, true));
  
        onAccept?.();
    };

    const handleDeny = () => {
        SendMessageComposer(new AcceptItemOfferComposer(data.offerId, false));
        onDeny?.();
    };

    return (
       <div className="item-offer-popup">
            <div className="popup-header">
                <span className="popup-title">Item Offer</span>
                <button className="popup-close" onClick={handleDeny}>✖</button>
            </div>
            <div className="popup-body">
                <div className="item-details">
                    <img src={data.itemIcon} alt={data.itemName} />
                    <div className="item-info">
                        <strong>You have been offered a {data.itemName} for {data.itemCost} credits.</strong>
                    </div>
                </div>
                <div className="item-offer-buttons">
                    <button className="habbo-action-button gold" onClick={handleAccept}>Accept</button>
                    <button className="habbo-action-button red" onClick={handleDeny}>Deny</button>
                </div>
            </div>
        </div>
        
    );
};