import { NavLink } from "react-router-dom";
import Brand from "../common/Brand";
import { modules } from "../../constants/navigation";
export default function Sidebar({ open, onClose }) {
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
          {modules.map((item) => (
            <NavLink key={item.path} to={`/${item.path}`} onClick={onClose}>
              <span aria-hidden="true">{item.icon}</span>
              {item.title}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="park-dot" /> Conservation starts here.
          <small>Sri Lanka · Field operations</small>
          <span className="prototype-label">UNIVERSITY PROTOTYPE</span>
        </div>
      </aside>
    </>
  );
}
