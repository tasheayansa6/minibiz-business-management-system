/** Shapes returned and accepted by the MiniBiz API. */

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  stock_quantity: number;
  created_at: string;
}

export interface ProductCreate {
  name: string;
  description?: string;
  category?: string;
  price: string;
  stock_quantity: number;
}

export interface ProductUpdate {
  name?: string;
  description?: string;
  category?: string;
  price?: string;
  stock_quantity?: number;
}

export interface Sale {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  total_amount: string;
  sale_date: string;
}

export interface SaleCreate {
  product_id: string;
  quantity: number;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  api: "running";
  database: "connected" | "disconnected";
}

export interface ValidationIssue {
  type: string;
  loc: Array<string | number>;
  msg: string;
}
