import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import { modules } from "../constants/navigation";
export default function OperationsLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const title =
    modules.find((item) => `/${item.path}` === pathname)?.title ||
    (pathname === "/profile"
      ? "My profile"
      : pathname === "/patrols/live"
        ? "Live Ranger Monitoring"
        : "Dashboard");
  useEffect(() => {
    setOpen(false);
  }, [title, pathname]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const controls = Array.from(
      document.querySelectorAll("#primary-sidebar button, #primary-sidebar a"),
    );
    controls[0]?.focus();
    const close = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const first = controls[0];
        const last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      previousFocus?.focus();
    };
  }, [open]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="workspace">
        <Navbar title={title} open={open} onToggle={() => setOpen(!open)} />
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          WildGuard LK <span>Protecting wildlife. Connecting people.</span>
        </footer>
      </div>
    </div>
  );
}
