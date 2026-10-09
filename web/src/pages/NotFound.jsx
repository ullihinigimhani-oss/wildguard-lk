import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <main className="placeholder standalone">
      <span className="eyebrow">404 · OFF THE TRAIL</span>
      <h1>Page not found</h1>
      <p>This path does not lead to a WildGuard workspace.</p>
      <Link className="button primary" to="/">
        Return to WildGuard LK
      </Link>
    </main>
  );
}
