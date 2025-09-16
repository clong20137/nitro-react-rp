import { ILinkEventTracker } from "@nitrots/nitro-renderer";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import {
    AutoSizer,
    CellMeasurer,
    CellMeasurerCache,
    List,
    ListRowProps,
    ListRowRenderer,
    Size,
} from "react-virtualized";
import {
    AddEventLinkTracker,
    ChatEntryType,
    LocalizeText,
    RemoveLinkEventTracker,
} from "../../api";
import {
    Flex,
    NitroCardContentView,
    NitroCardHeaderView,
    NitroCardView,
    Text,
} from "../../common";
import { useChatHistory } from "../../hooks";
import "./ChatHistoryView.scss";

const stripTags = (s?: string) => (s || "").replace(/<\/?[^>]+>/g, "");

const escapeHtml = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const highlightHtml = (text: string, query: string) => {
    if (!query) return escapeHtml(text);
    // escape the base text first so we never inject markup
    const safe = escapeHtml(text);
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(
        new RegExp(`(${q})`, "ig"),
        '<mark class="ch-mark">$1</mark>'
    );
};

export const ChatHistoryView: FC<{}> = () => {
    const [isVisible, setIsVisible] = useState(false);
    const { chatHistory = [] } = useChatHistory();

    // --- search / filter ---
    const [query, setQuery] = useState("");
    const [userFilter, setUserFilter] = useState<string>("all");

    // Build a list of distinct, sanitized usernames
    const users = useMemo(() => {
        const set = new Set<string>();
        for (const it of chatHistory) {
            if (it.type !== ChatEntryType.TYPE_CHAT) continue;
            const clean = stripTags(String(it.name || ""));
            if (clean) set.add(clean);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
        );
    }, [chatHistory]);

    // Prepare a sanitized version of each row for filtering/rendering
    const cleanRows = useMemo(() => {
        return chatHistory.map((it) => ({
            ...it,
            cleanName: stripTags(String(it.name ?? "")),
            cleanMsg: stripTags(String(it.message ?? "")),
        }));
    }, [chatHistory]);

    // Filter + (case-insensitive) search
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return cleanRows.filter((it) => {
            // user filter applies only to chat lines
            if (userFilter !== "all") {
                if (it.type !== ChatEntryType.TYPE_CHAT) return false;
                if (it.cleanName !== userFilter) return false;
            }
            if (!q) return true;

            // search across name/message (and info rows' name/message)
            const hay = `${it.cleanName} ${it.cleanMsg}`.toLowerCase();
            return hay.includes(q);
        });
    }, [cleanRows, query, userFilter]);

    // virtualized list cache
    const cache = useMemo(
        () => new CellMeasurerCache({ defaultHeight: 26, fixedWidth: true }),
        []
    );
    const listRef = useRef<List>(null);

    const RowRenderer: ListRowRenderer = (props: ListRowProps) => {
        const item = filtered[props.index];

        return (
            <CellMeasurer
                cache={cache}
                columnIndex={0}
                key={props.key}
                parent={props.parent}
                rowIndex={props.index}
            >
                <Flex
                    className={`ch-row ${props.index % 2 ? "odd" : "even"}`}
                    style={props.style}
                    gap={1}
                    alignItems="center"
                >
                    <Text className="ch-time" variant="muted">
                        {item.timestamp}
                    </Text>

                    {item.type === ChatEntryType.TYPE_CHAT && (
                        <>
                            <Text
                                className="ch-name"
                                pointer
                                noWrap
                                dangerouslySetInnerHTML={{
                                    __html: `${highlightHtml(
                                        item.cleanName,
                                        query
                                    )}:`,
                                }}
                            />
                            <Text
                                className="ch-msg"
                                textBreak
                                wrap
                                grow
                                dangerouslySetInnerHTML={{
                                    __html: highlightHtml(item.cleanMsg, query),
                                }}
                            />
                        </>
                    )}

                    {item.type === ChatEntryType.TYPE_ROOM_INFO && (
                        <>
                            <i className="icon icon-small-room ch-room-icon" />
                            <Text
                                className="ch-info"
                                textBreak
                                wrap
                                grow
                                dangerouslySetInnerHTML={{
                                    __html: highlightHtml(
                                        item.cleanName || item.cleanMsg,
                                        query
                                    ),
                                }}
                            />
                        </>
                    )}
                </Flex>
            </CellMeasurer>
        );
    };

    const onResize = (_: Size) => {
        cache.clearAll();
        if (listRef.current) listRef.current.recomputeRowHeights();
    };

    // link tracker open/close/toggle (kept)
    useEffect(() => {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) => {
                const parts = url.split("/");
                if (parts.length < 2) return;

                switch (parts[1]) {
                    case "show":
                        setIsVisible(true);
                        return;
                    case "hide":
                        setIsVisible(false);
                        return;
                    case "toggle":
                        setIsVisible((v) => !v);
                        return;
                }
            },
            eventUrlPrefix: "chat-history/",
        };

        AddEventLinkTracker(linkTracker);
        return () => RemoveLinkEventTracker(linkTracker);
    }, []);

    // Scroll to bottom when opening or when new rows arrive
    useEffect(() => {
        if (!isVisible || !listRef.current) return;
        const list = listRef.current;
        if (filtered.length <= 6) list.scrollToRow(filtered.length - 1);
        else list.scrollToRow(filtered.length);
    }, [isVisible, filtered.length]);

    if (!isVisible) return null;

    return (
        <NitroCardView
            uniqueKey="chat-history"
            className="nitro-chat-history"
            theme="primary-slim"
        >
            <NitroCardHeaderView
                headerText={LocalizeText("room.chathistory.button.text")}
                onCloseClick={() => setIsVisible(false)}
            />

            <NitroCardContentView className="ch-content">
                {/* toolbar */}
                <div className="ch-toolbar">
                    <div className="ch-field">
                        <input
                            type="text"
                            className="ch-input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search text or username…"
                        />
                        {!!query && (
                            <button
                                className="ch-clear"
                                aria-label="Clear search"
                                onClick={() => setQuery("")}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="ch-field">
                        <select
                            className="ch-select"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                        >
                            <option value="all">All users</option>
                            {users.map((u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* list */}
                <div className="ch-list-wrap">
                    <AutoSizer
                        defaultWidth={300}
                        defaultHeight={220}
                        onResize={onResize}
                    >
                        {({ height, width }) => (
                            <List
                                ref={listRef}
                                width={width}
                                height={height}
                                rowCount={filtered.length}
                                rowHeight={cache.rowHeight}
                                className="chat-history-list"
                                rowRenderer={RowRenderer}
                                deferredMeasurementCache={cache}
                            />
                        )}
                    </AutoSizer>
                </div>
            </NitroCardContentView>
        </NitroCardView>
    );
};
