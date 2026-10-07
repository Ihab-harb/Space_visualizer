export interface LabelBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  priority: number;
}

/** Greedy declutter: highest priority first; a label shows if it overlaps no label already shown. */
export function resolveOverlaps(boxes: readonly LabelBox[], paddingPx = 4): Set<string> {
  const ordered = [...boxes].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const accepted: LabelBox[] = [];
  const hit = (a: LabelBox, b: LabelBox) =>
    a.left - paddingPx < b.left + b.width && b.left - paddingPx < a.left + a.width && a.top - paddingPx < b.top + b.height && b.top - paddingPx < a.top + a.height;
  for (const box of ordered) if (!accepted.some((a) => hit(a, box))) accepted.push(box);
  return new Set(accepted.map((b) => b.id));
}

export function labelPriority(input: { selected: boolean; hovered: boolean; pixelRadius: number }): number {
  return (input.selected ? 1e7 : 0) + (input.hovered ? 1e6 : 0) + Math.min(input.pixelRadius, 1e5);
}
