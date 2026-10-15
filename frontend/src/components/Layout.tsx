import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, Logo, type IconName } from "./icons";

export type PageName = "dashboard" | "products" | "sales" | "history" | "settings";

const primaryLinks: { id: PageName; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "products", label: "Products", icon: "products" },
  { id: "sales", label: "Sales", icon: "sales" },
  { id: "history", label: "Sales History", icon: "history" },
];

const pageMeta: Record<PageName, string> = {
  dashboard: "Dashboard",
  products: "Products",
  sales: "Sales",
  history: "Sales History",
  settings: "Settings",
};

type LayoutProps = {
  current: PageName;
  onNavigate: (page: PageName) => void;
  children: ReactNode;
};

export function Layout({ current, onNavigate, children }: LayoutProps) {
  const [navOpen, setNavOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const title = pageMeta[current];

  useEffect(() => {
    document.title = `${title} · MiniBiz`;
  }, [title]);

  useEffect(() => {
    if (!navOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>(".nav-link.active")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 860) {
        setNavOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function navigate(page: PageName) {
    setNavOpen(false);
    onNavigate(page);
  }

  function renderLink(link: { id: PageName; label: string; icon: IconName }) {
    const active = link.id === current;
    return (
      <button
        key={link.id}
        type="button"
        className={active ? "nav-link active" : "nav-link"}
        aria-current={active ? "page" : undefined}
        onClick={() => navigate(link.id)}
      >
        <span className="nav-icon">
          <Icon name={link.icon} />
        </span>
        <span>{link.label}</span>
      </button>
    );
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {navOpen && (
        <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      )}
      <aside ref={sidebarRef} className={navOpen ? "sidebar is-open" : "sidebar"}>
        <div className="sidebar-head">
          <div className="brand">
            <Logo />
            <div>
              <p className="brand-name">MiniBiz</p>
              <p className="brand-tag">Business management</p>
            </div>
          </div>
          <button type="button" className="sidebar-close icon-button" aria-label="Close menu" onClick={() => setNavOpen(false)}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <nav className="side-nav" aria-label="Main">
          <div className="nav-links">{primaryLinks.map(renderLink)}</div>
          <div className="nav-links nav-links-footer">
            {renderLink({ id: "settings", label: "Settings", icon: "settings" })}
          </div>
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-inner">
            <button
              type="button"
              className="menu-button icon-button"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Icon name="menu" size={18} />
            </button>
            <div className="topbar-title">
              <p className="crumb">MiniBiz</p>
              <p className="current-page">{title}</p>
            </div>
            <div id="topbar-slot" className="topbar-slot" />
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">
                SO
              </span>
              <span className="user-meta">
                <strong>Store owner</strong>
                <small>Workspace</small>
              </span>
            </div>
          </div>
        </header>
        <main id="main" className="content">
          <div className="content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
