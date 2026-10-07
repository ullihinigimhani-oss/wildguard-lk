import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  publicRegistrationRoles,
  roleLabel,
} from "../../constants/registrationRoles";
import RegistrationPhoto from "../../components/common/RegistrationPhoto";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { styles, colors } from "../../constants/theme";
import { registerAccount } from "../../services/authApi";
import {
  initialRegistration,
  passwordHelp,
  validateRegistration,
} from "../../utils/registration";
export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState("");
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(initialRegistration);
  const [visible, setVisible] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [policy, setPolicy] = useState(false);
  const pending = useRef(false);
  async function submit() {
    if (pending.current) return;
    const next = validateRegistration(values);
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    pending.current = true;
    setLoading(true);
    try {
      const result = await registerAccount({ ...values, role });
      setValues(initialRegistration);
      navigation.navigate("Login", {
        registered: true,
        approvalStatus: result.user.approvalStatus,
      });
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setMessage(
        error.response?.status === 409
          ? "An account with this email already exists."
          : error.response?.status === 400
            ? "Please check your details."
            : "We couldn't create your account. Please try again. If you already submitted, your account may have been created.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  if (step === 1)
    return (
      <Screen>
        <Text style={styles.eyebrow}>WILDGUARD LK</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Choose Your Role
        </Text>
        <Text style={styles.muted}>Select how you will use WildGuard LK.</Text>
        {publicRegistrationRoles.map(([value, label, description]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: role === value }}
            onPress={() => setRole(value)}
            style={[
              styles.card,
              {
                padding: 18,
                borderWidth: 2,
                borderColor: role === value ? colors.green : "#d8e2d8",
                backgroundColor: role === value ? "#e6efdf" : "white",
              },
            ]}
          >
            <Text style={styles.heading}>
              {label} {role === value && "✓"}
            </Text>
            <Text style={styles.muted}>{description}</Text>
          </Pressable>
        ))}
        <Button title="Continue" disabled={!role} onPress={() => setStep(2)} />
        <Button
          title="Already have an account? Sign In"
          secondary
          onPress={() => navigation.navigate("Login")}
        />
      </Screen>
    );
  return (
    <Screen>
      <Text style={styles.eyebrow}>WILDGUARD LK / REGISTRATION</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Create Account
      </Text>
      <Text style={styles.muted}>
        Small actions. A wilder tomorrow. Join a community caring for Sri
        Lanka’s wildlife.
      </Text>
      <Text style={styles.heading}>Registering as {roleLabel(role)}</Text>
      <Button
        title="Change role"
        secondary
        disabled={loading}
        onPress={() => setStep(1)}
      />
      <Text style={styles.muted}>
        {role === "COMMUNITY_USER"
          ? "Community accounts can sign in immediately after registration."
          : "Staff accounts require verification before sign-in."}
      </Text>
      <RegistrationPhoto disabled={loading} />
      {[
        ["name", "Full Name", "name"],
        ["email", "Email Address", "email"],
        ["phone", "Phone Number (optional)", "tel"],
        ["password", "Password", "new-password"],
        ["confirmPassword", "Confirm Password", "new-password"],
      ].map(([key, label, autoComplete]) => {
        const secret = key === "password" || key === "confirmPassword";
        return (
          <View key={key}>
            <Text style={styles.label}>
              {label}
              {key !== "phone" && " *"}
            </Text>
            <TextInput
              accessibilityLabel={label}
              autoComplete={autoComplete}
              autoCapitalize={key === "name" ? "words" : "none"}
              autoCorrect={false}
              keyboardType={
                key === "email"
                  ? "email-address"
                  : key === "phone"
                    ? "phone-pad"
                    : "default"
              }
              secureTextEntry={secret && !visible[key]}
              editable={!loading}
              value={values[key]}
              onChangeText={(text) => setValues({ ...values, [key]: text })}
              style={[
                styles.input,
                errors[key] && { borderColor: colors.error },
              ]}
            />
            {secret && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  (visible[key] ? "Hide " : "Show ") + label.toLowerCase()
                }
                onPress={() => setVisible({ ...visible, [key]: !visible[key] })}
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  alignSelf: "flex-end",
                  paddingHorizontal: 12,
                }}
              >
                <Text style={styles.muted}>
                  {visible[key] ? "Hide" : "Show"} {label.toLowerCase()}
                </Text>
              </Pressable>
            )}
            {key === "password" && (
              <Text style={styles.muted}>{passwordHelp}</Text>
            )}
            {errors[key] && (
              <Text accessibilityRole="alert" style={styles.error}>
                {errors[key]}
              </Text>
            )}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: policy }}
        onPress={() => setPolicy(!policy)}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={styles.heading}>{policy ? "−" : "+"} Terms & Privacy</Text>
      </Pressable>
      {policy && (
        <Text style={styles.muted}>
          WildGuard LK provides community and verified staff accounts. Use
          accurate information and use the service respectfully. Your name,
          email, optional phone number and a securely hashed password are stored
          to manage your account. Do not submit sensitive wildlife locations in
          account fields.
        </Text>
      )}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I accept the Terms & Privacy"
        accessibilityState={{
          checked: values.termsAccepted,
          disabled: loading,
        }}
        disabled={loading}
        onPress={() =>
          setValues({ ...values, termsAccepted: !values.termsAccepted })
        }
        style={{
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 26, color: colors.green }}>
          {values.termsAccepted ? "☑" : "☐"}
        </Text>
        <Text style={[styles.text, { flex: 1 }]}>
          I accept the Terms & Privacy *
        </Text>
      </Pressable>
      {errors.termsAccepted && (
        <Text accessibilityRole="alert" style={styles.error}>
          {errors.termsAccepted}
        </Text>
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
      )}
      <Button title="Create Account" loading={loading} onPress={submit} />
      <Button
        title="Already have an account? Sign In"
        secondary
        disabled={loading}
        onPress={() => navigation.navigate("Login")}
      />
    </Screen>
  );
}
