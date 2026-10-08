import { useState } from "react";
import PatrolMap from "./PatrolMap";
import {
  normalizeRoute,
  pointTypes,
  pointTypeLabel,
  routeDistanceKm,
} from "./routePlanning";
import "./PatrolRoutePlanner.css";

export default function PatrolRoutePlanner({
  points = [],
  onChange,
  disabled = false,
  error,
  readOnly = false,
  validation,
  canValidate = false,
}) {
  const [type, setType] = useState("START"),
    [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(""),
    [manual, setManual] = useState({ latitude: "", longitude: "" });
  const [clearing, setClearing] = useState(false);
  const selected = points.find((p) => p.id === selectedId);
  function commit(next) {
    onChange?.(normalizeRoute(next));
  }
  function add({ lat, lng }) {
    if (disabled || readOnly) return;
    if (points.length >= 100) {
      setNotice("Use up to 100 route points.");
      return;
    }
    if (
      (type === "START" || type === "END") &&
      points.some((p) => p.type === type)
    ) {
      setNotice(
        `The route already has a ${pointTypeLabel(type)}. Select its marker to edit it.`,
      );
      return;
    }
    const point = {
      id: crypto.randomUUID(),
      type,
      latitude: lat,
      longitude: lng,
      label: "",
      note: "",
      autoLabel: true,
    };
    const next = [...points];
    if (type === "START") next.unshift(point);
    else if (type === "END") next.push(point);
    else
      next.splice(
        next.findIndex((p) => p.type === "END") < 0
          ? next.length
          : next.findIndex((p) => p.type === "END"),
        0,
        point,
      );
    commit(next);
    setSelectedId(point.id);
    setNotice(`${pointTypeLabel(type)} added.`);
    if (type === "START") setType("CHECKPOINT");
  }
  function edit(id, patch) {
    commit(points.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function move(index, direction) {
    const next = [...points],
      target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }
  function addManual() {
    const lat = Number(manual.latitude),
      lng = Number(manual.longitude);
    if (
      !manual.latitude.trim() ||
      !manual.longitude.trim() ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      !Number.isFinite(lng) ||
      Math.abs(lng) > 180
    ) {
      setNotice(
        "Enter a latitude from -90 to 90 and longitude from -180 to 180.",
      );
      return;
    }
    add({ lat, lng });
  }
  const count = (kind) => points.filter((p) => p.type === kind).length;
  return (
    <section
      id="plannedRoute"
      tabIndex={-1}
      className="patrol-route patrol-span"
      aria-labelledby="route-heading"
      aria-describedby={error ? "route-error" : undefined}
    >
      <div className="route-heading">
        <div>
          <h3 id="route-heading">Patrol Route{!readOnly && " *"}</h3>
          <p>
            {readOnly
              ? "Saved planned waypoints"
              : "Select a point type, then click the map to add it to the patrol route."}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled || !points.length}
            onClick={() => setClearing(true)}
          >
            Clear route
          </button>
        )}
      </div>
      {!readOnly && (
        <div className="route-type-controls" aria-label="Point type">
          {pointTypes.map(([value, label, symbol]) => (
            <button
              type="button"
              key={value}
              aria-pressed={type === value}
              disabled={
                disabled ||
                ((value === "START" || value === "END") && count(value) > 0)
              }
              onClick={() => {
                setType(value);
                setNotice("");
              }}
            >
              <span aria-hidden="true">{symbol}</span>
              {label}
            </button>
          ))}
        </div>
      )}
      {!readOnly && (
        <p className="route-mode">
          Adding: <strong>{pointTypeLabel(type)}</strong>. Drag a marker to
          adjust its position.
        </p>
      )}
      <div className="route-workspace">
      <PatrolMap
        walkingRoute={validation?.route}
        invalidIndex={validation?.invalidIndex}
          points={points}
          selectedId={selectedId}
          disabled={disabled}
          readOnly={readOnly}
          onAdd={add}
          onSelect={setSelectedId}
          onMove={(id, { lat, lng }) =>
            edit(id, { latitude: lat, longitude: lng })
          }
        />
        <div className="route-list-panel">
          <h4>
            Selected route <span>{points.length} points</span>
          </h4>
          {!points.length && (
            <p className="route-empty">
              {readOnly
                ? "No planned route was saved for this patrol."
                : "Add a Start Point and an End Point. Checkpoints, risk areas and observations are optional."}
            </p>
          )}
          <ol className="route-point-list">
            {points.map((p, index) => (
              <li
                key={p.id || p.order}
                className={p.id === selectedId ? "is-selected" : ""}
              >
                <button
                  type="button"
                  className="route-point-select"
                  onClick={() => setSelectedId(p.id)}
                >
                  <span
                    className={`route-list-symbol route-marker-${p.type.toLowerCase()}`}
                  >
                    {p.type === "CHECKPOINT"
                      ? points
                          .slice(0, index + 1)
                          .filter((x) => x.type === "CHECKPOINT").length
                      : {
                          START: "S",
                          END: "E",
                          HIGH_RISK: "!",
                          OBSERVATION: "O",
                        }[p.type]}
                  </span>
                  <span>
                    <strong>{p.label || pointTypeLabel(p.type)}</strong>
                    <small>
                      {index + 1}. {pointTypeLabel(p.type)}
                    </small>
                  </span>
                </button>
                {!readOnly && (
                  <div className="route-point-actions">
                    <button
                      type="button"
                      aria-label={`Move point ${index + 1} up`}
                      disabled={
                        disabled ||
                        p.type === "START" ||
                        p.type === "END" ||
                        index === 0 ||
                        points[index - 1].type === "START"
                      }
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move point ${index + 1} down`}
                      disabled={
                        disabled ||
                        p.type === "START" ||
                        p.type === "END" ||
                        index === points.length - 1 ||
                        points[index + 1].type === "END"
                      }
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove point ${index + 1}`}
                      disabled={disabled}
                      onClick={() => {
                        commit(points.filter((x) => x.id !== p.id));
                        if (selectedId === p.id) setSelectedId(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {readOnly && p.note && <p>{p.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {selected && !readOnly && (
        <fieldset className="route-point-editor" disabled={disabled}>
          <legend>Edit selected point</legend>
          <label>
            Point name
            <input
              maxLength={200}
              value={selected.label}
              onChange={(e) =>
                edit(selected.id, { label: e.target.value, autoLabel: false })
              }
            />
          </label>
          <label>
            Point type
            <select
              value={selected.type}
              disabled={selected.type === "START" || selected.type === "END"}
              onChange={(e) =>
                edit(selected.id, { type: e.target.value, autoLabel: true })
              }
            >
              {pointTypes
                .filter((p) =>
                  selected.type === "START" || selected.type === "END"
                    ? p[0] === selected.type
                    : !["START", "END"].includes(p[0]),
                )
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="route-editor-note">
            Point note (optional)
            <textarea
              rows={2}
              maxLength={500}
              value={selected.note}
              onChange={(e) => edit(selected.id, { note: e.target.value })}
            />
          </label>
          <small>
            Latitude {selected.latitude.toFixed(6)} · Longitude{" "}
            {selected.longitude.toFixed(6)} · Order {selected.order}
          </small>
        </fieldset>
      )}
      {!readOnly && (
        <details className="route-manual">
          <summary>Use manual coordinates instead</summary>
          <div>
            <label>
              Point latitude
              <input
                type="number"
                step="any"
                value={manual.latitude}
                disabled={disabled}
                onChange={(e) =>
                  setManual({ ...manual, latitude: e.target.value })
                }
              />
            </label>
            <label>
              Point longitude
              <input
                type="number"
                step="any"
                value={manual.longitude}
                disabled={disabled}
                onChange={(e) =>
                  setManual({ ...manual, longitude: e.target.value })
                }
              />
            </label>
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={addManual}
            >
              Add coordinates
            </button>
          </div>
        </details>
      )}
      <div className="route-summary">
        {validation && <div className="route-validation">
          <button type="button" className="button secondary" disabled={disabled || validation.loading || !canValidate} onClick={validation.validate}>
            {validation.loading ? 'Validating walking route…' : 'Validate walking route'}
          </button>
          {validation.route && <p role="status">Walking route verified · {(validation.route.distanceMeters / 1000).toFixed(2)} km · {Math.ceil(validation.route.durationSeconds / 60)} min. Green line shows the verified walking route.</p>}
          {validation.error && <p role="alert" className="field-error">{validation.error}</p>}
          {!validation.route && !validation.loading && !validation.error && <p role="status">Validate the complete walking route before saving. Dashed lines are unverified waypoint connections.</p>}
        </div>}
        <h4>Route Summary</h4>
        <dl>
          <div>
            <dt>Start</dt>
            <dd>
              {points.find((p) => p.type === "START")?.label || "Not selected"}
            </dd>
          </div>
          <div>
            <dt>Checkpoints</dt>
            <dd>{count("CHECKPOINT")}</dd>
          </div>
          <div>
            <dt>High Risk Points</dt>
            <dd>{count("HIGH_RISK")}</dd>
          </div>
          <div>
            <dt>Observation Points</dt>
            <dd>{count("OBSERVATION")}</dd>
          </div>
          <div>
            <dt>End</dt>
            <dd>
              {points.find((p) => p.type === "END")?.label || "Not selected"}
            </dd>
          </div>
          <div>
            <dt>Approx. Planned Distance</dt>
            <dd>{routeDistanceKm(points).toFixed(2)} km</dd>
          </div>
        </dl>
        <p>
          Distances and dashed lines connect the selected waypoints directly.
          Terrain, roads and trails may require a longer path.
        </p>
      </div>
      {notice && (
        <p role="status" className="route-notice">
          {notice}
        </p>
      )}
      {error && (
        <p id="route-error" role="alert" className="field-error">
          {error}
        </p>
      )}
      {clearing && (
        <div
          className="route-clear-confirm"
          role="alertdialog"
          aria-label="Clear planned route"
        >
          <p>Clear all planned points? This cannot be undone.</p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => setClearing(false)}
          >
            Keep route
          </button>
          <button
            type="button"
            className="button primary"
            disabled={disabled}
            onClick={() => {
              commit([]);
              setSelectedId(null);
              setType("START");
              setClearing(false);
            }}
          >
            Clear all points
          </button>
        </div>
      )}
    </section>
  );
}
