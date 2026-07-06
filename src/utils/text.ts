/** 「。」の直後で文を分割する（句点は各文に残す） */
export function splitJapaneseSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/(?<=。)/u).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [trimmed];
}
