export default function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-symbol" aria-hidden="true">
        W<span>↗</span>
      </span>
      <div>
        WildGuard <strong>LK</strong>
        <small>PROTECT • PRESERVE • CONNECT</small>
      </div>
    </div>
  );
}
