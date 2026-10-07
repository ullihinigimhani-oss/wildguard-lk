import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { listParks } from "../../services/parkApi";
import { styles, colors } from "../../constants/theme";
import Button from "./Button";
export default function ParkSelect({ value, onChange, disabled, error }) {
  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
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
  const selected = parks.find((park) => park.id === value);
  const choices = parks.filter((park) =>
    park.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>Park / Ranger Area *</Text>
      <Text style={styles.muted}>
        Select the park or ranger area where you are assigned to work.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Park / Ranger Area"
        accessibilityState={{ expanded: open, disabled: disabled || loading }}
        disabled={disabled || loading || !!failure}
        onPress={() => setOpen(!open)}
        style={styles.input}
      >
        <Text style={styles.text}>
          {loading ? "Loading parks…" : selected?.name || "Select Park / Area"}{" "}
          ▾
        </Text>
      </Pressable>
      {open && (
        <View style={{ gap: 8 }}>
          <TextInput
            accessibilityLabel="Search parks"
            placeholder="Search parks"
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            editable={!disabled}
          />
          {choices.map((park) => (
            <Pressable
              key={park.id}
              accessibilityRole="button"
              accessibilityLabel={"Select " + park.name}
              accessibilityState={{ selected: value === park.id, disabled }}
              disabled={disabled}
              onPress={() => {
                onChange(park.id);
                setOpen(false);
                setSearch("");
              }}
              style={[
                styles.card,
                {
                  padding: 14,
                  borderWidth: 1,
                  borderColor: value === park.id ? colors.green : "#d8e2d8",
                },
              ]}
            >
              <Text style={styles.text}>
                {park.name}
                {value === park.id ? " ✓" : ""}
              </Text>
            </Pressable>
          ))}
          {!choices.length && !!parks.length && (
            <Text style={styles.muted}>No matching parks.</Text>
          )}
        </View>
      )}
      {!loading && !failure && !parks.length && (
        <Text style={styles.muted}>
          No parks are configured. Contact your administrator.
        </Text>
      )}
      {!!failure && (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            {failure}
          </Text>
          <Button
            title="Retry parks"
            secondary
            disabled={disabled}
            onPress={() => setRetry((n) => n + 1)}
          />
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
