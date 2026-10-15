import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  SearchField,
  TopBarSlot,
} from "../components/ui";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../services/api";
import type { Product } from "../types";
import { messageFrom } from "../utils/errors";
import { formatMoney } from "../utils/format";
import { stockLevel, stockStatusLabel } from "../utils/stock";
import {
  optionalStockLimit,
  productFieldErrors,
  type FieldErrors,
  type ProductFormValues,
} from "../utils/validate";

const emptyForm: ProductFormValues = {
  name: "",
  description: "",
  category: "general",
  price: "",
  stock: "",
};

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormValues>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [appliedMaxStock, setAppliedMaxStock] = useState<number | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setAppliedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let active = true;
    if (loadedOnce.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    getProducts({
      search: appliedSearch,
      category: appliedCategory,
      max_stock: appliedMaxStock,
    })
      .then((rows) => {
        if (active) {
          setProducts(rows);
          setListError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProducts([]);
          setListError(messageFrom(error, "The request could not be completed."));
        }
      })
      .finally(() => {
        if (active) {
          loadedOnce.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [appliedSearch, appliedCategory, appliedMaxStock, reloadKey]);

  function updateField(field: keyof ProductFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function closeForm() {
    if (saving) {
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
    setFormError(null);
    setFormOpen(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
    setFormError(null);
    setPendingDeleteId(null);
    setDeleteError(null);
    setFormOpen(true);
  }

  function applyFilters() {
    const parsed = optionalStockLimit(maxStock);
    if (parsed.error) {
      setFilterError(parsed.error);
      return;
    }
    setFilterError(null);
    setAppliedSearch(search.trim());
    setAppliedCategory(categoryFilter.trim());
    setAppliedMaxStock(parsed.limit);
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("");
    setMaxStock("");
    setFilterError(null);
    setAppliedSearch("");
    setAppliedCategory("");
    setAppliedMaxStock(undefined);
  }

  async function saveProduct() {
    const errors = productFieldErrors(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      price: form.price.trim(),
      stock_quantity: Number(form.stock.trim()),
    };

    setSaving(true);
    setNotice(null);
    setFormError(null);
    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        setNotice("Product updated.");
      } else {
        await createProduct(payload);
        setNotice("Product added.");
      }
      setForm(emptyForm);
      setEditingId(null);
      setFieldErrors({});
      setFormError(null);
      setFormOpen(false);
      setReloadKey((current) => current + 1);
    } catch (error: unknown) {
      setFormError(messageFrom(error, "The request could not be completed."));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setPendingDeleteId(null);
    setDeleteError(null);
    setFieldErrors({});
    setFormError(null);
    setFormOpen(true);
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      stock: String(product.stock_quantity),
    });
  }

  function askDelete(product: Product) {
    setDeleteError(null);
    setPendingDeleteId(product.id);
  }

  async function confirmDelete(product: Product) {
    setNotice(null);
    setDeleteError(null);
    setSaving(true);
    try {
      await deleteProduct(product.id);
      if (editingId === product.id) {
        setForm(emptyForm);
        setEditingId(null);
        setFieldErrors({});
        setFormError(null);
        setFormOpen(false);
      }
      setPendingDeleteId(null);
      setNotice(`${product.name} was deleted.`);
      setReloadKey((current) => current + 1);
    } catch (error: unknown) {
      setDeleteError(messageFrom(error, "The request could not be completed."));
    } finally {
      setSaving(false);
    }
  }

  const pendingProduct = products.find((product) => product.id === pendingDeleteId) ?? null;
  const filtersActive =
    appliedSearch !== "" || appliedCategory !== "" || appliedMaxStock !== undefined;

  return (
    <section>
      <TopBarSlot>
        <form
          className="top-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <SearchField
            id="product-search"
            label="Search by product name"
            placeholder="Search by product name"
            value={search}
            onChange={setSearch}
          />
        </form>
      </TopBarSlot>

      <PageHeader
        title="Products"
        description="Search the catalog, filter by category or stock, and keep inventory current."
        actions={
          <Button type="button" onClick={openCreate}>
            <Icon name="plus" size={16} />
            Add product
          </Button>
        }
      />

      <Dialog
        open={formOpen}
        title={editingId ? "Edit product" : "New product"}
        description={
          editingId
            ? "Update the catalog details for this product."
            : "Add a product to the catalog. Price is stored in ETB."
        }
        onClose={closeForm}
      >
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProduct();
          }}
        >
          <p className="required-note span-2">Required fields are marked with an asterisk.</p>
          <Field label="Name" htmlFor="product-name" required error={fieldErrors.name}>
            <input
              className="control"
              value={form.name}
              autoComplete="off"
              onChange={(event) => updateField("name", event.target.value)}
            />
          </Field>
          <Field label="Category" htmlFor="product-category" required error={fieldErrors.category}>
            <input
              className="control"
              value={form.category}
              autoComplete="off"
              onChange={(event) => updateField("category", event.target.value)}
            />
          </Field>
          <Field
            label="Price (ETB)"
            htmlFor="product-price"
            required
            error={fieldErrors.price}
            hint="Use a value like 120.50."
          >
            <input
              className="control"
              inputMode="decimal"
              autoComplete="off"
              value={form.price}
              onChange={(event) => updateField("price", event.target.value)}
            />
          </Field>
          <Field
            label="Stock"
            htmlFor="product-stock"
            required
            error={fieldErrors.stock}
            hint="Whole number. Use 0 if none are on hand."
          >
            <input
              className="control"
              inputMode="numeric"
              autoComplete="off"
              value={form.stock}
              onChange={(event) => updateField("stock", event.target.value)}
            />
          </Field>
          <Field
            className="span-2"
            label="Description"
            htmlFor="product-description"
            error={fieldErrors.description}
            hint="Optional. Up to 2,000 characters."
          >
            <textarea
              className="control"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </Field>
          {formError && (
            <div className="span-2">
              <Alert tone="error">
                <p>{formError}</p>
              </Alert>
            </div>
          )}
          <div className="dialog-actions span-2">
            <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <span className="spinner" aria-hidden="true" />}
              {saving ? "Saving..." : editingId ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={pendingProduct !== null}
        size="sm"
        title="Delete product"
        description={
          pendingProduct
            ? `${pendingProduct.name} will be removed from inventory. Sales already recorded stay in history.`
            : undefined
        }
        focusSelector="#keep-product"
        onClose={() => {
          if (!saving) {
            setPendingDeleteId(null);
            setDeleteError(null);
          }
        }}
      >
        {deleteError && (
          <Alert tone="error">
            <p>{deleteError}</p>
          </Alert>
        )}
        <div className="dialog-actions">
          <Button
            id="keep-product"
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              setPendingDeleteId(null);
              setDeleteError(null);
            }}
          >
            Keep product
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={saving || !pendingProduct}
            onClick={() => {
              if (pendingProduct) {
                void confirmDelete(pendingProduct);
              }
            }}
          >
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? "Deleting..." : "Delete product"}
          </Button>
        </div>
      </Dialog>

      <Card className="filter-card">
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <Field label="Category" htmlFor="filter-category">
            <input
              className="control"
              value={categoryFilter}
              placeholder="Exact category"
              autoComplete="off"
              onChange={(event) => setCategoryFilter(event.target.value)}
            />
          </Field>
          <Field label="Maximum stock" htmlFor="filter-max-stock" error={filterError ?? undefined}>
            <input
              className="control"
              inputMode="numeric"
              value={maxStock}
              placeholder="At or below"
              autoComplete="off"
              onChange={(event) => {
                setMaxStock(event.target.value);
                setFilterError(null);
              }}
            />
          </Field>
          <div className="filter-actions">
            <Button type="submit">Apply filters</Button>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </form>
        <p className="filter-note">
          Name search updates as you type. Category must match the full name. Maximum stock shows products at or below that number.
        </p>
      </Card>

      {notice && (
        <Alert tone="success" onDismiss={() => setNotice(null)}>
          <p>{notice}</p>
        </Alert>
      )}
      {!loading && listError && (
        <Alert
          tone="error"
          action={
            <Button
              type="button"
              onClick={() => {
                setListError(null);
                setLoading(true);
                setReloadKey((current) => current + 1);
              }}
            >
              Try again
            </Button>
          }
        >
          <p>{listError}</p>
        </Alert>
      )}

      {loading && <LoadingBlock label="Loading products..." />}

      {!loading && !listError && (
        <p className="result-meta" role="status">
          {refreshing
            ? "Updating products..."
            : `${products.length} ${products.length === 1 ? "product" : "products"}`}
        </p>
      )}

      {!loading && !listError && products.length === 0 && (
        <Card>
          <EmptyState
            icon={<Icon name="products" />}
            title={filtersActive ? "No matching products" : "No products yet"}
            description={
              filtersActive
                ? "Try a different name, category, or stock limit."
                : "Add a product to start tracking inventory and sales."
            }
            action={
              filtersActive ? (
                <Button type="button" variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button type="button" onClick={openCreate}>
                  Add product
                </Button>
              )
            }
          />
        </Card>
      )}

      {!loading && !listError && products.length > 0 && (
        <Card>
          <div className="table-wrap">
            <table className="data-table" aria-busy={refreshing}>
              <caption className="sr-only">Product inventory</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th className="num" scope="col">Price</th>
                  <th className="num" scope="col">Available stock</th>
                  <th className="actions" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const level = stockLevel(product.stock_quantity);
                  const status = stockStatusLabel(level);
                  return (
                    <tr key={product.id}>
                      <td data-label="Product">
                        <div className="cell-title">{product.name}</div>
                        {product.description && (
                          <p className="cell-sub" title={product.description}>
                            {product.description}
                          </p>
                        )}
                      </td>
                      <td data-label="Category">
                        <Badge>{product.category}</Badge>
                      </td>
                      <td className="num money" data-label="Price">
                        {formatMoney(product.price)}
                      </td>
                      <td className="num" data-label="Available stock">
                        <div className="stock-cell">
                          <span>{product.stock_quantity}</span>
                          {status && <Badge tone={level === "out" ? "danger" : "warning"}>{status}</Badge>}
                        </div>
                      </td>
                      <td className="actions" data-label="Actions">
                        <div className="row-actions">
                          <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(product)}>
                            <Icon name="edit" size={14} />
                            Edit
                          </Button>
                          <Button type="button" variant="danger" size="sm" onClick={() => askDelete(product)}>
                            <Icon name="trash" size={14} />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
