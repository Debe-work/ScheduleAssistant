export function areAllTimelineCardsExpanded(rowKeys: string[], expandedCardKeys: string[]): boolean {
  if (rowKeys.length === 0) return false;
  const expandedKeySet = new Set(expandedCardKeys);
  return rowKeys.every((key) => expandedKeySet.has(key));
}
