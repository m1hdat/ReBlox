export const icon = (name: string, size = 24) => {
  const paths: Record<string, string> = {
    play: '<path d="m9 5 11 7-11 7Z"/>',
    back: '<path d="m14 6-6 6 6 6M8 12h13"/>',
    gear: '<path d="m10 3-.6 3-2 .8-2.5-1.6-2 3.4 2.2 1.9v2.4L3 15l2 3.4L7.5 17l2 .8.5 3.2h4l.6-3.1 2-.8 2.4 1.5 2-3.4-2.2-1.9v-2.4L21 9l-2-3.4-2.5 1.5-2-.8L14 3Z"/><circle cx="12" cy="12" r="3"/>',
    restart: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    "rotate-left": '<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
    "rotate-right": '<path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6"/>',
    top: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    view: '<path d="m12 3 9 5v8l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v8"/>',
    book: '<path d="M5 3h14v18H6a3 3 0 0 1 0-6h13M7 3v12M10 7h6M10 10h4"/>',
    wrench: '<path d="m14 5 4 4 3-3a6 6 0 0 1-7.6 7.6L6 21l-3-3 7.4-7.4A6 6 0 0 1 18 3Z"/>',
    shelf: '<path d="M3 5h18M3 12h18M3 20h18M5 5v15M19 5v15M8 8h3v4M14 15h3v5"/>',
    lab: '<path d="M8 3h8M10 3v7l-6 9c-.6 1 0 2 1 2h14c1 0 1.6-1 1-2l-6-9V3M7 16h10"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    hint: '<path d="M9 18h6M10 21h4M9 15c0-2-4-3-4-7a7 7 0 1 1 14 0c0 4-4 5-4 7Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.wrench}</svg>`;
};
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
