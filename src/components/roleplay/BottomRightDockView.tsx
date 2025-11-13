import { FC, useState } from "react";
import { PhoneView } from "./PhoneView";
import "./BottomRightDockView.scss";

export const BottomRightDockView: FC = () => {
    const [phoneOpen, setPhoneOpen] = useState(false);

    return (
        <>
            {phoneOpen && <PhoneView onClose={() => setPhoneOpen(false)} />}

            <div className="bottom-right-dock">
                <button
                    className="dock-tile phone-tile"
                    onClick={() => setPhoneOpen((prev) => !prev)}
                    title="Phone"
                />
            </div>
        </>
    );
};
