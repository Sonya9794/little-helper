export interface Rect { x: number; y: number; width: number; height: number }
export function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
export function choiceLayout(width: number, height: number, mascot: Rect, count: number): Rect[] {
  const margin = 12, gap = 10, w = 170, h = 48;
  const cx = mascot.x + mascot.width / 2, cy = mascot.y + mascot.height / 2;
  // Rectangular pills need explicit clearance on at least one axis. An ellipse
  // can overlap the mascot at diagonal angles even with ample desktop space.
  const at = (x: number, y: number): Rect => ({ x, y, width: w, height: h });
  const top = mascot.y - gap - h, bottom = mascot.y + mascot.height + gap;
  const above = at(cx - w / 2, top), below = at(cx - w / 2, bottom);
  const leftSide = at(mascot.x - gap - w, cy - h / 2), rightSide = at(mascot.x + mascot.width + gap, cy - h / 2);
  const topLeft = at(cx - w - gap / 2, top), topRight = at(cx + gap / 2, top);
  const bottomLeft = at(cx - w - gap / 2, bottom), bottomRight = at(cx + gap / 2, bottom);
  const rings: Record<number, Rect[]> = {
    3: [above, rightSide, leftSide],
    4: [above, rightSide, below, leftSide],
    5: [above, rightSide, bottomRight, bottomLeft, leftSide],
    6: [topLeft, topRight, rightSide, bottomRight, bottomLeft, leftSide],
  };
  const ring = rings[count] ?? [];
  if (ring.length === count && ring.every((r, i) => r.x >= margin && r.y >= margin && r.x + w <= width - margin && r.y + h <= height - margin && !overlaps(r, mascot, gap) && ring.every((other, j) => i === j || !overlaps(r, other, 4)))) return ring;
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
