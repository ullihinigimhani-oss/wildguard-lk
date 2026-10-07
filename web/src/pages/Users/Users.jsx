import { useEffect, useId, useRef, useState } from "react";
import Avatar from "../../components/common/Avatar";
import { roleChoices, roleLabel } from "../../constants/roles";
import { listUsers, reviewUser } from "../../services/userApi";
const reviewable = ["RANGER", "COMMUNITY_LIAISON", "RESEARCHER"];
export default function Users() {
  const [revision, setRevision] = useState(0);
  return (
    <section className="panel users-panel">
      <h2>Users / Access Management</h2>
      <p className="muted">
        Verify conservation staff and view registered accounts. Park Manager
        requests require administrator review.
      </p>
      <UserSection
        pending
        revision={revision}
        onReview={() => setRevision((n) => n + 1)}
      />
      <UserSection
        revision={revision}
        onReview={() => setRevision((n) => n + 1)}
      />
    </section>
  );
}
function UserSection({ pending = false, revision, onReview }) {
  const tab = pending ? "pending" : "all";
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogTitle = useId();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const locked = useRef(false);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () =>
        listUsers({
          pending: tab === "pending",
          search,
          role: tab === "all" ? role : undefined,
          status: tab === "all" ? status : undefined,
          page,
        })
          .then((data) => {
            if (current) setResult(data);
          })
          .catch(() => {
            if (current) setError("Unable to load users. Please try again.");
          })
          .finally(() => {
            if (current) setLoading(false);
          }),
      200,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [tab, search, role, status, page, refresh, revision]);
  useEffect(() => {
    if (modal) {
      dialog.current.showModal();
    } else {
      if (dialog.current?.open) dialog.current.close();
      trigger.current?.focus();
    }
  }, [modal]);
  function open(user, action, event) {
    trigger.current = event.currentTarget;
    setReason("");
    setError("");
    setModal({ user, action });
  }
  function close() {
    if (!locked.current) setModal(null);
  }
  async function confirm() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await reviewUser(
        modal.user.id,
        modal.action === "approve" ? "APPROVED" : "REJECTED",
        reason.trim() || undefined,
      );
      setMessage(
        data.notification?.sent
          ? "Account updated. Notification email submitted."
          : "Account updated. Notification email could not be sent; check email configuration or delivery service.",
      );
      setModal(null);
      onReview();
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "Unable to update this account. Please try again.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="users-section">
      <h3>{pending ? "Pending Approvals" : "All Users"}</h3>
      <div className="users-filters">
        <label>
          Search name or email
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            maxLength={120}
          />
        </label>
        {tab === "all" && (
          <>
            <label>
              Role
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All roles</option>
                {roleChoices.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {["PENDING", "APPROVED", "REJECTED"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      {message && (
        <p role="status" className="demo-notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading users…</p>
      ) : error && !modal ? (
        <button
          className="button secondary"
          onClick={() => setRefresh((n) => n + 1)}
        >
          Retry
        </button>
      ) : (
        <>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  {[
                    "User",
                    "Phone",
                    "Role",
                    "Registered",
                    "Status",
                    "Actions",
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="users-identity">
                        <Avatar user={user} />
                        <span>
                          <strong>{user.name}</strong>
                          <br />
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td>{user.phone || "Not provided"}</td>
                    <td>{roleLabel(user.role)}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span
                        className={
                          "approval-badge " + user.approvalStatus.toLowerCase()
                        }
                      >
                        {user.approvalStatus}
                      </span>
                    </td>
                    <td>
                      <div className="users-actions">
                        <button
                          className="text-button"
                          onClick={(e) => open(user, "view", e)}
                        >
                          View Details
                        </button>
                        {user.approvalStatus === "PENDING" &&
                          reviewable.includes(user.role) && (
                            <>
                              <button
                                className="text-button"
                                onClick={(e) => open(user, "reject", e)}
                              >
                                Reject
                              </button>
                              <button
                                className="button primary"
                                onClick={(e) => open(user, "approve", e)}
                              >
                                Approve
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.users.length && <p>No matching users.</p>}
          <div className="users-pagination">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage((n) => n - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} · {result.total} users
            </span>
            <button
              className="button secondary"
              disabled={page * 25 >= result.total}
              onClick={() => setPage((n) => n + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        className="user-dialog"
        aria-labelledby={dialogTitle}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        {modal && (
          <>
            <Avatar user={modal.user} large />
            <h2 id={dialogTitle}>
              {modal.action === "view"
                ? "Account details"
                : modal.action === "approve"
                  ? "Approve this account?"
                  : "Reject this account?"}
            </h2>
            <p>
              <strong>{modal.user.name}</strong> · {roleLabel(modal.user.role)}
            </p>
            <dl>
              {Object.entries({
                Email: modal.user.email,
                Phone: modal.user.phone || "Not provided",
                Role: roleLabel(modal.user.role),
                Registered: new Date(modal.user.createdAt).toLocaleString(),
                Status: modal.user.approvalStatus,
                ...(modal.user.rejectionReason
                  ? { "Rejection reason": modal.user.rejectionReason }
                  : {}),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {modal.action === "reject" && (
              <label>
                Reason for rejection
                <textarea
                  placeholder="Provide a reason for the applicant (optional)"
                  value={reason}
                  maxLength={1000}
                  disabled={busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            {modal.action === "approve" && (
              <p>
                This account will be permitted to sign in. A notification will
                be sent to the registered email when email delivery is
                configured.
              </p>
            )}
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="users-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={close}
              >
                {modal.action === "view" ? "Close" : "Cancel"}
              </button>
              {modal.action !== "view" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={confirm}
                >
                  {busy
                    ? "Saving…"
                    : modal.action === "approve"
                      ? "Approve Account"
                      : "Reject Account"}
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
