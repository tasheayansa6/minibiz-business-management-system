import { useEffect, useState } from "react";
import type { PageName } from "../components/Layout";
import { Icon } from "../components/icons";
import { Alert, Badge, Button, Card, EmptyState, Field, LoadingBlock, PageHeader } from "../components/ui";
import { createSale, getProduct, getProducts } from "../services/api";
import type { Product, Sale } from "../types";
import { messageFrom } from "../utils/errors";
import { formatMoney } from "../utils/format";
import { stockLevel, stockStatusLabel } from "../utils/stock";
import { saleFieldErrors, type FieldErrors } from "../utils/validate";

function availabilityError(available: number): string {
  if (available <= 0) {
    return "This product is out of stock.";
  }
  return `Only ${available} ${available === 1 ? "unit is" : "units are"} in stock.`;
}

export function Sales({ onNavigate }: { onNavigate: (page: PageName) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProducts()
      .then((rows) => {
        if (active) {
          setProducts(rows);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProducts([]);
          setLoadError(messageFrom(error, "Products could not be loaded."));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [requestId]);

  const selected = products.find((product) => product.id === productId);
  const quantityIsWhole = /^\d+$/.test(quantity.trim());
  const quantityNumber = quantityIsWhole ? Number(quantity.trim()) : 0;
  const stockWarning =
    selected && quantityIsWhole && quantityNumber > selected.stock_quantity
      ? availabilityError(selected.stock_quantity)
      : null;
  const quantityError = fieldErrors.quantity || stockWarning || undefined;
  const previewTotal =
    selected && quantityNumber > 0 ? (Number(selected.price) * quantityNumber).toFixed(2) : null;
  const level = selected ? stockLevel(selected.stock_quantity) : "ok";
  const status = stockStatusLabel(level);

  function clearField(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  async function recordSale() {
    const errors = saleFieldErrors(productId, quantity);
    setFieldErrors(errors);
    setFormError(null);
    setResult(null);
    if (Object.keys(errors).length > 0 || !selected) {
      return;
    }

    const soldQuantity = Number(quantity.trim());
    if (soldQuantity > selected.stock_quantity) {
      setFieldErrors({
        quantity: availabilityError(selected.stock_quantity),
      });
      return;
    }

    setSaving(true);
    try {
      const sale: Sale = await createSale({
        product_id: selected.id,
        quantity: soldQuantity,
      });
      let stockNote = "";
      try {
        const updated = await getProduct(selected.id);
        setProducts((current) =>
          current.map((product) => (product.id === updated.id ? updated : product)),
        );
        stockNote = ` Stock is now ${updated.stock_quantity}.`;
      } catch {
        setProducts((current) =>
          current.map((product) =>
            product.id === selected.id
              ? { ...product, stock_quantity: Math.max(0, product.stock_quantity - soldQuantity) }
              : product,
          ),
        );
      }
      setResult(
        `Recorded ${sale.quantity} × ${selected.name} for ${formatMoney(sale.total_amount)}.${stockNote}`,
      );
      setQuantity("1");
      setFieldErrors({});
    } catch (error: unknown) {
      setFormError(messageFrom(error, "The sale could not be recorded."));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    if (saving) {
      return;
    }
    setProductId("");
    setQuantity("1");
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <section>
      <PageHeader
        title="Sales"
        description="Choose a product, enter a quantity, and confirm the total. MiniBiz uses the stored price and reduces stock when the sale is completed."
      />

      {loading && <LoadingBlock label="Loading products..." />}

      {!loading && loadError && (
        <Alert
          tone="error"
          action={
            <Button
              type="button"
              onClick={() => {
                setLoadError(null);
                setLoading(true);
                setRequestId((current) => current + 1);
              }}
            >
              Try again
            </Button>
          }
        >
          <p>{loadError}</p>
        </Alert>
      )}

      {!loading && !loadError && products.length === 0 && (
        <Card>
          <EmptyState
            icon={<Icon name="products" />}
            title="Add a product before recording a sale"
            description="Sales use a product's current price and available stock."
            action={
              <Button type="button" onClick={() => onNavigate("products")}>
                Add product
              </Button>
            }
          />
        </Card>
      )}

      {!loading && !loadError && products.length > 0 && (
        <>
          {result && (
            <Alert tone="success" onDismiss={() => setResult(null)}>
              <p>{result}</p>
            </Alert>
          )}
          <div className="sale-layout">
            <Card className="sale-form">
              <form
                className="stack-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void recordSale();
                }}
              >
                <Field label="Product" htmlFor="sale-product" required error={fieldErrors.product_id}>
                  <select
                    className="control"
                    value={productId}
                    onChange={(event) => {
                      setProductId(event.target.value);
                      clearField("product_id");
                    }}
                  >
                    <option value="">Choose a product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — {product.stock_quantity} in stock — {formatMoney(product.price)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Quantity"
                  htmlFor="sale-quantity"
                  required
                  error={quantityError}
                  hint={
                    selected
                      ? `${selected.stock_quantity} ${selected.stock_quantity === 1 ? "unit" : "units"} available at ${formatMoney(selected.price)}.`
                      : "Choose a product to see how many units are available."
                  }
                >
                  <input
                    className="control"
                    inputMode="numeric"
                    autoComplete="off"
                    value={quantity}
                    onChange={(event) => {
                      setQuantity(event.target.value);
                      clearField("quantity");
                    }}
                  />
                </Field>
                {formError && (
                  <Alert tone="error">
                    <p>{formError}</p>
                  </Alert>
                )}
                <div className="dialog-actions">
                  <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
                    Clear
                  </Button>
                  <Button className="sale-submit" type="submit" disabled={saving}>
                    {saving && <span className="spinner" aria-hidden="true" />}
                    {saving ? "Completing sale..." : "Complete sale"}
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="summary-card" title="Sale summary" description="Checked against current stock before the sale is completed.">
              {!selected ? (
                <p className="summary-empty">Choose a product to see the unit price, available stock, and total.</p>
              ) : (
                <>
                  <div className="summary-heading">
                    <div>
                      <p className="summary-product">{selected.name}</p>
                      <p className="summary-category">{selected.category}</p>
                    </div>
                    {status && <Badge tone={level === "out" ? "danger" : "warning"}>{status}</Badge>}
                  </div>
                  <dl className="summary-rows">
                    <div className="summary-row">
                      <dt>Unit price</dt>
                      <dd>{formatMoney(selected.price)}</dd>
                    </div>
                    <div className={stockWarning ? "summary-row is-warning" : "summary-row"}>
                      <dt>Available</dt>
                      <dd>
                        {selected.stock_quantity} {selected.stock_quantity === 1 ? "unit" : "units"}
                      </dd>
                    </div>
                    <div className="summary-row">
                      <dt>Quantity</dt>
                      <dd>{quantityNumber > 0 ? quantityNumber : "Enter a quantity"}</dd>
                    </div>
                    <div className="summary-row summary-total">
                      <dt>Total</dt>
                      <dd>{previewTotal ? formatMoney(previewTotal) : "Enter a quantity"}</dd>
                    </div>
                  </dl>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
