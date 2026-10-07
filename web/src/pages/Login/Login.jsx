import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Brand from "../../components/common/Brand";
import ApprovalStatus from "../../components/common/ApprovalStatus";
import { getApprovalNotice } from "../../utils/loginStatus";
import { useAuth } from "../../hooks/useAuth";
export default function Login() {
  const location = useLocation();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState(null);
  const [message, setMessage] = useState("");
  if (isLoading) return <p role="status">Restoring your session…</p>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setMessage("");
    setApprovalNotice(null);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await login({ email, password });
    } catch (error) {
      const notice = getApprovalNotice(error);
      setApprovalNotice(notice);
      if (!notice)
        setMessage(
          error.response?.status === 403
            ? error.response.data?.message || "Your account is not approved."
            : error.response?.status === 401
              ? "Invalid email or password."
              : "Unable to log in. Please check your connection and try again.",
        );
      setPassword("");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Link to="/" aria-label="Back to WildGuard LK home">
          <Brand light />
        </Link>
        <div className="story-content">
          <span className="eyebrow">
            SRI LANKA’S WILDLIFE. OUR SHARED FUTURE.
          </span>
          <h1>
            A clearer view.
            <br />A safer wilderness.
          </h1>
          <p>
            Connecting conservation teams with the information they need to
            protect what matters.
          </p>
          <div className="landscape" aria-hidden="true">
            <span className="sun" />
            <span className="hill hill-back" />
            <span className="hill hill-front" />
            <span className="tree">♧</span>
          </div>
        </div>
        <span className="story-footer">
          Built for the people who protect our wild.
        </span>
      </section>
      <main className="login-panel">
        <div className="login-form">
          <span className="eyebrow">CONSERVATION OPERATIONS</span>
          <h2>Welcome back</h2>
          {location.state?.registered && (
            <p role="status" className="demo-notice">
              {location.state?.approvalStatus === "PENDING"
                ? "Account created. Your account is awaiting approval before you can sign in."
                : "Account created successfully. Log in with your new account."}
            </p>
          )}
          <p className="muted">
            Your workspace for a more connected wilderness.
          </p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.test"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p id="email-error" className="field-error" role="alert">
                {errors.email}
              </p>
            )}
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="field-error" role="alert">
                {errors.password}
              </p>
            )}
            <div className="form-options">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <button className="button primary full-width" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </button>
            <ApprovalStatus notice={approvalNotice} />
            <p role="status" className="form-message">
              {message}
            </p>
          </form>
          <p>
            New to the community? <Link to="/register">Create an account</Link>
          </p>
          <p className="small muted">
            Your session lasts up to one hour in this browser tab.
          </p>
        </div>
        <footer className="login-footer">
          WildGuard LK · Conservation operations
        </footer>
      </main>
    </div>
  );
}
