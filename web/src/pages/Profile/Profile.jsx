import { useDemoAuth } from "../../hooks/useDemoAuth";
export default function Profile() {
  const { user } = useDemoAuth();
  return (
    <section className="panel profile-panel">
      <span className="avatar large-avatar">NP</span>
      <span className="eyebrow">DEMO STAFF PROFILE</span>
      <h2>{user.name}</h2>
      <p className="muted">Your conservation workspace identity.</p>
      <dl>
        {Object.entries({
          Name: user.name,
          Email: user.email,
          Role: user.role,
          "Assigned park": user.park,
        }).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="demo-notice">
        Sample profile information. Account editing and staff provisioning will
        be added with authentication.
      </div>
    </section>
  );
}
