// Group helper constants & utilities

/** Group labels: A, B, C, D, ... */
export const GROUP_LABELS = "ABCDEFGH".split("");

/** Get the label for a group index (0 → "A", 1 → "B", etc.) */
export function groupLabel(index: number): string {
  return GROUP_LABELS[index] ?? String(index + 1);
}

/** Build an array of group labels for a given count */
export function groupLabels(count: number): string[] {
  return GROUP_LABELS.slice(0, count);
}

/** Check if a group value is a real group (not "waiting" or undefined) */
export function isGroupLabel(group: string | undefined): boolean {
  return !!group && group !== "waiting";
}
