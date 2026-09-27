import { Link } from "react-router-dom";
export default function Placeholder({ title, publicPage = false }) {
  return (
    <section className={`panel placeholder ${publicPage ? "standalone" : ""}`}>
      <span className="placeholder-icon" aria-hidden="true">
        ↗
      </span>
      <span className="eyebrow">COMING SOON</span>
      <h2>{title}</h2>
      <p>
        This part of WildGuard LK is being prepared for a future feature.
        <br />
        No operational action is available in this foundation preview.
      </p>
      <Link
        className="button primary"
        to={publicPage ? "/login" : "/dashboard"}
      >
        {publicPage ? "Back to login" : "Back to dashboard"}
      </Link>
    </section>
  );
}
