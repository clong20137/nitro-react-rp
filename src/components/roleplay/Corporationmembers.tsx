import React from "react";
import CorporationManagerTools from "./CorporationManagerTools";


interface Props {
    corporation: any;
    members: any[];
    ranks: any[];
}

const CorporationMembers: React.FC<Props> = ({
    corporation,
    members,
    ranks,
}) => {
    return (
        <div className="corporation-members">
            <h2>{corporation.name}</h2>
            <table>
                <thead>
                    <tr>
                        <th>Avatar</th>
                        <th>Username</th>
                        <th>Rank</th>
                        <th>Shifts</th>
                        <th>Last Online</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map((m) => (
                        <tr key={m.id}>
                            <td>
                                <img
                                    src={`https://habbo.city/habbo-imaging/avatarimage?figure=${m.user.look}.png`}
                                    alt={m.user.username}
                                />
                            </td>
                            <td>{m.user.username}</td>
                            <td>{m.rank ? m.rank.rank_name : "No rank"}</td>
                            <td>{m.weekly_shifts}</td>
                            <td>{m.last_seen}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* if manager tools needed: */}
            <CorporationManagerTools
                members={members}
                ranks={ranks}
                corporationId={corporation.id}
            />
        </div>
    );
};

export default CorporationMembers;
