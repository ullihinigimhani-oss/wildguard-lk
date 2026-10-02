import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../common/Brand";
import { publicLinks } from "../../constants/publicContent";
import { useDemoAuth } from "../../hooks/useDemoAuth";

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const menu = useRef(null);
  const { user, isAuthenticated = false } = useDemoAuth();
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector("a")?.focus();
    function keydown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [open]);
  return (
    <header className="public-header">
      <div className="public-container public-nav-bar">
        <Link to="/" aria-label="WildGuard LK home">
          <Brand />
        </Link>
        <button
          ref={toggle}
          className="public-menu-toggle"
          aria-label={
            open ? "Close public navigation" : "Open public navigation"
          }
          aria-expanded={open}
          aria-controls="public-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close ×" : "Menu ☰"}
        </button>
        <nav
          ref={menu}
          id="public-navigation"
          aria-label="Public navigation"
          className={open ? "is-open" : ""}
        >
          {publicLinks.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          {isAuthenticated && user ? (
            <Link className="public-button public-button-dark" to="/dashboard">
              Open Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="public-signin">
                Sign In
              </Link>
              <Link to="/register" className="public-button public-button-dark">
                Sign Up <span aria-hidden="true">↗</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
