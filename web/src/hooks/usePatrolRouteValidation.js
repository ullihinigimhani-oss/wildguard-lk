import { useEffect, useRef, useState } from 'react';
import { validatePatrolRoute } from '../services/patrolApi';
export default function usePatrolRouteValidation(payload) {
  const key = JSON.stringify(payload);
  const current = useRef(key);
  current.current = key;
  const request = useRef(null);
  const [state, setState] = useState({});
  useEffect(() => {
    request.current?.abort();
    setState({});
    return () => request.current?.abort();
  }, [key]);
  useEffect(() => {
    if (!state.route) return;
    const timer = setTimeout(() => setState(value => ({ ...value, route: null, error: 'Walking validation expired. Validate again before saving.' })), 120000);
    return () => clearTimeout(timer);
  }, [state.route]);
  async function validate() {
    if (request.current && state.loading) return;
    const controller = new AbortController();
    request.current = controller;
    setState({ key, loading: true });
    try {
      const route = await validatePatrolRoute(payload, controller.signal);
      if (!controller.signal.aborted && current.current === key) setState({ key, route });
    } catch (error) {
      if (!controller.signal.aborted && current.current === key) {
        const body = error.response?.data;
        const index = body?.routingPoint?.index;
        setState({ key, error: Number.isInteger(index) ? `Waypoint ${index + 1} (${body.routingPoint.type}) cannot be routed. Reposition its marker and validate again. ${body.message || ''}` : body?.message || 'Walking validation unavailable. Retry before saving.', invalidIndex: index });
      }
    }
  }
  function invalidate(body) {
    const index = body?.routingPoint?.index;
    setState({ key, invalidIndex: index, error: Number.isInteger(index) ? `Waypoint ${index + 1} (${body.routingPoint.type}) cannot be routed. Reposition its marker and validate again. ${body.message || ''}` : body?.message || 'Validate the walking route again before saving.' });
  }
  return { ...(state.key === key ? state : {}), validate, invalidate };
}
