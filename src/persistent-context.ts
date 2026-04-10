import type { PersistentContextItem } from "./chat-session";

export function addPersistentContextItem(
  items: ReadonlyArray<PersistentContextItem>,
  nextItem: PersistentContextItem
): PersistentContextItem[] {
  if (items.some((item) => item.kind === nextItem.kind && item.path === nextItem.path)) {
    return [...items];
  }

  return [...items, nextItem];
}

export function removePersistentContextItem(
  items: ReadonlyArray<PersistentContextItem>,
  path: string
): PersistentContextItem[] {
  return items.filter((item) => item.path !== path);
}

export function clearPersistentContextItems(
  _items: ReadonlyArray<PersistentContextItem>
): PersistentContextItem[] {
  return [];
}
