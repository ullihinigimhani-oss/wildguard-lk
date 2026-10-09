import logo from "../../assets/public/wildguard-logo.png";

export default function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <img className="brand-logo" src={logo} alt="" width="64" height="64" />
      <div>
        WildGuard <strong>LK</strong>
        <small>PROTECT • PRESERVE • CONNECT</small>
      </div>
    </div>
  );
}
