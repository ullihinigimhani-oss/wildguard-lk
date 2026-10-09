import Avatar from "../../components/common/Avatar";
import { roleLabel } from "../../constants/roles";
import { useAuth } from "../../hooks/useAuth";
export default function Profile() {
  const { user } = useAuth();
  return (
    <section className="panel profile-panel">
      <Avatar user={user} large />
      <span className="eyebrow">MY PROFILE</span>
      <h2>{user.name}</h2>
      <p className="muted">Your conservation workspace identity.</p>
      <dl>
        {Object.entries({
          Name: user.name,
          Email: user.email,
          Role: roleLabel(user.role),
          ...(user.role === "RANGER"
            ? {
                "Assigned Park / Ranger Area":
                  user.park?.name || "Not assigned",
              }
            : {}),
          "Approval status": user.approvalStatus || "APPROVED",
          Phone: user.phone || "Not provided",
        }).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="demo-notice">Account editing is not available yet.</div>
    </section>
  );
}
