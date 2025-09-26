import { FC } from "react";
import { Button, ButtonGroup, Flex } from "../../../common";

export type TileTool = "paint" | "erase" | "door";

interface Props {
    active: boolean;
    tool: TileTool;
    onToggleActive: () => void;
    onPickTool: (tool: TileTool) => void;

    // door facing controls (optional)
    dir: number; // 0..7
    onChangeDir: (dir: number) => void;
}

export const TileEditorToolbar: FC<Props> = ({
    active,
    tool,
    onToggleActive,
    onPickTool,
    dir,
    onChangeDir,
}) => {
    const nextDir = () => onChangeDir((dir + 1) % 8);
    const prevDir = () => onChangeDir((dir + 7) % 8);

    return (
        <Flex
            gap={1}
            alignItems="center"
            justifyContent="end"
            style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 5,
                pointerEvents: "auto",
                background: "rgba(10,10,10,.55)",
                padding: 8,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,.12)",
            }}
        >
            <Button
                onClick={onToggleActive}
                variant={active ? "primary" : "secondary"}
            >
                {active ? "Exit Paint Mode" : "Edit tiles"}
            </Button>

            <ButtonGroup>
                <Button
                    variant={tool === "paint" ? "primary" : "secondary"}
                    onClick={() => onPickTool("paint")}
                >
                    Paint
                </Button>
                <Button
                    variant={tool === "erase" ? "primary" : "secondary"}
                    onClick={() => onPickTool("erase")}
                >
                    Erase
                </Button>
                <Button
                    variant={tool === "door" ? "primary" : "secondary"}
                    onClick={() => onPickTool("door")}
                >
                    Door
                </Button>
            </ButtonGroup>

            {/* Door direction quick control */}
            <ButtonGroup>
                <Button onClick={prevDir} title="Rotate door -1">
                    ◀
                </Button>
                <Button disabled>Dir: {dir}</Button>
                <Button onClick={nextDir} title="Rotate door +1">
                    ▶
                </Button>
            </ButtonGroup>
        </Flex>
    );
};
