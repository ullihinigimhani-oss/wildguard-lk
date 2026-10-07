import { useEffect, useState, useId } from "react";
import { listAssignableRangers } from "../../services/patrolApi";
export default function RangerSelect({
  value,
  onChange,
  disabled,
  error,
  label = "Assigned Ranger",
  helper = "Select the approved ranger leading this patrol.",
}) {
  const [rangers, setRangers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const id = useId();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailure("");
    listAssignableRangers()
      .then((items) => {
        if (active) setRangers(items);
      })
      .catch(() => {
        if (active) setFailure("Unable to load rangers. Please retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const query = search.toLowerCase();
  const options = rangers.filter(
    (ranger) =>
      ranger.id === value ||
      ranger.name.toLowerCase().includes(query) ||
      (ranger.email && ranger.email.toLowerCase().includes(query)),
  );
  return (
    <div className="registration-field ranger-select">
      <label htmlFor={id}>{label} *</label>
      <p className="small muted">{helper}</p>
      <input
        aria-label={"Search " + label}
        placeholder="Search rangers by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled || loading}
      />
      <select
        id={id}
        value={value}
        required
        disabled={disabled || loading || !!failure || !rangers.length}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      >
        <option value="">
          {loading ? "Loading rangers…" : "Select Ranger"}
        </option>
        {options.map((ranger) => (
          <option key={ranger.id} value={ranger.id}>
            {ranger.name} · {ranger.email}
            {ranger.park ? ` · ${ranger.park.name}` : ""}
          </option>
        ))}
      </select>
      {!loading && !failure && !rangers.length && (
        <p role="status">
          No approved rangers are available. Contact your administrator.
        </p>
      )}
      {failure && (
        <p role="alert">
          {failure}{" "}
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry rangers
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
