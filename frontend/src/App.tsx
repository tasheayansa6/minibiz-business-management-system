import { useState } from "react";
import { Layout, type PageName } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Products } from "./pages/Products";
import { Sales } from "./pages/Sales";
import { Settings } from "./pages/Settings";

export function App() {
  const [page, setPage] = useState<PageName>("dashboard");

  return (
    <Layout current={page} onNavigate={setPage}>
      {page === "dashboard" && <Dashboard onNavigate={setPage} />}
      {page === "products" && <Products />}
      {page === "sales" && <Sales onNavigate={setPage} />}
      {page === "history" && <History />}
      {page === "settings" && <Settings />}
    </Layout>
  );
}
