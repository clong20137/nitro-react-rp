import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import "./MacroView.scss";

/** ========= Types & storage keys ========= */
type KeyString = string; // e.g. "F1", "KeyG", "Digit1", "ArrowUp"
type TriggerString = string; // e.g. "Key:F1", "Mouse:MouseLeft", "Shift+Mouse:MouseRight", "Wheel:WheelUp"

type Macro = { id: string; trigger: TriggerString; script: string };
type Preset = { id: string; name: string; macros: Macro[] };

const LS_PRESETS_V2 = "olrp.macros.presets.v2";
const LS_PRESETS_V1 = "olrp.macros.presets.v1";
const LS_ENABLED = "olrp.macros.enabled.v1";
const LS_ACTIVE = "olrp.macros.activePreset.v1";
const MAX_PRESETS = 5;

const uid = () => Math.random().toString(36).slice(2, 10);

function normalizeMods(e: {
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
}) {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    if (e.metaKey) parts.push("Meta");
    return parts.length ? parts.join("+") + "+" : "";
}

function eventToKeyString(e: KeyboardEvent): KeyString | null {
    if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta"
    )
        return null;

    const code = e.code || e.key;
    return code === " " ? "Space" : code;
}

function keyEventToTrigger(e: KeyboardEvent): TriggerString | null {
    const k = eventToKeyString(e);
    if (!k) return null;
    const mods = normalizeMods(e);
    return `${mods}Key:${k}`;
}

function mouseEventToTrigger(e: MouseEvent): TriggerString {
    const mods = normalizeMods(e);
    const btn =
        e.button === 0
            ? "MouseLeft"
            : e.button === 1
            ? "MouseMiddle"
            : e.button === 2
            ? "MouseRight"
            : e.button === 3
            ? "Mouse4"
            : e.button === 4
            ? "Mouse5"
            : `Mouse${e.button}`;
    return `${mods}Mouse:${btn}`;
}

function wheelEventToTrigger(e: WheelEvent): TriggerString {
    const mods = normalizeMods(e);
    const dir = e.deltaY < 0 ? "WheelUp" : "WheelDown";
    return `${mods}Wheel:${dir}`;
}

function broadcastMacrosChanged() {
    try {
        window.dispatchEvent(new CustomEvent("olrp_macros_changed"));
    } catch {}
}

type MacroAction =
    | { type: "command"; value: string }
    | { type: "module"; value: string }
    | { type: "wait"; ms: number };

const MODULES = new Set([
    "inventory",
    "wanted",
    "corporations",
    "gangs",
    "settings",
    "macros",
    "stats",
    "phone",
]);

function parseScript(script: string): MacroAction[] {
    const raw = script
        .split(/\n|;/g)
        .map((s) => s.trim())
        .filter(Boolean);

    const actions: MacroAction[] = [];

    for (const line of raw) {
        const lower = line.toLowerCase();

        if (lower.startsWith("ui:") || lower.startsWith("module:")) {
            const mod = line.split(":").slice(1).join(":").trim().toLowerCase();
            if (mod) actions.push({ type: "module", value: mod });
            continue;
        }

        if (lower.startsWith("wait")) {
            const m = lower.match(/wait\s*:?\s*(\d+)/);
            if (m) {
                const ms = Math.max(0, Math.min(5000, parseInt(m[1], 10)));
                actions.push({ type: "wait", ms });
            }
            continue;
        }

        actions.push({ type: "command", value: line });
    }

    return actions.slice(0, 12);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface MacroViewProps {
    onClose: () => void;
    onSendCommand?: (command: string) => void;

    /** If provided, MacroView will call this for `ui:inventory` etc. */
    onOpenModule?: (moduleId: string) => void;
}

export const MacroView: FC<MacroViewProps> = ({
    onClose,
    onSendCommand,
    onOpenModule,
}) => {
    /** ======== State / persistence ======== */
    const [enabled, setEnabled] = useState<boolean>(() => {
        try {
            return JSON.parse(localStorage.getItem(LS_ENABLED) || "true");
        } catch {
            return true;
        }
    });

    const [presets, setPresets] = useState<Preset[]>(() => {
        // v2 first
        try {
            const raw = localStorage.getItem(LS_PRESETS_V2);
            if (raw) return JSON.parse(raw);
        } catch {}

        // fallback migrate v1 -> v2 shape
        try {
            const rawOld = localStorage.getItem(LS_PRESETS_V1);
            if (rawOld) {
                const old = JSON.parse(rawOld) as Array<{
                    id: string;
                    name: string;
                    macros: Array<{ id: string; key: string; command: string }>;
                }>;
                return old.map((p) => ({
                    id: p.id || uid(),
                    name: p.name || "Default",
                    macros: (p.macros || []).map((m) => ({
                        id: m.id || uid(),
                        trigger: `Key:${m.key}`,
                        script: m.command ?? "",
                    })),
                }));
            }
        } catch {}

        return [{ id: uid(), name: "Default", macros: [] }];
    });

    const [activePresetId, setActivePresetId] = useState<string>(() => {
        try {
            return localStorage.getItem(LS_ACTIVE) || "";
        } catch {
            return "";
        }
    });

    // keep active preset valid
    useEffect(() => {
        if (!presets.length) return;
        if (!activePresetId || !presets.find((p) => p.id === activePresetId)) {
            setActivePresetId(presets[0].id);
        }
    }, [activePresetId, presets]);

    useEffect(() => {
        localStorage.setItem(LS_ENABLED, JSON.stringify(enabled));
        broadcastMacrosChanged();
    }, [enabled]);

    useEffect(() => {
        localStorage.setItem(LS_PRESETS_V2, JSON.stringify(presets));
        broadcastMacrosChanged();
    }, [presets]);

    useEffect(() => {
        if (activePresetId) {
            localStorage.setItem(LS_ACTIVE, activePresetId);
            broadcastMacrosChanged();
        }
    }, [activePresetId]);

    const activePreset = useMemo(
        () => presets.find((p) => p.id === activePresetId) || presets[0],
        [presets, activePresetId]
    );

    const macros = activePreset?.macros ?? [];

    /** ======== Global triggers (key + mouse + wheel) ======== */
    const enabledRef = useRef(enabled);
    const macrosRef = useRef<Macro[]>(macros);

    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);

    useEffect(() => {
        macrosRef.current = macros;
    }, [macros]);

    const runMacroScript = async (script: string) => {
        const actions = parseScript(script);

        for (const a of actions) {
            if (a.type === "wait") {
                await sleep(a.ms);
                continue;
            }

            if (a.type === "module") {
                const id = a.value.toLowerCase();
                if (!MODULES.has(id)) continue;

                if (onOpenModule) onOpenModule(id);
                else
                    window.dispatchEvent(
                        new CustomEvent("olrp_open_module", {
                            detail: { module: id },
                        })
                    );

                continue;
            }

            const cmd = a.value.trim();
            if (!cmd) continue;

            if (onSendCommand) onSendCommand(cmd);
            else
                window.dispatchEvent(
                    new CustomEvent("macro_run", { detail: { command: cmd } })
                );

            await sleep(60);
        }
    };

    useEffect(() => {
        const isTypingTarget = (t: EventTarget | null) => {
            const el = t as HTMLElement | null;
            if (!el) return false;
            return (
                el.tagName === "INPUT" ||
                el.tagName === "TEXTAREA" ||
                el.isContentEditable
            );
        };

        const isInsideMacroUI = (t: EventTarget | null) => {
            const el = t as HTMLElement | null;
            if (!el) return false;
            return !!el.closest(".macros-view, .macro-modal");
        };

        const tryRun = (trigger: TriggerString, e: Event) => {
            if (!enabledRef.current) return;
            if (isTypingTarget(e.target)) return;
            if (isInsideMacroUI(e.target)) return;

            const found = macrosRef.current.find((m) => m.trigger === trigger);
            if (!found) return;

            // prevent default only when matched
            (e as any).preventDefault?.();
            (e as any).stopPropagation?.();

            const script = found.script?.trim();
            if (!script) return;
            void runMacroScript(script);
        };

        const onKeydown = (e: KeyboardEvent) => {
            const t = keyEventToTrigger(e);
            if (!t) return;
            tryRun(t, e);
        };

        const onMouseDown = (e: MouseEvent) => {
            const t = mouseEventToTrigger(e);
            tryRun(t, e);
        };

        const onWheel = (e: WheelEvent) => {
            const t = wheelEventToTrigger(e);
            tryRun(t, e);
        };

        window.addEventListener("keydown", onKeydown, { passive: false });
        window.addEventListener("mousedown", onMouseDown, { passive: false });
        window.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            window.removeEventListener("keydown", onKeydown as any);
            window.removeEventListener("mousedown", onMouseDown as any);
            window.removeEventListener("wheel", onWheel as any);
        };
    }, [onSendCommand, onOpenModule]);

    /** ======== Preset CRUD ======== */
    const addPreset = () => {
        if (presets.length >= MAX_PRESETS) return;
        const base = "Preset";
        let i = 1;
        const names = new Set(presets.map((p) => p.name.toLowerCase()));
        while (names.has(`${base} ${i}`.toLowerCase())) i++;
        const p: Preset = { id: uid(), name: `${base} ${i}`, macros: [] };
        setPresets((prev) => [...prev, p]);
        setActivePresetId(p.id);
    };

    const renamePreset = (id: string, nextName: string) => {
        const name = nextName.trim();
        if (!name) return;
        setPresets((prev) =>
            prev.map((p) => (p.id === id ? { ...p, name } : p))
        );
    };

    const deletePreset = (id: string) => {
        if (presets.length <= 1) return;
        setPresets((prev) => {
            const next = prev.filter((p) => p.id !== id);
            if (!next.find((p) => p.id === activePresetId))
                setActivePresetId(next[0]?.id || "");
            return next;
        });
    };

    /** ======== Macro CRUD ======== */
    const updateMacro = (id: string, patch: Partial<Macro>) => {
        if (!activePreset) return;
        setPresets((prev) =>
            prev.map((p) =>
                p.id === activePreset.id
                    ? {
                          ...p,
                          macros: p.macros.map((x) =>
                              x.id === id ? { ...x, ...patch } : x
                          ),
                      }
                    : p
            )
        );
    };

    const removeMacro = (id: string) => {
        if (!activePreset) return;
        setPresets((prev) =>
            prev.map((p) =>
                p.id === activePreset.id
                    ? { ...p, macros: p.macros.filter((x) => x.id !== id) }
                    : p
            )
        );
    };

    const addMacro = (m: Macro) => {
        if (!activePreset) return;
        setPresets((prev) =>
            prev.map((p) =>
                p.id === activePreset.id
                    ? {
                          ...p,
                          macros: [
                              ...p.macros.filter(
                                  (x) => x.trigger !== m.trigger
                              ),
                              m,
                          ],
                      }
                    : p
            )
        );
    };

    /** ======== Add Macro Modal ======== */
    const [modalOpen, setModalOpen] = useState(false);
    const [captureArmed, setCaptureArmed] = useState(false);
    const [capturedTrigger, setCapturedTrigger] = useState<TriggerString>("");
    const [newScript, setNewScript] = useState("");

    const openAddModal = () => {
        setCapturedTrigger("");
        setNewScript("");
        setCaptureArmed(false);
        setModalOpen(true);
    };

    useEffect(() => {
        if (!modalOpen || !captureArmed) return;

        const onKey = (e: KeyboardEvent) => {
            const t = keyEventToTrigger(e);
            if (!t) return;
            e.preventDefault();
            setCapturedTrigger(t);
            setCaptureArmed(false);
        };

        const onMouse = (e: MouseEvent) => {
            e.preventDefault();
            const t = mouseEventToTrigger(e);
            setCapturedTrigger(t);
            setCaptureArmed(false);
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const t = wheelEventToTrigger(e);
            setCapturedTrigger(t);
            setCaptureArmed(false);
        };

        window.addEventListener("keydown", onKey, { passive: false });
        window.addEventListener("mousedown", onMouse, { passive: false });
        window.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            window.removeEventListener("keydown", onKey as any);
            window.removeEventListener("mousedown", onMouse as any);
            window.removeEventListener("wheel", onWheel as any);
        };
    }, [modalOpen, captureArmed]);

    const confirmAdd = () => {
        const trigger = capturedTrigger.trim();
        const script = newScript.trim();
        if (!trigger || !script) return;
        addMacro({ id: uid(), trigger, script });
        setModalOpen(false);
        setCapturedTrigger("");
        setNewScript("");
        setCaptureArmed(false);
    };

    /** ======== DRAGGABLE ======== */
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        return { x: 8, y: 108 };
    });
    const dragOff = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPos((p) => ({
            x: p.x,
            y: p.y,
        }));
    }, []);

    const clamp = (x: number, y: number) => {
        const el = rootRef.current;
        const w = el?.offsetWidth ?? 420;
        const h = el?.offsetHeight ?? 300;
        const maxX = Math.max(0, window.innerWidth - w);
        const maxY = Math.max(0, window.innerHeight - h);
        return {
            x: Math.min(Math.max(0, x), maxX),
            y: Math.min(Math.max(0, y), maxY),
        };
    };

    const onDrag = (e: MouseEvent) =>
        setPos(
            clamp(
                e.clientX - dragOff.current.dx,
                e.clientY - dragOff.current.dy
            )
        );

    const endDrag = () => {
        setDragging(false);
        document.body.classList.remove("no-select");
        window.removeEventListener("mousemove", onDrag as any);
        window.removeEventListener("mouseup", endDrag as any);
    };

    const startDrag = (e: React.MouseEvent) => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        dragOff.current = {
            dx: e.clientX - rect.left,
            dy: e.clientY - rect.top,
        };
        setDragging(true);
        document.body.classList.add("no-select");
        window.addEventListener("mousemove", onDrag as any);
        window.addEventListener("mouseup", endDrag as any);
    };

    /** ======== UI ======== */
    const canAddMorePresets = presets.length < MAX_PRESETS;
    const canDeleteThisPreset = presets.length > 1;

    const [renameText, setRenameText] = useState(activePreset?.name || "");
    useEffect(
        () => setRenameText(activePreset?.name || ""),
        [activePreset?.id]
    );

    return (
        <>
            <div
                ref={rootRef}
                className={`macros-view enter-left ${dragging ? "dragging" : ""}`}
                role="dialog"
                aria-modal="true"
                style={{
                    position: "fixed",
                    left: pos.x,
                    top: pos.y,
                    right: "auto",
                    bottom: "auto",
                }}
            >
                <div
                    className="header"
                    onMouseDown={startDrag}
                    aria-grabbed={dragging}
                >
                    <span>Macros</span>
                    <button
                        className="c-button close-button"
                        onClick={onClose}
                        aria-label="Close"
                        type="button"
                    >
                        ×
                    </button>
                </div>

                <div className="tabs">
                    <button className="tab active" type="button">
                        My Macros
                    </button>
                    <button
                        className="tab add"
                        type="button"
                        onClick={addPreset}
                        disabled={!canAddMorePresets}
                        title={
                            canAddMorePresets
                                ? "New preset"
                                : "Maximum 5 presets"
                        }
                    >
                        +
                    </button>
                </div>

                <div className="content">
                    <div className="row between">
                        <div className="toggle-wrap">
                            <span>Toggle Macros</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) =>
                                        setEnabled(e.target.checked)
                                    }
                                />
                                <span className="slider" />
                            </label>
                        </div>

                        <div className="preset-wrap">
                            <select
                                className="preset-select"
                                value={activePreset?.id || ""}
                                onChange={(e) =>
                                    setActivePresetId(e.target.value)
                                }
                                aria-label="Select preset"
                            >
                                {presets.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>

                            <input
                                className="preset-rename"
                                value={renameText}
                                onChange={(e) => setRenameText(e.target.value)}
                                onBlur={() =>
                                    activePreset &&
                                    renamePreset(activePreset.id, renameText)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                        e.currentTarget.blur();
                                }}
                                placeholder="Preset name"
                            />

                            <div className="preset-actions">
                                <button
                                    className="habbo-green-btn"
                                    type="button"
                                    onClick={openAddModal}
                                    title="Add macro"
                                >
                                    Add
                                </button>

                                <button
                                    className="habbo-red-btn"
                                    onClick={() =>
                                        canDeleteThisPreset &&
                                        activePreset &&
                                        deletePreset(activePreset.id)
                                    }
                                    disabled={!canDeleteThisPreset}
                                    title={
                                        canDeleteThisPreset
                                            ? "Delete preset"
                                            : "Keep at least one preset"
                                    }
                                    type="button"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>

                    {macros.length === 0 ? (
                        <div className="empty-card">
                            No macros set in{" "}
                            <b>
                                {(
                                    activePreset?.name || "default"
                                ).toLowerCase()}
                            </b>
                            .
                            <button
                                className="habbo-link"
                                type="button"
                                onClick={openAddModal}
                                style={{ marginLeft: 8 }}
                            >
                                Add one now
                            </button>
                        </div>
                    ) : (
                        <div className="macro-list">
                            {macros.map((m) => (
                                <div className="macro-row" key={m.id}>
                                    <div className="key-chip">{m.trigger}</div>
                                    <input
                                        className="cmd-input"
                                        value={m.script}
                                        onChange={(e) =>
                                            updateMacro(m.id, {
                                                script: e.target.value,
                                            })
                                        }
                                        placeholder=":stun x; wait 150; :cuff x | ui:inventory"
                                    />
                                    <button
                                        className="habbo-red-btn"
                                        onClick={() => removeMacro(m.id)}
                                        type="button"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {modalOpen && (
                <div
                    className="macro-modal enter-br"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="modal-header">
                        <span>Add New Macro</span>
                        <button
                            className="close-button"
                            onClick={() => {
                                setModalOpen(false);
                                setCapturedTrigger("");
                                setNewScript("");
                                setCaptureArmed(false);
                            }}
                            aria-label="Close"
                            type="button"
                        >
                            ×
                        </button>
                    </div>

                    <div className="modal-body">
                        <button
                            className={`capture ${captureArmed ? "armed" : ""}`}
                            onClick={() => setCaptureArmed(true)}
                            title="Click then press a key or click mouse / wheel"
                            type="button"
                        >
                            {capturedTrigger
                                ? capturedTrigger
                                : "Press key or click mouse"}
                        </button>

                        <input
                            className="macro-command"
                            placeholder="Enter macro script (newline or ;). Use ui:inventory, wait 150"
                            value={newScript}
                            onChange={(e) => setNewScript(e.target.value)}
                        />

                        <div className="modal-actions">
                            <button
                                className="habbo-green-btn"
                                onClick={confirmAdd}
                                disabled={!capturedTrigger || !newScript.trim()}
                                type="button"
                            >
                                Add Macro
                            </button>

                            <button
                                className="habbo-red-btn"
                                onClick={() => {
                                    setCapturedTrigger("");
                                    setNewScript("");
                                    setCaptureArmed(false);
                                }}
                                type="button"
                            >
                                Reset Keys
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MacroView;
