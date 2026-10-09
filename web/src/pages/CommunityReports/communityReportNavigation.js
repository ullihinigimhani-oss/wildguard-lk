import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listCommunityReports,
  communityReportListError,
} from "../../services/communityReportApi";

export const filterKeys = ["status", "reportType", "from", "to", "search"];
export function readFilters(params) {
  return Object.fromEntries(
    filterKeys.map((key) => [key, params.get(key) || ""]),
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
export function useCommunityReportQuery(filters, page) {
  const { user } = useAuth() || {};
  const authorized =
    user?.role === "PARK_MANAGER" && user?.approvalStatus === "APPROVED";
  const key = JSON.stringify({ filters, page });
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
    const { from, to, ...rest } = values.filters;
    if (from && to && from > to) {
      setState({
        data: null,
        loading: false,
        error: "End date must not precede start date.",
      });
      return;
    }
    listCommunityReports(
      requestFilters({ ...rest, from, to, page: values.page }),
      controller.signal,
    )
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((failure) => {
        if (active)
          setState({
            data: null,
            loading: false,
            error: communityReportListError(failure),
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authorized, user?.id, key, revision]);
  return {
    ...state,
    authorized,
    refresh: () => setRevision((value) => value + 1),
  };
}