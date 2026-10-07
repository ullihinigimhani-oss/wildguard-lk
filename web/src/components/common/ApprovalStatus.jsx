export default function ApprovalStatus({ notice }) {
  if (!notice) return null;
  return (
    <div className="login-approval-status" role="status" aria-live="polite">
      <h3>{notice.title}</h3>
      <p>{notice.message}</p>
    </div>
  );
}
