import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
export default function Navbar({ title, open, onToggle }) {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button
          className="menu-toggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="primary-sidebar"
          onClick={onToggle}
        >
          ☰
        </button>
        <div>
          <span className="eyebrow">OPERATIONS / {title.toUpperCase()}</span>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <Link
          className="notification-button"
          to="/alerts"
          aria-label="Notifications"
        >
          ♧
        </Link>
        <Link
          to="/profile"
          className="user-link"
          aria-label={`Profile: ${user.name}`}
        >
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <span>
            {user.name}
            <small>{user.role.replaceAll('_', ' ')}</small>
            <small>{user.email}</small>
          </span>
        </Link>
        <button className="text-button" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}
