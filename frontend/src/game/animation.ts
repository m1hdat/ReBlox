// Tween tối giản. Hoạt ảnh CHỈ là trình diễn: state logic đã được backend quyết định trước đó.
export const settings = {
  reducedMotion: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  speed: 1,
};

export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  in: (t: number) => t * t,
};

/** Chạy onUpdate(t∈[0,1]) trong `ms` mili-giây; resolve khi xong. Giảm chuyển động => nhảy thẳng tới t=1. */
export function tween(ms: number, onUpdate: (t: number) => void, fn: (t: number) => number = ease.inOut): Promise<void> {
  return new Promise((resolve) => {
    if (settings.reducedMotion || ms <= 0) { onUpdate(1); resolve(); return; }
    const dur = ms / settings.speed;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      onUpdate(fn(t));
      if (t < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, settings.reducedMotion ? 0 : ms / settings.speed));
