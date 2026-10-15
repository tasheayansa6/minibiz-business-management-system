import { useEffect, useState } from "react";
import type { PageName } from "../components/Layout";
import { Icon } from "../components/icons";
import { Alert, Badge, Button, Card, EmptyState } from "../components/ui";
import { getProducts, getSales } from "../services/api";
import type { Product, Sale } from "../types";
import { messageFrom } from "../utils/errors";
import { formatDate, formatMoney } from "../utils/format";
import { LOW_STOCK_LIMIT, stockLevel, stockStatusLabel } from "../utils/stock";

const RECENT_SALES_LIMIT = 5;

type DashboardData = {
  products: Product[];
  sales: Sale[];
};

function toCents(amount: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) {
    return Number.NaN;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? "").padEnd(2, "0"));
  return sign * (whole * 100 + fraction);
}

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

function todayLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function lowStockSummary(outCount: number, lowCount: number): string {
  const out =
    outCount === 1 ? "1 product is out of stock" : `${outCount} products are out of stock`;
  if (outCount > 0 && lowCount > 0) {
    const low = lowCount === 1 ? "1 is low on stock" : `${lowCount} are low on stock`;
    return `${out}, and ${low}.`;
  }
  if (outCount > 0) {
    return `${out}.`;
  }
  return lowCount === 1 ? "1 product is low on stock." : `${lowCount} products are low on stock.`;
}

function DashboardLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading dashboard</span>
      <div className="kpi-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="kpi" key={index}>
            <span className="skeleton skeleton-icon" />
            <div className="skeleton-copy">
              <span className="skeleton skeleton-label" />
              <span className="skeleton skeleton-value" />
              <span className="skeleton skeleton-note" />
            </div>
          </div>
        ))}
      </div>
      <div className="split" aria-hidden="true">
        <div className="card skeleton-panel" />
        <div className="card skeleton-panel" />
      </div>
    </div>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (page: PageName) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([getProducts(), getSales()])
      .then(([products, sales]) => {
        if (active) {
          setData({ products, sales });
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setData(null);
          setError(messageFrom(caught, "The dashboard could not be loaded."));
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

  const products = data?.products ?? [];
  const sales = data?.sales ?? [];
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const unitsInStock = products.reduce((total, product) => total + product.stock_quantity, 0);
  const lowStock = products
    .filter((product) => product.stock_quantity <= LOW_STOCK_LIMIT)
    .sort(
      (left, right) =>
        left.stock_quantity - right.stock_quantity || left.name.localeCompare(right.name),
    );
  const outCount = lowStock.filter((product) => product.stock_quantity <= 0).length;
  const lowCount = lowStock.length - outCount;
  const revenueCents = sales.reduce((total, sale) => {
    const cents = toCents(sale.total_amount);
    return Number.isFinite(cents) ? total + cents : total;
  }, 0);
  const recentSales = [...sales]
    .sort((left, right) => new Date(right.sale_date).getTime() - new Date(left.sale_date).getTime())
    .slice(0, RECENT_SALES_LIMIT);

  function retry() {
    setLoading(true);
    setError(null);
    setRequestId((current) => current + 1);
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1>{greeting()}</h1>
          <p className="page-description">
            Revenue, recorded sales, catalog size, and inventory from your MiniBiz records.
          </p>
        </div>
      </header>

      {loading && <DashboardLoading />}

      {!loading && error && (
        <Alert
          tone="error"
          action={
            <Button type="button" onClick={retry}>
              Try again
            </Button>
          }
        >
          <p>{error}</p>
        </Alert>
      )}

      {!loading && data && (
        <>
          <div className="kpi-grid">
            <article className="kpi kpi-revenue">
              <div className="kpi-icon">
                <Icon name="revenue" />
              </div>
              <div>
                <p className="kpi-label">Total sales revenue</p>
                <p className="kpi-value">{formatMoney((revenueCents / 100).toFixed(2))}</p>
                <p className="kpi-note">Sum of recorded sales</p>
              </div>
            </article>
            <article className="kpi kpi-sales">
              <div className="kpi-icon">
                <Icon name="list" />
              </div>
              <div>
                <p className="kpi-label">Number of sales</p>
                <p className="kpi-value">{sales.length}</p>
                <p className="kpi-note">Completed sale records</p>
              </div>
            </article>
            <article className="kpi kpi-products">
              <div className="kpi-icon">
                <Icon name="products" />
              </div>
              <div>
                <p className="kpi-label">Total products</p>
                <p className="kpi-value">{products.length}</p>
                <p className="kpi-note">Items in the catalog</p>
              </div>
            </article>
            <article className="kpi kpi-stock">
              <div className="kpi-icon">
                <Icon name="layers" />
              </div>
              <div>
                <p className="kpi-label">Units in stock</p>
                <p className="kpi-value">{unitsInStock}</p>
                <p className="kpi-note">Across all products</p>
              </div>
            </article>
          </div>

          {products.length > 0 && lowStock.length > 0 && (
            <div className="callout">
              <div className="callout-icon">
                <Icon name="alert" />
              </div>
              <div className="callout-copy">
                <h2>Low stock</h2>
                <p>{lowStockSummary(outCount, lowCount)} Threshold is {LOW_STOCK_LIMIT} units or fewer.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => document.getElementById("low-stock")?.scrollIntoView({ block: "start" })}
              >
                Review list
              </Button>
            </div>
          )}

          {products.length > 0 && lowStock.length === 0 && (
            <div className="callout callout-healthy">
              <div className="callout-icon">
                <Icon name="check" />
              </div>
              <div className="callout-copy">
                <h2>Stock levels are healthy</h2>
                <p>Every product has more than {LOW_STOCK_LIMIT} units in stock.</p>
              </div>
            </div>
          )}

          <div className="split">
            <Card
              title="Recent sales"
              description="The latest completed sales."
              action={
                sales.length > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate("history")}>
                    View history
                  </Button>
                ) : null
              }
            >
              {recentSales.length === 0 ? (
                <EmptyState
                  icon={<Icon name="sales" />}
                  title="No sales yet"
                  description="Sales you record will appear here with the product, quantity, total, and date."
                  action={
                    <Button
                      type="button"
                      onClick={() => onNavigate(products.length > 0 ? "sales" : "products")}
                    >
                      {products.length > 0 ? "Record a sale" : "Add a product"}
                    </Button>
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <caption className="sr-only">Recent sales</caption>
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th className="num" scope="col">Quantity</th>
                        <th className="num" scope="col">Total</th>
                        <th scope="col">Sale date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((sale) => (
                        <tr key={sale.id}>
                          <td data-label="Product">{productNames.get(sale.product_id) ?? "Unknown product"}</td>
                          <td className="num" data-label="Quantity">
                            {sale.quantity}
                          </td>
                          <td className="num money" data-label="Total">
                            {formatMoney(sale.total_amount)}
                          </td>
                          <td data-label="Sale date">{formatDate(sale.sale_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card
              id="low-stock"
              title="Low stock"
              description={`Products with ${LOW_STOCK_LIMIT} units or fewer.`}
              action={
                <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate("products")}>
                  Manage products
                </Button>
              }
            >
              {products.length === 0 ? (
                <EmptyState
                  icon={<Icon name="products" />}
                  title="No products yet"
                  description="Add a product to start tracking what is on hand."
                  action={
                    <Button type="button" onClick={() => onNavigate("products")}>
                      Add a product
                    </Button>
                  }
                />
              ) : lowStock.length === 0 ? (
                <EmptyState
                  icon={<Icon name="check" />}
                  title="Nothing to reorder"
                  description={`Every product has more than ${LOW_STOCK_LIMIT} units in stock.`}
                />
              ) : (
                <ul className="stock-list">
                  {lowStock.map((product) => {
                    const level = stockLevel(product.stock_quantity);
                    const label = stockStatusLabel(level);
                    return (
                      <li key={product.id}>
                        <div>
                          <p className="stock-name">{product.name}</p>
                          <p className="stock-meta">{product.category}</p>
                        </div>
                        <p className="stock-qty">
                          {product.stock_quantity} {product.stock_quantity === 1 ? "unit" : "units"}
                        </p>
                        {label && <Badge tone={level === "out" ? "danger" : "warning"}>{label}</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
