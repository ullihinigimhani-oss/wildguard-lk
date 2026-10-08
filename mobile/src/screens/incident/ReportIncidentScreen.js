import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Modal, View } from "react-native";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import { useAuth } from "../../hooks/useAuth";
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
export default function ReportIncidentScreen({ route, navigation }) {
  const { user } = useAuth(),
    focused = useIsFocused();
  const incidentId = route.params?.incidentId,
    patrolId = route.params?.patrolId;
  const editing = !!incidentId;
  const [items, setItems] = useState([]),
    [savedIncident, setSavedIncident] = useState(null),
    [progress, setProgress] = useState(null),
    [selecting, setSelecting] = useState(false);
  const savedRef = useRef(null);
  const loader = useCallback(
    (signal) =>
      editing ? getIncident(incidentId, signal) : getMyPatrol(patrolId, signal),
    [editing, incidentId, patrolId],
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
    items.some((item) => item.status !== "uploaded");
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
  async function submit() {
    if (pending.current || !eligible || selecting) return;
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
      {initial !== null && (
        <>
          <Text style={ui.section}>Incident type *</Text>
          {INCIDENT_TYPES.map((type) => (
            <SelectCard
              key={type.code}
              {...type}
              selected={form.incidentType === type.code}
              onPress={() => change("incidentType", type.code)}
              disabled={busy || !eligible || !!savedIncident}
            />
          ))}
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
          <Text style={ui.muted}>
            A report is saved only after the server confirms it. No offline
            submission queue is available.
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
                items.forEach(discardEvidenceFile);
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
