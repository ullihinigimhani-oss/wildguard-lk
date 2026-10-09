import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Modal, View, useWindowDimensions } from "react-native";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import { useAuth } from "../../hooks/useAuth";
import { useOffline } from "../../hooks/useOffline";
import * as offlineStore from "../../storage/offlineStorage";
import { kickSync } from "../../services/offlineSync";
import useIncidentResource from "../../hooks/useIncidentResource";
import useForegroundLocation from "../../hooks/useForegroundLocation";
import { getMyPatrol } from "../../services/patrolApi";
import EvidenceDraft from "../../components/incident/EvidenceDraft";
import {
  validateEvidenceDraft,
  discardEvidenceFile,
} from "../../utils/incidentEvidence";
import {
  uploadIncidentEvidence,
  evidenceError,
} from "../../services/incidentEvidenceApi";
import {
  createIncident,
  editIncident,
  getIncident,
} from "../../services/incidentApi";
import {
  canChangeIncident,
  formFor,
  freshFix,
  incidentError,
  incidentPatch,
  INCIDENT_TYPES,
  readableTime,
  validateForm,
} from "../../utils/incident";
import {
  Heading,
  IncidentButton,
  Input,
  SelectCard,
  State,
  palette,
  ui,
} from "../../components/incident/IncidentUI";

// Save the incident once, then upload private evidence against its confirmed ID.
export default function ReportIncidentScreen(props) {
  const { user } = useAuth();
  const p = props.route.params;
  return <IncidentForm key={`${user?.id}:${p?.incidentId || p?.localDraftId || "new"}:${p?.patrolId}`} {...props} />;
}
function IncidentForm({ route, navigation }) {
  const { width, fontScale } = useWindowDimensions();
  const { user } = useAuth(),
    focused = useIsFocused();
  const incidentId = route.params?.incidentId,
    patrolId = route.params?.patrolId;
  const editing = !!incidentId;
  const offline = useOffline();
  const localId = useRef(route.params?.localDraftId || null);
  const [localStatus, setLocalStatus] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const [items, setItems] = useState([]),
    [savedIncident, setSavedIncident] = useState(null),
    [progress, setProgress] = useState(null),
    [selecting, setSelecting] = useState(false);
  const savedRef = useRef(null), draftLoaded = useRef(false), savedSelections = useRef(null);
  const loader = useCallback(
    async (signal) => {
      if (editing) return getIncident(incidentId, signal);
      if (offline && !offline.online) {
        const cached = (await offlineStore.cachedPatrols(user.id)).find(p => p.id === patrolId);
        if (cached) return cached;
        throw new Error("Open this assigned patrol online once before reporting offline.");
      }
      try { return await getMyPatrol(patrolId, signal); }
      catch (failure) {
        if (offline && !failure.response && !signal?.aborted) {
          const cached = (await offlineStore.cachedPatrols(user.id)).find(p => p.id === patrolId);
          if (cached) return cached;
        }
        throw failure;
      }
    },
    [editing, incidentId, patrolId, user?.id, !!offline, offline?.online],
  );
  const authority = useIncidentResource(loader);
  const [form, setForm] = useState(() => formFor()),
    [initial, setInitial] = useState(null),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(null);
  const [busy, setBusy] = useState(false),
    [capture, setCapture] = useState(false),
    [fix, setFix] = useState(null),
    [manual, setManual] = useState(false),
    [locationWarning, setLocationWarning] = useState(false),
    [acknowledged, setAcknowledged] = useState(false);
  const [leaveAction, setLeaveAction] = useState(null),
    [allowLeave, setAllowLeave] = useState(false),
    [success, setSuccess] = useState(null);
  const pending = useRef(false),
    mounted = useRef(true),
    initialized = useRef(false),
    originalIncident = useRef(null);
  const location = useForegroundLocation(capture && focused);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!authority.data || initialized.current) return;
    initialized.current = true;
    originalIncident.current = editing ? authority.data : null;
    const next = formFor(editing ? authority.data : undefined);
    setForm(next);
    setInitial(JSON.stringify(next));
    if (editing) setManual(true);
  }, [authority.data, editing]);
  useEffect(() => {
    if (!offline || !localId.current || !authority.data || editing || draftLoaded.current) return;
    let cancelled = false;
    offlineStore.readDraft(user.id, localId.current).then(draft => {
      if (!draft || cancelled) return;
      draftLoaded.current = true;
      if (draft.status !== "LOCAL_DRAFT") {
        submittedRef.current = true; setSubmitted(true); setLocalStatus(draft.status);
        setProgress("Saved on device — Pending Sync");
        if (draft.server_id) setSavedIncident({ id: draft.server_id });
        return;
      }
      setForm(draft.form); setInitial(JSON.stringify(draft.form)); setItems(draft.items);
      savedSelections.current = JSON.stringify(draft.items.map(({ uploadKey, caption, notes }) => ({ uploadKey, caption, notes })));
      setLocalStatus(draft.status); setManual(true);
      if (draft.server_id) { savedRef.current = { id: draft.server_id }; setSavedIncident({ id: draft.server_id }); }
    }).catch(() => { if (!cancelled) setError("The saved local draft could not be opened."); });
    return () => { cancelled = true; };
  }, [authority.data, editing, user?.id]);
  useEffect(() => {
    if (!capture || !location.position || !freshFix(location.position)) return;
    const snapshot = { ...location.position };
    setFix(snapshot);
    setManual(false);
    setCapture(false);
    setAcknowledged(false);
    setLocationWarning(false);
    setForm((previous) => ({
      ...previous,
      latitude: String(snapshot.latitude),
      longitude: String(snapshot.longitude),
    }));
  }, [capture, location.position]);
  const dirty =
    (initial !== null && JSON.stringify(form) !== initial) ||
    (localId.current && savedSelections.current !== null
      ? JSON.stringify(items.map(({ uploadKey, caption, notes }) => ({ uploadKey, caption, notes }))) !== savedSelections.current
      : items.some((item) => item.status !== "uploaded"));
  usePreventRemove(!allowLeave && (dirty || busy || selecting), ({ data }) => {
    if (!pending.current && !selecting) {
      Keyboard.dismiss();
      setLeaveAction(data.action);
    }
  });
  useEffect(() => {
    if (!allowLeave) return;
    if (success)
      navigation.replace("IncidentDetails", {
        incidentId: success.id,
        confirmation: editing ? "edited" : "created",
      });
    else if (leaveAction) navigation.dispatch(leaveAction);
  }, [allowLeave, success, leaveAction, editing, navigation]);
  const patrol = editing ? authority.data?.patrol : authority.data;
  const eligible =
    !authority.loading &&
    !authority.error &&
    (!route.params?.localDraftId || draftLoaded.current) &&
    (editing
      ? canChangeIncident(authority.data, user?.id)
      : patrol?.status === "IN_PROGRESS");
  const existingEvidence =
    savedIncident?.evidence || (editing ? authority.data?.evidence : []) || [];
  const existingCount = Math.max(
    savedIncident?.evidenceCount || 0,
    editing ? authority.data?.evidenceCount || 0 : 0,
    existingEvidence.length,
  );
  function change(key, value) {
    if (savedRef.current) return;
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  useEffect(() => {
    if (!submitted || !offline || !focused) return;
    let cancelled = false;
    const id = localId.current;
    const load = () => offlineStore.readDraft(user.id, id).then(record => {
      if (cancelled || !record) return;
      setLocalStatus(record.status);
      setProgress(record.status === "SYNCED" ? "Incident synced" : "Saved on device — Pending Sync");
      setError(record.error || null);
      if (record.server_id) setSavedIncident({ id: record.server_id });
    }).catch(() => { if (!cancelled) setError("Your report is saved on this device. Reopen Reports to check sync status."); });
    load();
    const timer = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [submitted, focused, user.id, !!offline]);
  async function saveLocal(submitForSync = false, body = null) {
    if (submittedRef.current) return;
    if (!localId.current) localId.current = offlineStore.offlineId();
    const id = await offlineStore.saveDraft(user.id, patrolId, localId.current, form, body, items, submitForSync);
    localId.current = id;
    if (!mounted.current) { if (submitForSync) void kickSync().catch(() => {}); return; }
    draftLoaded.current = true;
    if (!submitForSync) {
      savedSelections.current = JSON.stringify(items.map(({ uploadKey, caption, notes }) => ({ uploadKey, caption, notes })));
      setInitial(JSON.stringify(form)); setLocalStatus("LOCAL_DRAFT"); setProgress("Draft saved on device"); return;
    }
    submittedRef.current = true; setSubmitted(true);
    const empty = formFor();
    setForm(empty); setInitial(JSON.stringify(empty)); setItems([]);
    savedSelections.current = JSON.stringify([]);
    setErrors({}); setError(null); setCapture(false); setFix(null); setManual(false);
    setAcknowledged(false); setLocationWarning(false);
    setLocalStatus("PENDING_SYNC"); setProgress("Saved on device — Pending Sync");
    navigation.setParams?.({ localDraftId: id });
    void kickSync().catch(() => {});
  }
  async function saveLocalDraft() {
    if (submittedRef.current || pending.current || busy || selecting || !eligible) return;
    pending.current = true; setBusy(true); setError(null);
    try { await saveLocal(false); }
    catch (failure) { setError(failure.message || "Could not save this draft on the device."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function submit() {
    if (submittedRef.current || pending.current || !eligible || selecting) return;
    const validated = validateForm(form);
    setErrors(validated.errors);
    setError(null);
    if (Object.keys(validated.errors).length) return;
    const body = editing
      ? incidentPatch(form, originalIncident.current, validated.body)
      : validated.body;
    if (
      !savedRef.current &&
      editing &&
      !Object.keys(body).length &&
      !items.some((item) => item.status !== "uploaded")
    ) {
      setError("No changes to save.");
      return;
    }
    if (fix && !manual && !freshFix(fix) && !acknowledged) {
      setLocationWarning(true);
      return;
    }
    pending.current = true;
    setBusy(true);
    setCapture(false);
    try {
      const remaining = items.filter((item) => item.status !== "uploaded");
      const localSaved = items.filter(
        (item) =>
          item.status === "uploaded" &&
          !existingEvidence.some((e) => e.id === item.evidenceId),
      ).length;
      if (remaining.length)
        await validateEvidenceDraft(
          remaining,
          savedRef.current ? 0 : existingCount + localSaved,
        );
      if (offline && !editing) {
        await saveLocal(true, body);
        return;
      }
      if (savedRef.current) {
        const current = await getIncident(savedRef.current.id);
        if (!canChangeIncident(current, user?.id))
          throw new Error(
            "Evidence uploads are locked. Your saved incident remains available.",
          );
        // Let the backend distinguish an already-saved retry from a new fifth-item-limit violation.
      }
      setProgress("Saving incident...");
      const result =
        savedRef.current ||
        (editing
          ? Object.keys(body).length
            ? await editIncident(incidentId, body)
            : authority.data
          : await createIncident(patrolId, body));
      if (!result?.id)
        throw new Error("The server did not confirm the incident.");
      savedRef.current = result;
      if (mounted.current) setSavedIncident(result);
      let failed = false;
      const update = (key, patch) => {
        if (mounted.current)
          setItems((previous) =>
            previous.map((item) =>
              item.uploadKey === key ? { ...item, ...patch } : item,
            ),
          );
      };
      for (let index = 0; index < remaining.length; index++) {
        const item = remaining[index];
        if (mounted.current)
          setProgress(
            `Uploading evidence ${index + 1} of ${remaining.length}...`,
          );
        update(item.uploadKey, { status: "uploading", error: null });
        try {
          await validateEvidenceDraft([item]);
          const evidence = await uploadIncidentEvidence(
            result.id,
            item,
            (value) => update(item.uploadKey, { progress: value }),
          );
          update(item.uploadKey, {
            status: "uploaded",
            progress: 100,
            evidenceId: evidence.id,
          });
        } catch (failure) {
          failed = true;
          let message = evidenceError(failure);
          if (!failure.response) {
            try {
              await validateEvidenceDraft([item]);
            } catch (unavailable) {
              message = unavailable.message;
              failure.reselectRequired = unavailable.reselectRequired;
            }
          }
          update(item.uploadKey, {
            status: "failed",
            error: message,
            cleanupBlocked:
              failure.response?.data?.code === "MEDIA_CLEANUP_FAILED",
            reselectRequired: failure.reselectRequired,
          });
        }
      }
      if (failed) {
        if (mounted.current) {
          setError("Incident saved, but some evidence failed.");
          setProgress(null);
        }
        return;
      }
      // Details fetches authoritative evidence on mount; refresh here when possible too.
      if (remaining.length) {
        try {
          const refreshed = await getIncident(result.id);
          if (mounted.current) setSavedIncident(refreshed);
        } catch {
          /* Details offers its normal retry. */
        }
      }
      if (mounted.current) {
        setProgress(remaining.length ? "Upload complete" : "Incident saved");
        setSuccess(result);
        setAllowLeave(true);
      }
    } catch (failure) {
      if (failure.reselectRequired)
        setItems((previous) =>
          previous.map((item) =>
            item.uploadKey === failure.evidenceDiagnostic?.requestId
              ? { ...item, reselectRequired: true }
              : item,
          ),
        );
      if (mounted.current) {
        setProgress(null);
        setError(
          failure.response
            ? incidentError(failure)
            : failure.message || incidentError(failure),
        );
        if (failure.response?.status === 400)
          setErrors(failure.response.data?.errors || {});
        if ([403, 404, 409].includes(failure.response?.status))
          authority.refresh();
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Screen backgroundColor={palette.background}>
      <Heading
        title={editing ? "Edit Incident" : "Report New Incident"}
        description="Record a fixed incident location and clear field observations."
      />
      <State {...authority} retry={authority.refresh} />
      {patrol && (
        <View style={ui.card}>
          <Text style={ui.title}>{patrol.routeName}</Text>
          <Text style={ui.muted}>
            {editing ? authority.data?.park?.name : patrol.park?.name} ·{" "}
            {patrol.status}
          </Text>
        </View>
      )}
      {!authority.loading && !authority.error && !eligible && (
        <View style={ui.card}>
          <Text accessibilityRole="alert" style={ui.error}>
            This report is read-only. Reporting and changes require an active
            patrol and an eligible pending incident.
          </Text>
          <IncidentButton
            title="Refresh status"
            secondary
            onPress={authority.refresh}
          />
        </View>
      )}
      {submitted && <View style={ui.card}>
        <Text accessibilityLiveRegion="polite" style={ui.body}>{progress}</Text>
        <Text style={ui.muted}>{localStatus?.replaceAll("_", " ")}</Text>
        {error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
        <Text style={ui.muted}>Your submitted report and evidence remain saved. Retry Sync uses this same report.</Text>
        <IncidentButton title="Retry Sync" secondary onPress={() => offline?.retry()} />
        {savedIncident && <IncidentButton title="View Saved Incident" onPress={() => navigation.navigate("IncidentDetails", { incidentId: savedIncident.id })} />}
      </View>}
      {initial !== null && !submitted && (
        <>
          <Text style={ui.section}>Incident type *</Text>
          <View style={{ gap: 10 }}>
          {INCIDENT_TYPES.map((type) => (
            <SelectCard
              key={type.code}
              {...type}
              selected={form.incidentType === type.code}
              onPress={() => change("incidentType", type.code)}
              disabled={busy || !eligible || !!savedIncident}
              style={{ padding: width < 350 || fontScale > 1.3 ? 16 : 18 }}
            />
          ))}
          </View>
          {errors.incidentType && (
            <Text accessibilityRole="alert" style={ui.error}>
              {errors.incidentType}
            </Text>
          )}
          <Input
            label="Incident title *"
            value={form.title}
            onChangeText={(value) => change("title", value)}
            maxLength={150}
            editable={!busy && eligible && !savedIncident}
            error={errors.title}
            placeholder="Describe the incident briefly"
          />
          <Input
            label="Description *"
            value={form.description}
            onChangeText={(value) => change("description", value)}
            maxLength={5000}
            multiline
            editable={!busy && eligible && !savedIncident}
            error={errors.description}
            placeholder="What did you observe? Include useful field details."
          />
          <View style={ui.card}>
            <Text style={ui.section}>Occurred date / time *</Text>
            <Text style={ui.muted}>
              Sri Lanka time (UTC+05:30). Enter YYYY-MM-DD and 24-hour HH:MM.
            </Text>
            <Input
              label="Occurred date *"
              value={form.date}
              onChangeText={(value) => change("date", value)}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              editable={!busy && eligible && !savedIncident}
            />
            <Input
              label="Occurred time *"
              value={form.time}
              onChangeText={(value) => change("time", value)}
              placeholder="HH:MM"
              maxLength={5}
              editable={!busy && eligible && !savedIncident}
            />
            {errors.occurredAt && (
              <Text accessibilityRole="alert" style={ui.error}>
                {errors.occurredAt}
              </Text>
            )}
          </View>
          <View style={ui.card}>
            <Text style={ui.section}>Incident Location</Text>
            <Text style={ui.muted}>
              Use a GPS fix at the incident or enter its known coordinates. This
              point is separate from your patrol trail.
            </Text>
            <IncidentButton
              title="Use Current GPS Location"
              loading={capture && location.waiting}
              disabled={busy || !eligible || !!savedIncident}
              onPress={() => {
                setCapture(true);
                location.retry();
              }}
            />
            {capture && (
              <IncidentButton
                title="Cancel GPS capture"
                secondary
                onPress={() => setCapture(false)}
              />
            )}
            {capture && location.error && (
              <>
                <Text accessibilityRole="alert" style={ui.error}>
                  {location.error.replace(
                    /live patrol navigation/gi,
                    "incident location",
                  )}
                </Text>
                <IncidentButton
                  title="Retry GPS"
                  secondary
                  onPress={location.retry}
                />
                {location.canOpenSettings && (
                  <IncidentButton
                    title="Open Settings"
                    secondary
                    onPress={location.openSettings}
                  />
                )}
              </>
            )}
            {fix && !manual && (
              <>
                <Text style={ui.body}>
                  Latitude: {form.latitude}
                  {"\n"}Longitude: {form.longitude}
                </Text>
                <Text style={ui.muted}>
                  Accuracy: {Math.round(fix.accuracy)} m · Captured:{" "}
                  {readableTime(fix.timestamp)}
                </Text>
                <Text style={ui.muted}>
                  This captured point stays fixed while you write the report.
                </Text>
              </>
            )}
            <IncidentButton
              title={
                manual
                  ? "Hide manual coordinates"
                  : "Enter known coordinates manually"
              }
              secondary
              disabled={busy || !eligible || !!savedIncident}
              onPress={() => {
                setManual((value) => !value);
                setFix(null);
                setCapture(false);
              }}
            />
            {manual && (
              <>
                <Text style={ui.muted}>
                  Enter the actual incident location, not an estimated or
                  example point. Review both coordinates before submitting.
                </Text>
                <Input
                  label="Latitude *"
                  value={form.latitude}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(value) => change("latitude", value)}
                  editable={!busy && eligible && !savedIncident}
                  error={errors.latitude}
                />
                <Input
                  label="Longitude *"
                  value={form.longitude}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(value) => change("longitude", value)}
                  editable={!busy && eligible && !savedIncident}
                  error={errors.longitude}
                />
              </>
            )}
            {!manual && (errors.latitude || errors.longitude) && (
              <Text accessibilityRole="alert" style={ui.error}>
                Capture a valid GPS location or enter known coordinates.
              </Text>
            )}
            {locationWarning && !acknowledged && (
              <>
                <Text accessibilityRole="alert" style={ui.error}>
                  The GPS fix is older than 30 seconds. Recapture your location,
                  or explicitly confirm that this fixed point is where the
                  incident occurred.
                </Text>
                <IncidentButton
                  title="Confirm captured incident location"
                  secondary
                  onPress={() => {
                    setAcknowledged(true);
                    setLocationWarning(false);
                  }}
                />
              </>
            )}
            {acknowledged && (
              <Text style={ui.muted}>
                You confirmed the captured point as the incident location.
              </Text>
            )}
          </View>
          <EvidenceDraft
            items={items}
            retainFiles={!!localId.current}
            setItems={setItems}
            existing={existingEvidence}
            existingCount={existingCount}
            disabled={!eligible || busy}
            onSelecting={setSelecting}
          />
          {progress && (
            <Text accessibilityLiveRegion="polite" style={ui.body}>
              {progress}
            </Text>
          )}
          {savedIncident && error && (
            <IncidentButton
              title="View Saved Incident"
              secondary
              disabled={busy || selecting}
              onPress={() => {
                Keyboard.dismiss();
                setLeaveAction({ type: "VIEW_SAVED_INCIDENT" });
              }}
            />
          )}
          {error && (
            <Text accessibilityRole="alert" style={ui.error}>
              {error}
            </Text>
          )}
          {Object.entries(errors)
            .filter(
              ([key]) =>
                ![
                  "incidentType",
                  "title",
                  "description",
                  "occurredAt",
                  "latitude",
                  "longitude",
                ].includes(key),
            )
            .map(([key, message]) => (
              <Text key={key} accessibilityRole="alert" style={ui.error}>
                {message}
              </Text>
            ))}
          <IncidentButton
            title={
              savedIncident
                ? "Retry Failed Uploads"
                : editing
                  ? "Save Changes"
                  : "Submit Incident"
            }
            loading={busy}
            disabled={
              !eligible ||
              capture ||
              selecting ||
              items.some((item) => item.cleanupBlocked || item.reselectRequired)
            }
            onPress={submit}
          />
          {offline && !editing && !savedIncident && <IncidentButton title="Save Draft on Device" secondary disabled={busy || selecting || !eligible} onPress={saveLocalDraft} />}
          {localStatus && <Text accessibilityLiveRegion="polite" style={ui.muted}>{localStatus.replaceAll("_", " ")}</Text>}
          <Text style={ui.muted}>
            {offline ? "Drafts and queued evidence stay on this device. Submission is confirmed only after server sync. Offline patrol status is a cached snapshot; server authorization is checked again during sync." : "A report is saved only after the server confirms it."}
          </Text>
        </>
      )}
      <Modal
        visible={!!leaveAction}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaveAction(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(16,59,46,.4)",
          }}
        >
          <View accessibilityViewIsModal style={ui.card}>
            <Text style={ui.section}>Discard unsaved changes?</Text>
            <Text style={ui.body}>
              {savedIncident
                ? "Your incident and uploaded evidence are saved. Unuploaded selections will be discarded."
                : "Your draft and selected evidence have not been submitted."}
            </Text>
            <IncidentButton
              title="Keep Editing"
              onPress={() => setLeaveAction(null)}
            />
            <IncidentButton
              title="Discard Changes"
              secondary
              color={palette.danger}
              onPress={() => {
                if (!localId.current) items.forEach(discardEvidenceFile);
                if (leaveAction?.type === "VIEW_SAVED_INCIDENT")
                  setSuccess(savedIncident);
                setAllowLeave(true);
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
