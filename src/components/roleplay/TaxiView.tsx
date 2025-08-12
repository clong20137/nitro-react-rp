import { FC, useState } from "react";
import { Base } from "../../common";
import "./TaxiView.scss";

interface RoomDestination {
    id: number;
    name: string;
    description?: string;
}

interface TaxiViewProps {
    destinations: RoomDestination[];
    onClose: () => void;
    onTeleport: (roomId: number) => void;
}

export const TaxiView: FC<TaxiViewProps> = ({
    destinations,
    onClose,
    onTeleport,
}) => {
    const [selected, setSelected] = useState<number | null>(null);

    return (
        <Base className="taxi-view">
            <div className="taxi-header">
                <h3>🚖 Taxi Navigation</h3>
                <button onClick={onClose} className="close-button">
                    ✕
                </button>
            </div>

            <div className="taxi-destinations">
                {destinations.map((dest) => (
                    <div
                        key={dest.id}
                        className={`taxi-destination ${
                            selected === dest.id ? "selected" : ""
                        }`}
                        onClick={() => setSelected(dest.id)}
                    >
                        <strong>{dest.name}</strong>
                        {dest.description && <p>{dest.description}</p>}
                    </div>
                ))}
            </div>

            <div className="taxi-actions">
                <button
                    disabled={selected === null}
                    onClick={() => selected !== null && onTeleport(selected)}
                >
                    Go
                </button>
            </div>
        </Base>
    );
};
