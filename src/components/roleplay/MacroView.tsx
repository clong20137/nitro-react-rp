import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import "./MacroView.scss";

/** ========= Types & storage keys ========= */
type KeyString = string; // e.g. "F1", "KeyG", "Digit1", "ArrowUp"
type Macro = { id: string; key: KeyString; command: string };
type Preset = { id: string; name: string; macros: Macro[] };

const LS_PRESETS = "olrp.macros.presets.v1";
const LS_ENABLED = "olrp.macros.enabled.v1";
const LS_ACTIVE = "olrp.macros.activePreset.v1";
const MAX_PRESETS = 5;

function uid() {
    return Math.random().toString(36).slice(2, 10);
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

/** Broadcast to ChatInputView (same-tab immediate hydration) */
function broadcastMacrosChanged() {
    try {
        window.dispatchEvent(new CustomEvent("olrp_macros_changed"));
    } catch {}
}

export interface MacroViewProps {
    onClose: () => void;
    onSendCommand?: (command: string) => void;
}

export const MacroView: FC<MacroViewProps> = ({ onClose, onSendCommand }) => {
    /** ======== State / persistence ======== */
    const [enabled, setEnabled] = useState<boolean>(() => {
        try {
            return JSON.parse(localStorage.getItem(LS_ENABLED) || "true");
        } catch {
            return true;
        }
    });

    const [presets, setPresets] = useState<Preset[]>(() => {
        try {
            const raw = localStorage.getItem(LS_PRESETS);
            if (raw) return JSON.parse(raw);
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

    useEffect(() => {
        if (!activePresetId || !presets.find((p) => p.id === activePresetId)) {
            setActivePresetId(presets[0]?.id || "");
        }
    }, [activePresetId, presets]);

    useEffect(() => {
        localStorage.setItem(LS_ENABLED, JSON.stringify(enabled));
        broadcastMacrosChanged();
    }, [enabled]);

    useEffect(() => {
        localStorage.setItem(LS_PRESETS, JSON.stringify(presets));
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

    /** ======== Global Hotkeys (when enabled) ======== */
    const enabledRef = useRef(enabled);
    const macrosRef = useRef<Macro[]>(macros);
    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);
    useEffect(() => {
        macrosRef.current = macros;
    }, [macros]);

    useEffect(() => {
        const onKeydown = (e: KeyboardEvent) => {
            if (!enabledRef.current) return;
            const t = e.target as HTMLElement | null;
            if (
                t &&
                (t.tagName === "INPUT" ||
                    t.tagName === "TEXTAREA" ||
                    t.isContentEditable)
            )
                return;

            const k = eventToKeyString(e);
            if (!k) return;

            const found = macrosRef.current.find((m) => m.key === k);
            if (!found) return;

            e.preventDefault();
            const cmd = found.command.trim();
            if (!cmd) return;

            if (onSendCommand) onSendCommand(cmd);
            else
                window.dispatchEvent(
                    new CustomEvent("macro_run", { detail: { command: cmd } })
                );
        };

        window.addEventListener("keydown", onKeydown);
        return () => window.removeEventListener("keydown", onKeydown);
    }, [onSendCommand]);

    /** ======== Preset CRUD (limited to 5; only rename & delete) ======== */
    const addPreset = () => {
        if (presets.length >= MAX_PRESETS) return; // hard stop at 5
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
        if (presets.length <= 1) return; // keep at least one
        setPresets((prev) => {
            const next = prev.filter((p) => p.id !== id);
            // fix active if needed
            if (!next.find((p) => p.id === activePresetId)) {
                setActivePresetId(next[0]?.id || "");
            }
            return next;
        });
    };

    /** ======== Macro CRUD within active preset (unchanged) ======== */
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
                              ...p.macros.filter((x) => x.key !== m.key),
                              m,
                          ],
                      }
                    : p
            )
        );
    };

    /** ======== Add Macro Modal (same as before) ======== */
    const [modalOpen, setModalOpen] = useState(false);
    const [captureArmed, setCaptureArmed] = useState(false);
    const [capturedKey, setCapturedKey] = useState<KeyString>("");
    const [newCmd, setNewCmd] = useState("");

    useEffect(() => {
        if (!modalOpen || !captureArmed) return;
        const onKey = (e: KeyboardEvent) => {
            const k = eventToKeyString(e);
            if (!k) return;
            e.preventDefault();
            setCapturedKey(k);
            setCaptureArmed(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modalOpen, captureArmed]);

    const confirmAdd = () => {
        const key = capturedKey.trim();
        const cmd = newCmd.trim();
        if (!key || !cmd) return;
        addMacro({ id: uid(), key, command: cmd });
        setModalOpen(false);
        setCapturedKey("");
        setNewCmd("");
        setCaptureArmed(false);
    };

    /** ======== DRAGGABLE (header) ======== */
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const width = 420;
        return { x: Math.max(8, vw - width - 16), y: Math.max(8, vh - 220) };
    });
    const dragOff = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPos((p) => ({
            x: p.x,
            y: Math.max(8, window.innerHeight - rect.height - 16),
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
                className={`macros-view enter-br ${dragging ? "dragging" : ""}`}
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
                        className="close-button"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Tabs (static) */}
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

                            {/* Rename / Delete only */}
                            <input
                                className="preset-rename"
                                value={renameText}
                                onChange={(e) => setRenameText(e.target.value)}
                                onBlur={() =>
                                    renamePreset(activePreset.id, renameText)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.currentTarget.blur();
                                    }
                                }}
                                placeholder="Preset name"
                            />

                            <button
                                className="habbo-red-btn"
                                onClick={() =>
                                    canDeleteThisPreset &&
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

                    {(activePreset?.macros ?? []).length === 0 ? (
                        <div className="empty-card">
                            No macros set in{" "}
                            <b>
                                {(
                                    activePreset?.name || "default"
                                ).toLowerCase()}
                            </b>
                            .
                        </div>
                    ) : (
                        <div className="macro-list">
                            {activePreset!.macros.map((m) => (
                                <div className="macro-row" key={m.id}>
                                    <div className="key-chip">{m.key}</div>
                                    <input
                                        className="cmd-input"
                                        value={m.command}
                                        onChange={(e) =>
                                            updateMacro(m.id, {
                                                command: e.target.value,
                                            })
                                        }
                                        placeholder="/wave"
                                    />
                                    <button
                                        className="habbo-red-btn"
                                        onClick={() => removeMacro(m.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Macro Modal */}
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
                                setCapturedKey("");
                                setNewCmd("");
                                setCaptureArmed(false);
                            }}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    <div className="modal-body">
                        <button
                            className={`capture ${captureArmed ? "armed" : ""}`}
                            onClick={() => setCaptureArmed(true)}
                            title="Click then press a key"
                        >
                            {capturedKey ? capturedKey : "Press a key"}
                        </button>

                        <input
                            className="macro-command"
                            placeholder="Enter macro command"
                            value={newCmd}
                            onChange={(e) => setNewCmd(e.target.value)}
                        />

                        <div className="modal-actions">
                            <button
                                className="habbo-green-btn"
                                onClick={confirmAdd}
                                disabled={!capturedKey || !newCmd.trim()}
                            >
                                Add Macro
                            </button>
                            <button
                                className="habbo-red-btn"
                                onClick={() => {
                                    setCapturedKey("");
                                    setNewCmd("");
                                    setCaptureArmed(false);
                                }}
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
