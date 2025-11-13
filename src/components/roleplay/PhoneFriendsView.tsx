import { FC, useMemo, useState } from "react";
import { MessengerFriend } from "../../api";
import { FriendsListGroupView } from "../friends/views/friends-list/friends-list-group/FriendsListGroupView";


interface PhoneFriendsViewProps {
    friends: MessengerFriend[];
    onOpenChat: (friend: MessengerFriend) => void;
}

export const PhoneFriendsView: FC<PhoneFriendsViewProps> = ({
    friends = [],
    onOpenChat,
}) => {
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const filteredFriends = useMemo(() => {
        if (!search.trim()) return friends;

        const q = search.toLowerCase();

        return friends.filter(
            (f) =>
                f.name.toLowerCase().includes(q) ||
                (f.realName && f.realName.toLowerCase().includes(q))
        );
    }, [friends, search]);

    const selectFriend = (userId: number) => {
        setSelectedIds([userId]);

        const friend = friends.find((f) => f.id === userId);
        if (friend) onOpenChat(friend);
    };

    return (
        <div className="phone-friends-view">
            <div className="phone-friends-search">
                <input
                    type="text"
                    placeholder="Search friends..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="phone-friends-list">
                <FriendsListGroupView
                    list={filteredFriends}
                    selectedFriendsIds={selectedIds}
                    selectFriend={selectFriend}
                />
            </div>
        </div>
    );
};
