export function todayString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
