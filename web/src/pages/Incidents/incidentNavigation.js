import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listAllIncidents,
  listIncidents,
  incidentError,
} from "../../services/incidentApi";

export const filterKeys = [
  "patrolId",
  "rangerId",
  "parkId",
  "incidentType",
  "status",
  "from",
  "to",
  "includeWithdrawn",
];
export function readFilters(params) {
  return Object.fromEntries(
    filterKeys.map((key) => [
      key,
      params.get(key) || (key === "includeWithdrawn" ? "false" : ""),
    ]),
  );
}
export function requestFilters(filters) {
  return {
    ...filters,
    from: filters.from ? `${filters.from}T00:00:00+05:30` : "",
    to: filters.to ? `${filters.to}T23:59:59.999+05:30` : "",
  };
}
export function pageNumber(value) {
  return /^\d+$/.test(value || "") &&
    Number(value) >= 1 &&
    Number(value) <= 100000
    ? Number(value)
    : 1;
}
export function searchIncidents(items, search) {
  const query = search.trim().toLowerCase();
  return items.filter(
    (item) =>
      !query ||
      `${item.id} ${item.title || ""} ${item.description || ""} ${item.incidentType || ""} ${item.patrol?.routeName || ""} ${item.reporter?.name || ""} ${item.park?.name || ""}`
        .toLowerCase()
        .includes(query),
  );
}
export function groupPatrols(items) {
  const seen = new Set(),
    groups = new Map(),
    unassigned = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const id = item.patrolId || item.patrol?.id;
    if (!id) {
      unassigned.push(item);
      continue;
    }
    if (!groups.has(id))
      groups.set(id, {
        id,
        patrol: item.patrol,
        park: item.park,
        count: 0,
        latest: null,
      });
    const group = groups.get(id);
    group.count++;
    const date = item.occurredAt || item.reportedAt || item.createdAt;
    if (
      Number.isFinite(Date.parse(date)) &&
      (!group.latest || Date.parse(date) > Date.parse(group.latest))
    )
      group.latest = date;
  }
  return { patrols: [...groups.values()], unassigned };
}
export function useIncidentQuery(filters, complete = false) {
  const { user } = useAuth() || {};
  const authorized =
    user?.role === "PARK_MANAGER" && user?.approvalStatus === "APPROVED";
  const key = JSON.stringify(filters);
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!authorized) {
      setState({ data: null, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState({ data: null, loading: true, error: "" });
    const values = JSON.parse(key);
    if (values.from && values.to && values.from > values.to) {
      setState({
        data: null,
        loading: false,
        error: "End date must not precede start date.",
      });
      return;
    }
    (complete ? listAllIncidents : listIncidents)(
      requestFilters(values),
      controller.signal,
    )
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((error) => {
        if (active)
          setState({ data: null, loading: false, error: incidentError(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authorized, user?.id, key, complete, revision]);
  return {
    ...state,
    authorized,
    refresh: () => setRevision((value) => value + 1),
  };
}
