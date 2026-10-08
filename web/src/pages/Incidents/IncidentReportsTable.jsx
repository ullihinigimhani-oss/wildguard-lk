import { Link } from "react-router-dom";
import { incidentTypes } from "../../services/incidentApi";
import { Status, time } from "../../components/incident/incidentPresentation";
import IncidentStatusForm from "../../components/incident/IncidentStatusForm";
export default function IncidentReportsTable({
  items,
  detailsPath,
  showReporter = false,
  statusEditor = false,
  onStatusSaved,
}) {
  return (
    <div className="table-scroll">
      <table className={statusEditor ? "incident-table has-status-editor" : "incident-table"}>
        <thead>
          <tr>
            {[
              "Reference",
              "Title",
              "Type",
              "Status",
              ...(showReporter ? ["Reporter", "Park"] : []),
              "Occurred",
              "Evidence",
              "Actions",
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="table-id">{item.id}</td>
              <td>
                {item.title || "Untitled report"}
                {item.severity && <small> · {item.severity}</small>}
              </td>
              <td>
                {incidentTypes[item.incidentType] || item.incidentType || "—"}
              </td>
              <td>
                <Status incident={item} />
              </td>
              {showReporter && (
                <>
                  <td>{item.reporter?.name || "—"}</td>
                  <td>{item.park?.name || "—"}</td>
                </>
              )}
              <td>{time(item.occurredAt)}</td>
              <td>{item.evidenceCount ?? "—"}</td>
              <td className="table-actions">
                <Link
                  className="button"
                  to={detailsPath(item)}
                  aria-label={`View incident ${item.id}`}
                >
                  View
                </Link>
                {statusEditor && (
                  <IncidentStatusForm
                    compact
                    incident={item}
                    onSaved={onStatusSaved}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
