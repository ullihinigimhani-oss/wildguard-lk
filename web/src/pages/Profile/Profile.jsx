import { useAuth } from "../../hooks/useAuth";
export default function Profile() {
  const { user } = useAuth();
  return (
    <section className="panel profile-panel">
      <span className="avatar large-avatar">{user.name.slice(0, 1)}</span>
      <span className="eyebrow">MY PROFILE</span>
      <h2>{user.name}</h2>
      <p className="muted">Your conservation workspace identity.</p>
      <dl>
        {Object.entries({
          Name: user.name,
          Email: user.email,
          Role: user.role,
          Phone: user.phone || 'Not provided',
        }).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="demo-notice">
        Account editing is not available yet.
      </div>
    </section>
  );
}
