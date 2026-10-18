import type { ActionName } from "../api/client";

const KEYS: Record<string, ActionName> = {
  ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
  w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT", W: "UP", S: "DOWN", A: "LEFT", D: "RIGHT",
};

export function bindKeyboard(onAction: (a: ActionName) => void) {
  window.addEventListener("keydown", (e) => {
    const a = KEYS[e.key];
    if (!a || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target?.closest("input, select, textarea, button, summary, [contenteditable=true]")) return;
    if (e.repeat) return;
    e.preventDefault();
    onAction(a);
  });
}
