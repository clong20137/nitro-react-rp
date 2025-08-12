import { useEffect, useState } from "react";
import "./XpGainPopup.scss";

interface Props {
    amount: number;
}

export const XPGainPopup = ({ amount }: Props) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timeout = setTimeout(() => setVisible(false), 1500);
        return () => clearTimeout(timeout);
    }, []);

    if (!visible) return null;

    return <div className="xp-gain-popup">+{amount}</div>;
};
