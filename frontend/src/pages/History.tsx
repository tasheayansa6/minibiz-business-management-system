import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/icons";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  SearchField,
  TopBarSlot,
} from "../components/ui";
import { getProducts, getSales } from "../services/api";
import type { Sale } from "../types";
import { messageFrom } from "../utils/errors";
import { formatDate, formatMoney } from "../utils/format";

function localDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function History() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getSales(), getProducts()])
      .then(([saleRows, productRows]) => {
        if (!active) {
          return;
        }
        setSales(
          [...saleRows].sort(
            (left, right) => new Date(right.sale_date).getTime() - new Date(left.sale_date).getTime(),
          ),
        );
        setNames(new Map(productRows.map((item) => [item.id, item.name])));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(messageFrom(caught, "Sales history could not be loaded."));
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

  function productName(sale: Sale): string {
    return names.get(sale.product_id) ?? "Unknown product";
  }

  const productOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const sale of sales) {
      unique.add(names.get(sale.product_id) ?? "Unknown product");
    }
    return [...unique].sort((left, right) => left.localeCompare(right));
  }, [sales, names]);

  const rangeInvalid = Boolean(from && to && from > to);
  const filtersActive = Boolean(query.trim() || product || from || to);

  const filtered = sales.filter((sale) => {
    const name = productName(sale);
    if (query.trim() && !name.toLowerCase().includes(query.trim().toLowerCase())) {
      return false;
    }
    if (product && name !== product) {
      return false;
    }
    if (!rangeInvalid) {
      const day = localDateKey(sale.sale_date);
      if (from && day < from) {
        return false;
      }
      if (to && day > to) {
        return false;
      }
    }
    return true;
  });

  function clearFilters() {
    setQuery("");
    setProduct("");
    setFrom("");
    setTo("");
  }

  return (
    <section>
      {!loading && !error && sales.length > 0 && (
        <TopBarSlot>
          <form className="top-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <SearchField
              id="history-search"
              label="Search sales by product"
              placeholder="Search by product"
              value={query}
              onChange={setQuery}
            />
          </form>
        </TopBarSlot>
      )}

      <PageHeader
        title="Sales history"
        description="Completed sales, newest first. Search and date filters apply to the records already loaded."
      />

      {loading && <LoadingBlock label="Loading sales..." />}

      {!loading && error && (
        <Alert
          tone="error"
          action={
            <Button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                setRequestId((current) => current + 1);
              }}
            >
              Try again
            </Button>
          }
        >
          <p>{error}</p>
        </Alert>
      )}

      {!loading && !error && sales.length === 0 && (
        <Card>
          <EmptyState
            icon={<Icon name="history" />}
            title="No sales yet"
            description="Completed sales will be listed here with the date, product, quantity, unit price, and total."
          />
        </Card>
      )}

      {!loading && !error && sales.length > 0 && (
        <>
          <Card className="filter-card">
            <form
              className="filters"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <Field label="Product" htmlFor="history-product">
                <select className="control" value={product} onChange={(event) => setProduct(event.target.value)}>
                  <option value="">All products</option>
                  {productOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From" htmlFor="history-from">
                <input className="control" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label="To" htmlFor="history-to" error={rangeInvalid ? "The start date must be on or before the end date." : undefined}>
                <input className="control" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </Field>
              <div className="filter-actions">
                <Button type="button" variant="secondary" onClick={clearFilters} disabled={!filtersActive}>
                  Clear
                </Button>
              </div>
            </form>
          </Card>

          <p className="result-meta">
            {filtersActive
              ? `${filtered.length} of ${sales.length} sales`
              : `${sales.length} ${sales.length === 1 ? "sale" : "sales"}`}
          </p>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Icon name="search" />}
                title="No matching sales"
                description="Try a different product or date range."
                action={
                  <Button type="button" variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card>
              <div className="table-wrap">
                <table className="data-table">
                  <caption className="sr-only">Sales history</caption>
                  <thead>
                    <tr>
                      <th scope="col">Sale date</th>
                      <th scope="col">Product</th>
                      <th className="num" scope="col">Quantity</th>
                      <th className="num" scope="col">Unit price</th>
                      <th className="num" scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sale) => (
                      <tr key={sale.id}>
                        <td data-label="Sale date">{formatDate(sale.sale_date)}</td>
                        <td data-label="Product">{productName(sale)}</td>
                        <td className="num" data-label="Quantity">
                          {sale.quantity}
                        </td>
                        <td className="num money" data-label="Unit price">
                          {formatMoney(sale.unit_price)}
                        </td>
                        <td className="num money" data-label="Total">
                          {formatMoney(sale.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
