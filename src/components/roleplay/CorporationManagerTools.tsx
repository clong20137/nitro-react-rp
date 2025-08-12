import axios from "axios";
import React from "react";
import "./CorporationView.scss";

interface Props {
    members: any[];
    ranks: any[];
    corporationId: number;
}

const CorporationManagerTools: React.FC<Props> = ({
    members,
    ranks,
    corporationId,
}) => {
    const handlePromote = async (memberId: number, newRankId: number) => {
        try {
            await axios.put(
                `/api/corporations/${corporationId}/members/${memberId}`,
                {
                    rank_id: newRankId,
                }
            );
            alert("Member promoted/demoted successfully!");
            // You might want to refresh the member list here
        } catch (err) {
            console.error(err);
            alert("Failed to update member.");
        }
    };

    const handleFire = async (memberId: number) => {
        if (!window.confirm("Are you sure you want to fire this user?")) return;

        try {
            await axios.delete(
                `/api/corporations/${corporationId}/members/${memberId}`
            );
            alert("Member fired successfully!");
            // You might want to refresh the member list here
        } catch (err) {
            console.error(err);
            alert("Failed to remove member.");
        }
    };

    return (
        <div className="corporation-manager-tools">
            <h3>Management Tools</h3>
            <table>
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Current Rank</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {members.map((m) => (
                        <tr key={m.id}>
                            <td>{m.user.username}</td>
                            <td>{m.rank ? m.rank.rank_name : "No rank"}</td>
                            <td>
                                <select
                                    defaultValue={m.rank ? m.rank.id : ""}
                                    onChange={(e) =>
                                        handlePromote(
                                            m.id,
                                            Number(e.target.value)
                                        )
                                    }
                                >
                                    <option value="">No Rank</option>
                                    {ranks.map((rank) => (
                                        <option key={rank.id} value={rank.id}>
                                            {rank.rank_name}
                                        </option>
                                    ))}
                                </select>
                                &nbsp;
                                <button className="button button-decline" onClick={() => handleFire(m.id)}>
                                    Fire
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CorporationManagerTools;
