import { Link } from "react-router-dom";
import PatrolRoutePlanner from "../../components/patrol/PatrolRoutePlanner";
import { useRef, useState } from "react";
import ParkSelect from "../../components/common/ParkSelect";
import RangerSelect from "../../components/common/RangerSelect";
import {
  initialPatrol,
  patrolPayload,
  patrolPriorities,
  patrolTypes,
  validatePatrol,
} from "../../constants/patrols";
import { createPatrol, updatePatrol } from "../../services/patrolApi";
const formFields = [
  {
    key: "patrol_title",
    label: "Patrol Title",
    required: true,
    span: true,
    placeholder: "e.g. Northern boundary sweep",
  },
  { kind: "park" },
  { kind: "ranger" },
  {
    key: "patrol_date",
    label: "Patrol Date",
    type: "date",
    required: true,
    span: true,
  },
  { key: "start_time", label: "Start Time", type: "time", required: true },
  {
    key: "expected_end_time",
    label: "Expected End Time",
    type: "time",
    required: true,
  },
  {
    key: "patrol_type",
    label: "Patrol Type",
    required: true,
    options: patrolTypes,
  },
  {
    key: "priority",
    label: "Priority",
    required: true,
    options: patrolPriorities,
  },
  { kind: "notes" },
];
export default function CreatePatrolForm({ onCreated, patrolId, initialValues = initialPatrol }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  function update(key, value) {
    setValues({ ...values, [key]: value });
  }
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const next = validatePatrol(values);
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const data = await (patrolId ? updatePatrol(patrolId, patrolPayload(values)) : createPatrol(patrolPayload(values)));
      setErrors({});
      if (!patrolId) setValues(initialPatrol);
      onCreated?.(data.patrol);
    } catch (error) {
      const body = error.response?.data;
      setErrors(body?.errors || {});
      setMessage(
        body?.message ||
          "Unable to save this patrol. Please check your connection and try again.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  function errorFor(key) {
    return errors[key] ? (
      <p id={key + "-error"} role="alert" className="field-error">
        {errors[key]}
      </p>
    ) : null;
  }
  return (
    <form
      className="patrol-form"
      onSubmit={submit}
      noValidate
      aria-busy={loading}
    >
      {formFields.map((field) => {
        if (field.kind === "park")
          return (
            <ParkSelect
              key="park"
              value={values.park_ranger_area}
              onChange={(parkId) => update("park_ranger_area", parkId)}
              disabled={loading}
              error={errors.park_ranger_area}
              helper="Select the park or ranger area this patrol covers."
            />
          );
        if (field.kind === "ranger")
          return (
            <RangerSelect
              key="ranger"
              value={values.assigned_ranger}
              onChange={(rangerId) => update("assigned_ranger", rangerId)}
              disabled={loading}
              error={errors.assigned_ranger}
            />
          );
        if (field.kind === "notes")
          return (
            <div className="registration-field patrol-span" key="notes">
              <label htmlFor="instructions_notes">
                Instructions &amp; Notes (optional)
              </label>
              <textarea
                id="instructions_notes"
                rows={4}
                maxLength={2000}
                placeholder="What should the ranger focus on during this patrol?"
                disabled={loading}
                value={values.instructions_notes}
                onChange={(e) => update("instructions_notes", e.target.value)}
                aria-invalid={!!errors.instructions_notes}
                aria-describedby={
                  errors.instructions_notes
                    ? "instructions_notes-error"
                    : undefined
                }
              />
              {errorFor("instructions_notes")}
            </div>
          );
        const {
          key,
          label,
          type = "text",
          required,
          span,
          placeholder,
          step,
          options,
        } = field;
        return (
          <div
            className={"registration-field" + (span ? " patrol-span" : "")}
            key={key}
          >
            <label htmlFor={key}>
              {label}
              {required ? " *" : " (optional)"}
            </label>
            {options ? (
              <select
                id={key}
                required
                disabled={loading}
                value={values[key]}
                onChange={(e) => update(key, e.target.value)}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? key + "-error" : undefined}
              >
                {options.map(([value, optionLabel]) => (
                  <option key={value} value={value}>
                    {optionLabel}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={key}
                type={type}
                step={step}
                placeholder={placeholder}
                required={required}
                maxLength={type === "text" ? 200 : undefined}
                disabled={loading}
                value={values[key]}
                onChange={(e) => update(key, e.target.value)}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? key + "-error" : undefined}
              />
            )}
            {errorFor(key)}
          </div>
        );
      })}
      <PatrolRoutePlanner
        points={values.plannedRoute}
        onChange={(points) => update("plannedRoute", points)}
        disabled={loading}
        error={errors.plannedRoute}
      />
      {message && (
        <p role="alert" className="field-error patrol-span">
          {message}
        </p>
      )}
      <div className="patrol-actions patrol-span">
        {!loading && (
          <Link className="button secondary" to="/patrols">
            Cancel
          </Link>
        )}
        <button className="button primary" disabled={loading}>
          {loading ? (patrolId ? "Saving changes…" : "Creating patrol…") : (patrolId ? "Save Changes" : "Create Patrol")}
        </button>
        <span className="small muted">
          {patrolId ? "Only scheduled patrols can be edited." : "New patrols start with Scheduled status."}
        </span>
      </div>
    </form>
  );
}
