import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPatrol } from "../../services/patrolApi";
import { initialPatrol } from "../../constants/patrols";
import CreatePatrolForm from "./CreatePatrolForm";

const time = value => value ? new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(value)) : "";
export function editValues(patrol) {
  return {
    ...initialPatrol,
    patrol_title: patrol.routeName,
    park_ranger_area: patrol.park.id,
    assigned_ranger: patrol.ranger.id,
    patrol_date: patrol.scheduledDate?.slice(0, 10) || "",
    start_time: time(patrol.startTime),
    expected_end_time: time(patrol.endTime),
    patrol_type: patrol.patrolType,
    priority: patrol.priority,
    start_location: patrol.startLocation || "",
    latitude: patrol.latitude ?? "",
    longitude: patrol.longitude ?? "",
    instructions_notes: patrol.description || "",
    plannedRoute: (patrol.plannedRoute || []).map((point, index) => ({
      ...point, id: `saved-${index}`, label: point.label || "", note: point.note || "", autoLabel: false,
    })),
  };
}
export default function EditPatrol() {
  const { id } = useParams();
  const [patrol, setPatrol] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setPatrol(null); setError(""); setSaved(false);
    getPatrol(id).then(data => { if (current) setPatrol(data); })
      .catch(() => { if (current) setError("Unable to load this patrol. Please try again."); });
    return () => { current = false; };
  }, [id, revision]);
  return <section className="panel patrol-panel">
    <Link to="/patrols">← Back to patrols</Link>
    <h2>Edit Patrol</h2>
    {error ? <><p role="alert">{error}</p><button className="button secondary" onClick={() => setRevision(n => n + 1)}>Retry</button></>
      : !patrol ? <p role="status">Loading patrol…</p>
      : patrol.status !== "SCHEDULED" ? <p role="alert">Only scheduled patrols can be edited. This patrol is {patrol.status.replaceAll("_", " ").toLowerCase()}.</p>
      : <>{saved && <p role="status">Patrol updated successfully.</p>}
        <CreatePatrolForm key={id + ":" + revision} patrolId={id} initialValues={editValues(patrol)} onCreated={updated => { setPatrol(updated); setSaved(true); }} />
      </>}
  </section>;
}
