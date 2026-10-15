

import type {
  HealthStatus,
  Product,
  ProductCreate,
  ProductUpdate,
  Sale,
  SaleCreate,
  ValidationIssue,
} from "../types";

export type {
  HealthStatus,
  Product,
  ProductCreate,
  ProductUpdate,
  Sale,
  SaleCreate,
  ValidationIssue,
};

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | ValidationIssue[];

  constructor(status: number, detail: string | ValidationIssue[]) {
    super(formatDetail(detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// The backend .env holds the MongoDB password and stays on the server.
// The browser only needs the API address. frontend/.env can override it.
function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8000";
}

function formatDetail(detail: string | ValidationIssue[]): string {
  if (typeof detail === "string") {
    return detail;
  }

  return detail.map((issue) => issue.msg).join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    Array.isArray(value.loc) &&
    value.loc.every(
      (item) => typeof item === "string" || typeof item === "number"
    ) &&
    typeof value.msg === "string"
  );
}

function isHealthStatus(value: unknown): value is HealthStatus {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.status === "ok" || value.status === "degraded") &&
    value.api === "running" &&
    (value.database === "connected" ||
      value.database === "disconnected")
  );
}

function parseDetail(body: unknown): string | ValidationIssue[] {
  if (!isRecord(body) || !("detail" in body)) {
    return "The request failed.";
  }

  const detail = body.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail) && detail.every(isValidationIssue)) {
    return detail;
  }

  return "The request failed.";
}

async function send(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      0,
      "The API could not be reached. Check that the backend is running and the URL is correct."
    );
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await send(path, init);

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, parseDetail(body));
  }

  if (response.status === 204) {
    throw new ApiError(
      response.status,
      "The server returned no content when JSON was expected."
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (body === null) {
    throw new ApiError(
      response.status,
      "The server returned an invalid or empty JSON response."
    );
  }

  return body as T;
}

// -------------------- Products --------------------

export type ProductQuery = {
  search?: string;
  category?: string;
  max_stock?: number;
};

export function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  const category = query.category?.trim();
  if (search) {
    params.set("search", search);
  }
  if (category) {
    params.set("category", category);
  }
  if (query.max_stock !== undefined) {
    params.set("max_stock", String(query.max_stock));
  }
  const queryString = params.toString();
  const suffix = queryString ? `?${queryString}` : "";
  return requestJson<Product[]>(`/products${suffix}`);
}

export function getProduct(id: string): Promise<Product> {
  return requestJson<Product>(
    `/products/${encodeURIComponent(id)}`
  );
}

export function createProduct(
  data: ProductCreate
): Promise<Product> {
  return requestJson<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(
  id: string,
  data: ProductUpdate
): Promise<Product> {
  return requestJson<Product>(
    `/products/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteProduct(id: string): Promise<void> {
  const response = await send(
    `/products/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  if (response.ok) {
    return;
  }

  const body: unknown = await response.json().catch(() => null);

  throw new ApiError(response.status, parseDetail(body));
}

// -------------------- Sales --------------------

export function getSales(): Promise<Sale[]> {
  return requestJson<Sale[]>("/sales");
}

export function createSale(data: SaleCreate): Promise<Sale> {
  return requestJson<Sale>("/sales", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// -------------------- Health --------------------

export async function getHealth(): Promise<HealthStatus> {
  const response = await send("/health");
  const body: unknown = await response.json().catch(() => null);

  // The health endpoint may return HTTP 503 when the database is unavailable.
  if (
    (response.status === 200 || response.status === 503) &&
    isHealthStatus(body)
  ) {
    return body;
  }

  if (!response.ok) {
    throw new ApiError(response.status, parseDetail(body));
  }

  throw new ApiError(
    response.status,
    "The server returned an unexpected health response."
  );
}
