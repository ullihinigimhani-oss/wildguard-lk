import { Link } from "react-router-dom";
import { useDemoAuth } from "../../hooks/useDemoAuth";
export default function Navbar({ title, open, onToggle }) {
  const { user, leaveDemo } = useDemoAuth();
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
          ♧<span className="notification-dot" />
        </Link>
        <Link
          to="/profile"
          className="user-link"
          aria-label={`Profile: ${user.name}`}
        >
          <span className="avatar">NP</span>
          <span>
            {user.name}
            <small>{user.role} · Demo</small>
          </span>
        </Link>
        <button className="text-button" onClick={leaveDemo}>
          Exit demo
        </button>
      </div>
    </header>
  );
}
