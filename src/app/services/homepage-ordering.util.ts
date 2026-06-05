export interface OrderedEntity {
  order?: number | null;
}

interface IndexedItem<T> {
  item: T;
  index: number;
  normalizedOrder: number | null;
}

function normalizeOrderValue(order: number | null | undefined): number | null {
  return Number.isInteger(order) && Number(order) > 0 ? Number(order) : null;
}

export function sortByStableDisplayOrder<T extends OrderedEntity>(items: T[]): T[] {
  if (!Array.isArray(items) || items.length < 2) {
    return Array.isArray(items) ? [...items] : [];
  }

  const indexedItems: IndexedItem<T>[] = items.map((item, index) => ({
    item,
    index,
    normalizedOrder: normalizeOrderValue(item.order)
  }));

  const orderCounts = new Map<number, number>();
  for (const entry of indexedItems) {
    if (entry.normalizedOrder !== null) {
      orderCounts.set(entry.normalizedOrder, (orderCounts.get(entry.normalizedOrder) || 0) + 1);
    }
  }

  const uniquelyOrdered: IndexedItem<T>[] = [];
  const missingOrInvalidOrder: IndexedItem<T>[] = [];
  const duplicateOrder: IndexedItem<T>[] = [];

  for (const entry of indexedItems) {
    if (entry.normalizedOrder === null) {
      missingOrInvalidOrder.push(entry);
      continue;
    }

    if ((orderCounts.get(entry.normalizedOrder) || 0) > 1) {
      duplicateOrder.push(entry);
      continue;
    }

    uniquelyOrdered.push(entry);
  }

  uniquelyOrdered.sort((a, b) => (a.normalizedOrder || 0) - (b.normalizedOrder || 0));

  return [...uniquelyOrdered, ...missingOrInvalidOrder, ...duplicateOrder].map(({ item }) => item);
}
