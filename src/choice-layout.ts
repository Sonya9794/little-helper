export interface Rect { x: number; y: number; width: number; height: number }
export function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
export function choiceLayout(width: number, height: number, mascot: Rect, count: number): Rect[] {
  const margin = 12, gap = 10, w = 170, h = 48;
  const cx = mascot.x + mascot.width / 2, cy = mascot.y + mascot.height / 2;
  const rx = (mascot.width / 2 + w / 2 + gap) * (count === 3 ? 1.2 : 1.1);
  const ry = (mascot.height / 2 + h / 2 + gap) * 1.24;
  const ring = Array.from({ length: count }, (_, i) => {
    const angle = ((count === 3 ? -90 : -126) + i * 360 / count) * Math.PI / 180;
    return { x: cx + Math.cos(angle) * rx - w / 2, y: cy + Math.sin(angle) * ry - h / 2, width: w, height: h };
  });
  if (ring.every((r, i) => r.x >= margin && r.y >= margin && r.x + w <= width - margin && r.y + h <= height - margin && !overlaps(r, mascot, gap) && ring.every((other, j) => i === j || !overlaps(r, other, 4)))) return ring;
  // At screen edges, gather the choices on the side with the most room.
  const left = mascot.x - gap - margin, right = width - margin - (mascot.x + mascot.width + gap);
  const useRight = right >= left;
  const bw = Math.min(w, Math.max(1, useRight ? right : left));
  const bh = Math.min(h, Math.max(1, (height - margin * 2 - (count - 1) * gap) / count));
  const x = useRight ? mascot.x + mascot.width + gap : mascot.x - gap - bw;
  const total = count * bh + (count - 1) * gap;
  const y = Math.max(margin, Math.min(cy - total / 2, height - margin - total));
  return Array.from({ length: count }, (_, i) => ({ x, y: y + i * (bh + gap), width: bw, height: bh }));
}
