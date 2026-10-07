import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { publicRegistrationRoles, roleLabel } from "../../constants/roles";
import RegistrationPhoto from "../../components/common/RegistrationPhoto";
import Brand from "../../components/common/Brand";
import { registerAccount } from "../../services/authApi";
import {
  initialRegistration,
  passwordHelp,
  validateRegistration,
} from "../../utils/registration";
export default function Register() {
  const [role, setRole] = useState("");
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(initialRegistration);
  const [visible, setVisible] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const next = validateRegistration(values);
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const result = await registerAccount({ ...values, role });
      setValues(initialRegistration);
      navigate("/login", {
        replace: true,
        state: { registered: true, approvalStatus: result.user.approvalStatus },
      });
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setMessage(
        error.response?.status === 409
          ? "An account with this email already exists."
          : error.response?.status === 400
            ? "Please check your details."
            : "We couldn't create your account. Please try again. If you already submitted, your account may have been created.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return (
    <div className="login-page register-page">
      <section className="login-story">
        <Brand light />
        <div className="story-content">
          <span className="eyebrow">OUR WILDLIFE. OUR SHARED FUTURE.</span>
          <h1>
            Small actions.
            <br />A wilder tomorrow.
          </h1>
          <p>
            Join a community that cares for Sri Lanka’s wildlife and the places
            we call home.
          </p>
          <div className="landscape" aria-hidden="true">
            <span className="sun" />
            <span className="hill hill-back" />
            <span className="hill hill-front" />
            <span className="tree">♧</span>
          </div>
        </div>
        <span className="story-footer">Together, closer to nature.</span>
      </section>
      <main className="login-panel">
        <div className="login-form">
          <span className="eyebrow">WILDGUARD LK / REGISTRATION</span>
          {step === 1 ? (
            <>
              <h2>Choose Your Role</h2>
              <p className="muted">Select how you will use WildGuard LK.</p>
              <div className="role-cards">
                {publicRegistrationRoles.map(([value, label, description]) => (
                  <button
                    type="button"
                    className={
                      "role-card" + (role === value ? " selected" : "")
                    }
                    aria-pressed={role === value}
                    key={value}
                    onClick={() => setRole(value)}
                  >
                    <strong>
                      {label} {role === value && "✓"}
                    </strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
              <button
                className="button primary full-width"
                disabled={!role}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
              <p>
                Already have an account? <Link to="/login">Sign In</Link>
              </p>
            </>
          ) : (
            <>
              <h2>Create your account</h2>
              <p className="muted">
                Registering as <strong>{roleLabel(role)}</strong>
              </p>
              <button
                className="text-button"
                disabled={loading}
                onClick={() => setStep(1)}
              >
                Change role
              </button>
              <p className="muted">
                {role === "COMMUNITY_USER"
                  ? "Community accounts can sign in immediately after registration."
                  : "Staff accounts require verification before sign-in."}
              </p>
              <RegistrationPhoto disabled={loading} />
              <form onSubmit={submit} noValidate aria-busy={loading}>
                {[
                  ["name", "Full Name", "text", "name"],
                  ["email", "Email Address", "email", "email"],
                  ["phone", "Phone Number (optional)", "tel", "tel"],
                  ["password", "Password", "password", "new-password"],
                  [
                    "confirmPassword",
                    "Confirm Password",
                    "password",
                    "new-password",
                  ],
                ].map(([key, label, type, autoComplete]) => (
                  <div className="registration-field" key={key}>
                    <label htmlFor={key}>
                      {label}
                      {key !== "phone" && " *"}
                    </label>
                    <div
                      className={
                        type === "password" ? "password-field" : undefined
                      }
                    >
                      <input
                        id={key}
                        type={visible[key] ? "text" : type}
                        autoComplete={autoComplete}
                        required={key !== "phone"}
                        disabled={loading}
                        value={values[key]}
                        onChange={(e) =>
                          setValues({ ...values, [key]: e.target.value })
                        }
                        aria-invalid={!!errors[key]}
                        aria-describedby={
                          [
                            errors[key] && key + "-error",
                            key === "password" && "password-help",
                          ]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                      />
                      {type === "password" && (
                        <button
                          type="button"
                          aria-label={
                            (visible[key] ? "Hide " : "Show ") +
                            label.toLowerCase()
                          }
                          aria-pressed={!!visible[key]}
                          onClick={() =>
                            setVisible({ ...visible, [key]: !visible[key] })
                          }
                        >
                          {visible[key] ? "Hide" : "Show"}
                        </button>
                      )}
                    </div>
                    {key === "password" && (
                      <p id="password-help" className="small muted">
                        {passwordHelp}
                      </p>
                    )}
                    {errors[key] && (
                      <p
                        id={key + "-error"}
                        className="field-error"
                        role="alert"
                      >
                        {errors[key]}
                      </p>
                    )}
                  </div>
                ))}
                <details className="registration-policy">
                  <summary>Terms & Privacy</summary>
                  <p>
                    WildGuard LK provides community and verified staff accounts.
                    Use accurate information and use the service respectfully.
                    Your name, email, optional phone number and a securely
                    hashed password are stored to manage your account. Do not
                    submit sensitive wildlife locations in account fields.
                  </p>
                </details>
                <label className="registration-consent">
                  <input
                    id="termsAccepted"
                    type="checkbox"
                    checked={values.termsAccepted}
                    disabled={loading}
                    onChange={(e) =>
                      setValues({ ...values, termsAccepted: e.target.checked })
                    }
                    aria-describedby={
                      errors.termsAccepted ? "terms-error" : undefined
                    }
                  />{" "}
                  I accept the Terms & Privacy *
                </label>
                {errors.termsAccepted && (
                  <p id="terms-error" className="field-error" role="alert">
                    {errors.termsAccepted}
                  </p>
                )}
                {message && (
                  <p role="alert" className="field-error">
                    {message}
                  </p>
                )}
                <button
                  className="button primary full-width"
                  disabled={loading}
                >
                  {loading ? "Creating account…" : "Create Account"}
                </button>
              </form>
              <p className="registration-signin">
                Already have an account? <Link to="/login">Sign In</Link>
              </p>
            </>
          )}
        </div>
        <footer className="login-footer">
          WildGuard LK · A shared future for wildlife
        </footer>
      </main>
    </div>
  );
}
