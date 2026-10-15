/** Checks that match the FastAPI product and sale rules. */

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export type ProductFormValues = {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
};

export type FieldErrors = Record<string, string>;

export function moneyError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter a price.";
  }
  if (!MONEY_PATTERN.test(trimmed)) {
    return "Use a price like 120.50, with at most two decimal places.";
  }
  const digits = trimmed.replace(".", "");
  if (digits.length > 10) {
    return "Price can have at most 10 digits.";
  }
  if (Number(trimmed) <= 0) {
    return "Price must be greater than 0.";
  }
  return null;
}

export function integerError(value: string, label: string, minimum: number): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `Enter ${label.toLowerCase()}.`;
  }
  if (!/^\d+$/.test(trimmed)) {
    return `${label} must be a whole number.`;
  }
  if (Number(trimmed) < minimum) {
    return minimum === 0
      ? `${label} cannot be negative.`
      : `${label} must be at least ${minimum}.`;
  }
  return null;
}

export function productFieldErrors(values: ProductFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const category = values.category.trim();
  const description = values.description.trim();

  if (!name) {
    errors.name = "Enter a product name.";
  } else if (name.length > 200) {
    errors.name = "Name must be 200 characters or fewer.";
  }

  if (description.length > 2000) {
    errors.description = "Description must be 2,000 characters or fewer.";
  }

  if (!category) {
    errors.category = "Enter a category.";
  } else if (category.length > 100) {
    errors.category = "Category must be 100 characters or fewer.";
  }

  const price = moneyError(values.price);
  if (price) {
    errors.price = price;
  }

  const stock = integerError(values.stock, "Stock", 0);
  if (stock) {
    errors.stock = stock;
  }

  return errors;
}

export function saleFieldErrors(productId: string, quantity: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!OBJECT_ID_PATTERN.test(productId)) {
    errors.product_id = "Choose a product.";
  }
  const quantityError = integerError(quantity, "Quantity", 1);
  if (quantityError) {
    errors.quantity = quantityError;
  }
  return errors;
}

export function optionalStockLimit(value: string): { limit?: number; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Maximum stock must be a whole number." };
  }
  return { limit: Number(trimmed) };
}
