import { useEffect, useState, useId } from "react";
import { listParks } from "../../services/parkApi";
export default function ParkSelect({
  value,
  onChange,
  disabled,
  error,
  label = "Park / Ranger Area",
  helper = "Select the park or ranger area where you are assigned to work.",
}) {
  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const id = useId();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailure("");
    listParks()
      .then((items) => {
        if (active) setParks(items);
      })
      .catch(() => {
        if (active) setFailure("Unable to load parks. Please retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const options = parks.filter(
    (park) =>
      park.id === value ||
      park.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="registration-field park-select">
      <label htmlFor={id}>{label} *</label>
      <p className="small muted">{helper}</p>
      <input
        aria-label={"Search " + label}
        placeholder="Search parks"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled || loading}
      />
      <select
        id={id}
        value={value}
        required
        disabled={disabled || loading || !!failure || !parks.length}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      >
        <option value="">
          {loading ? "Loading parks…" : "Select Park / Area"}
        </option>
        {options.map((park) => (
          <option key={park.id} value={park.id}>
            {park.name}
          </option>
        ))}
      </select>
      {!loading && !failure && !parks.length && (
        <p role="status">
          No parks are configured. Contact your administrator.
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
            Retry parks
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
