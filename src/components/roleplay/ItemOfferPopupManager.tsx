import { FC, useEffect, useState } from 'react';
import { ItemOfferPopupView } from './ItemOfferPopupView';

interface ItemOfferData {
    offerId: number;
    fromUserId: number;
    fromUsername: string;
    itemName: string;
    itemIcon: string;
    itemCost: number;
}

export const ItemOfferPopupManager: FC = () => {
    const [offer, setOffer] = useState<ItemOfferData | null>(null);

    useEffect(() => {
        const handler = (event: any) => {
            const data = event.detail as ItemOfferData;
            setOffer(data);
        };

        window.addEventListener('item_offer_popup', handler);
        return () => window.removeEventListener('item_offer_popup', handler);
    }, []);

    const handleAccept = () => {
        console.log('[✔️] Accepted offer ID:', offer?.offerId);
        // TODO: send accept packet to server
        setOffer(null);
    };

    const handleDeny = () => {
        console.log('[❌] Denied offer ID:', offer?.offerId);
        // TODO: send deny packet to server
        setOffer(null);
    };

    if (!offer) return null;

    return (
        <ItemOfferPopupView
            data={offer}
            onAccept={handleAccept}
            onDeny={handleDeny}
        />
    );
};
