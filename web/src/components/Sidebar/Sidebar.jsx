import { NavLink } from "react-router-dom";
import Brand from "../common/Brand";
import { modules } from "../../constants/navigation";
import { useAuth } from "../../hooks/useAuth";
export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
      <aside
        id="primary-sidebar"
        className={`sidebar ${open ? "is-open" : ""}`}
      >
        <Brand light />
        <button className="mobile-close" onClick={onClose}>
          Close menu ×
        </button>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <NavLink to="/dashboard" onClick={onClose}>
            <span aria-hidden="true">▦</span>Dashboard
          </NavLink>
          {modules
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map((item) => (
              <NavLink key={item.path} to={`/${item.path}`} onClick={onClose}>
                <span aria-hidden="true">{item.icon}</span>
                {item.title}
              </NavLink>
            ))}
        </nav>
      </aside>
    </>
  );
}
