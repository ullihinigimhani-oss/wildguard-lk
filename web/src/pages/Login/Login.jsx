import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { useDemoAuth } from "../../hooks/useDemoAuth";
export default function Login() {
  const location = useLocation();
  const { user, enterDemo } = useDemoAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;
  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setPassword("");
    setLoading(false);
    setMessage(
      "Staff sign-in is not available yet. Use the separate demo preview below; no credentials are sent or saved.",
    );
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand light />
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
          {location.state?.registered && <p role="status" className="demo-notice">Account created successfully. Sign-in is coming soon; your community account has been saved.</p>}
          <p className="muted">
            Your workspace for a more connected wilderness.
          </p>
          <div className="demo-notice">
            Foundation preview · Staff authentication is coming soon. Please do
            not enter real credentials.
          </div>
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
              <label className="checkbox-label">
                <input type="checkbox" disabled />
                Remember me (coming soon)
              </label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <button className="button primary full-width" disabled={loading}>
              {loading ? "Checking availability…" : "Log in"}
            </button>
            <p role="status" className="form-message">
              {message}
            </p>
          </form>
          <p>New to the community? <Link to="/register">Create an account</Link></p>
          <div className="demo-divider">EXPLORE THE PROTOTYPE</div>
          <button
            className="button secondary full-width"
            onClick={() => {
              setPassword("");
              enterDemo();
            }}
          >
            Explore demo workspace <span aria-hidden="true">→</span>
          </button>
          <p className="small muted">
            Demo data only. Access resets when you refresh. Staff accounts will
            be provisioned by authorized personnel.
          </p>
        </div>
        <footer className="login-footer">
          WildGuard LK · University conservation prototype
        </footer>
      </main>
    </div>
  );
}
