import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  analyticsError,
  communityAnalytics,
  incidentAnalytics,
  kpis,
  patrolAnalytics,
} from "../../services/analyticsApi";

export const filterKeys = [
  "from",
  "to",
  "period",
  "area",
  "incidentType",
  "incidentStatus",
  "patrolType",
  "patrolStatus",
  "patrolPriority",
  "reportType",
  "reportStatus",
];

export function readFilters(params) {
  const values = Object.fromEntries(
    filterKeys.map((key) => [key, params.get(key) || ""]),
  );
  if (!values.period) values.period = "month";
  return values;
}

// Converts calendar dates to Sri Lanka timezone instants, mirroring the
// Community Reports requestFilters convention used across the web app.
export function requestFilters(filters, entity) {
  const base = { ...filters };
  delete base.incidentType;
  delete base.incidentStatus;
  delete base.patrolType;
  delete base.patrolStatus;
  delete base.patrolPriority;
  delete base.reportType;
  delete base.reportStatus;
  if (entity === "incident") {
    base.type = filters.incidentType;
    base.status = filters.incidentStatus;
  }
  if (entity === "patrol") {
    base.type = filters.patrolType;
    base.status = filters.patrolStatus;
    base.priority = filters.patrolPriority;
  }
  if (entity === "community") {
    base.type = filters.reportType;
    base.status = filters.reportStatus;
  }
  return {
    ...base,
    from: filters.from ? `${filters.from}T00:00:00+05:30` : "",
    to: filters.to ? `${filters.to}T23:59:59.999+05:30` : "",
  };
}

export function useAnalyticsQuery(loader, key, buildParams) {
  const { user } = useAuth() || {};
  const authorized =
    user?.role === "PARK_MANAGER" && user?.approvalStatus === "APPROVED";
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
    const from = values.from || "";
    const to = values.to || "";
    if (from && to && from > to) {
      setState({
        data: null,
        loading: false,
        error: "End date must not precede start date.",
      });
      return;
    }
    loader(buildParams(values), controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((failure) => {
        if (active)
          setState({
            data: null,
            loading: false,
            error: analyticsError(failure),
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  // Loader and buildParams are stable callbacks; key carries the filter
  // changes that must trigger a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, user?.id, key, revision]);
  return {
    ...state,
    authorized,
    refresh: () => setRevision((value) => value + 1),
  };
}

function entityFilters(values, entity) {
  return requestFilters(values, entity);
}

function queryKey(filters, scoped) {
  const relevant = Object.fromEntries(
    filterKeys.filter((key) => (scoped || []).includes(key)).map((key) => [key, filters[key]]),
  );
  return JSON.stringify(relevant);
}

export function useKpisQuery(filters) {
  return useAnalyticsQuery(
    kpis,
    queryKey(filters, ["from", "to", "area"]),
    (values) => entityFilters(values),
  );
}

export function useIncidentAnalyticsQuery(filters) {
  return useAnalyticsQuery(
    incidentAnalytics,
    queryKey(filters, ["from", "to", "period", "area", "incidentType", "incidentStatus"]),
    (values) => entityFilters(values, "incident"),
  );
}

export function usePatrolAnalyticsQuery(filters) {
  return useAnalyticsQuery(
    patrolAnalytics,
    queryKey(filters, ["from", "to", "period", "area", "patrolType", "patrolStatus", "patrolPriority"]),
    (values) => entityFilters(values, "patrol"),
  );
}

export function useCommunityAnalyticsQuery(filters) {
  return useAnalyticsQuery(
    communityAnalytics,
    queryKey(filters, ["from", "to", "period", "area", "reportType", "reportStatus"]),
    (values) => entityFilters(values, "community"),
  );
}