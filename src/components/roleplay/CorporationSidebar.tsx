

import React from "react";
import "./CorporationView.scss";

interface CorporationSidebarProps {
    corporations: any[];
    onSelectCorporation: (corp: any) => void;
    selectedCorporationId: number | null;
}

const CorporationSidebar: React.FC<CorporationSidebarProps> = ({
    corporations,
    onSelectCorporation,
    selectedCorporationId,
}) => {
    return (
        <div className="corporation-sidebar">
            {corporations.map((corp) => (
                <div
                    key={corp.id}
                    className={`corporation-item ${
                        selectedCorporationId === corp.id ? "active" : ""
                    }`}
                    title={corp.name}
                    onClick={() => onSelectCorporation(corp)}
                >
                    <img src={`/icons/${corp.icon}`} alt={corp.name} />
                </div>
            ))}
        </div>
    );
};

export default CorporationSidebar;
