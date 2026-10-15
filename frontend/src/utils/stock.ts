/** A product is low on stock when this many units, or fewer, remain. */
export const LOW_STOCK_LIMIT = 5;

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(quantity: number): StockLevel {
  if (quantity <= 0) {
    return "out";
  }
  if (quantity <= LOW_STOCK_LIMIT) {
    return "low";
  }
  return "ok";
}

export function stockStatusLabel(level: StockLevel): string | null {
  if (level === "out") {
    return "Out of stock";
  }
  if (level === "low") {
    return "Low stock";
  }
  return null;
}
