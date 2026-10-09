import { Link } from "react-router-dom";
import Brand from "../common/Brand";
import { publicLinks } from "../../constants/publicContent";
export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="public-footer-grid">
          <div>
            <Link to="/" aria-label="WildGuard LK home">
              <Brand light />
            </Link>
            <p>
              Smart Wildlife Conservation &<br />
              Anti-Poaching Monitoring System
            </p>
            <span>Made for a wilder Sri Lanka.</span>
          </div>
          <nav aria-label="Footer quick links">
            <h3>Quick Links</h3>
            {publicLinks.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
          <div>
            <h3>A shared purpose</h3>
            <p>
              Supporting rangers, communities, researchers and conservation
              teams.
            </p>
            <Link to="/register">
              Join the community <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="public-footer-bottom">
          <span>© 2026 WildGuard LK. All rights reserved.</span>
          <span>University conservation prototype · Sri Lanka</span>
        </div>
      </div>
    </footer>
  );
}
