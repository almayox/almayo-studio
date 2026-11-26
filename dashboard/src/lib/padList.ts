/** A list made exactly `count` long: cut if longer, filled with empty rows if shorter. */
export function padList<T>(items: T[], count: number, empty: () => T): T[] {
  const next = [...items];
  while (next.length < count) next.push(empty());
  return next.slice(0, count);
}
