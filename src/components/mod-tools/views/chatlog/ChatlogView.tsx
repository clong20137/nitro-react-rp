import { ChatRecordData } from "@nitrots/nitro-renderer";
import { CSSProperties, FC, Key, useCallback } from "react";
import {
    AutoSizer,
    CellMeasurer,
    CellMeasurerCache,
    List,
    ListRowProps,
} from "react-virtualized";
import { CreateLinkEvent, TryVisitRoom } from "../../../../api";
import { Base, Button, Column, Flex, Grid } from "../../../../common";
import { useModTools } from "../../../../hooks";

import "./ChatlogView.scss";

interface ChatlogViewProps {
    records: ChatRecordData[];
}

export const ChatlogView: FC<ChatlogViewProps> = ({ records = [] }) => {
    const { openRoomInfo } = useModTools();
    const cache = new CellMeasurerCache({
        defaultHeight: 72,
        fixedWidth: true,
    });

    const BubbleRow: FC<{
        style: CSSProperties;
        chat: ChatRecordData["chatlog"][number];
    }> = ({ style, chat }) => {
        return (
            <div className="cl-row" style={style}>
                {/* time column */}
                <div className="cl-time">{chat.timestamp}</div>

                {/* avatar / initial */}
                <button
                    className="cl-avatar"
                    title={chat.userName}
                    onClick={() =>
                        CreateLinkEvent(
                            `mod-tools/open-user-info/${chat.userId}`
                        )
                    }
                >
                    <span className="cl-avatar-initials">
                        {(chat.userName || "?").charAt(0).toUpperCase()}
                    </span>
                </button>

                {/* bubble */}
                <div
                    className="cl-bubble"
                    role="group"
                    aria-label={`${chat.userName} said`}
                >
                    <div className="cl-bubble__head">
                        <button
                            className="cl-user"
                            onClick={() =>
                                CreateLinkEvent(
                                    `mod-tools/open-user-info/${chat.userId}`
                                )
                            }
                            title="Open user tools"
                        >
                            {chat.userName}
                        </button>
                    </div>
                    <div className="cl-bubble__body">{chat.message}</div>
                </div>
            </div>
        );
    };

    /** single-room renderer */
    const rowRenderer = (p: ListRowProps) => {
        const chat = records[0].chatlog[p.index];

        return (
            <CellMeasurer
                cache={cache}
                columnIndex={0}
                key={p.key}
                parent={p.parent}
                rowIndex={p.index}
            >
                <BubbleRow style={p.style} chat={chat} />
            </CellMeasurer>
        );
    };

    /** multi-room (inserts a room info header row before each room’s logs) */
    const advancedRowRenderer = (p: ListRowProps) => {
        let current: ChatRecordData | null = null;
        let isRoomInfo = false;
        let chat: any = null;
        let total = 0;

        for (let i = 0; i < records.length; i++) {
            current = records[i];
            total++; // header row for room
            total += current.chatlog.length; // chats in the room

            if (p.index > total - 1) continue;

            // this position is the header
            if (p.index + 1 === total - current.chatlog.length) {
                isRoomInfo = true;
                break;
            }

            const idx = p.index - (total - current.chatlog.length);
            chat = current.chatlog[idx];
            break;
        }

        return (
            <CellMeasurer
                cache={cache}
                columnIndex={0}
                key={p.key}
                parent={p.parent}
                rowIndex={p.index}
            >
                {isRoomInfo && current && (
                    <RoomInfo
                        roomId={current.roomId}
                        roomName={current.roomName}
                        uniqueKey={p.key}
                        style={p.style}
                    />
                )}
                {!isRoomInfo && chat && (
                    <BubbleRow style={p.style} chat={chat} />
                )}
            </CellMeasurer>
        );
    };

    const getNumRowsForAdvanced = useCallback(() => {
        let count = 0;
        for (const rec of records) count += 1 + rec.chatlog.length; // header + rows
        return count;
    }, [records]);

    const RoomInfo = (props: {
        roomId: number;
        roomName: string;
        uniqueKey: Key;
        style: CSSProperties;
    }) => (
        <Flex
            key={props.uniqueKey}
            gap={2}
            alignItems="center"
            justifyContent="between"
            className="cl-roominfo"
            style={props.style}
        >
            <div className="cl-roominfo__name">
                <strong>Room:</strong> {props.roomName}
            </div>
            <div className="cl-roominfo__actions">
                <Button onClick={() => TryVisitRoom(props.roomId)}>
                    Visit
                </Button>
                <Button onClick={() => openRoomInfo?.(props.roomId)}>
                    Tools
                </Button>
            </div>
        </Flex>
    );

    if (!records.length) return null;

    return (
        <>
            {records.length === 1 && (
                <RoomInfo
                    roomId={records[0].roomId}
                    roomName={records[0].roomName}
                    uniqueKey={null}
                    style={{}}
                />
            )}

            <Column fit gap={0} overflow="hidden">
                <Column gap={2}>
                    <Grid gap={1} className="cl-head border-bottom pb-1">
                        <Base className="g-col-2">Time</Base>
                        <Base className="g-col-3">User</Base>
                        <Base className="g-col-7">Message</Base>
                    </Grid>
                </Column>

                <Column className="cl-list" overflow="auto" gap={0}>
                    <AutoSizer defaultWidth={420} defaultHeight={240}>
                        {({ height, width }) => {
                            cache.clearAll();
                            return (
                                <List
                                    width={width}
                                    height={height}
                                    rowCount={
                                        records.length > 1
                                            ? getNumRowsForAdvanced()
                                            : records[0].chatlog.length
                                    }
                                    rowHeight={cache.rowHeight}
                                    rowRenderer={
                                        records.length > 1
                                            ? advancedRowRenderer
                                            : rowRenderer
                                    }
                                    className="cl-virtualized"
                                    deferredMeasurementCache={cache}
                                />
                            );
                        }}
                    </AutoSizer>
                </Column>
            </Column>
        </>
    );
};

export default ChatlogView;
