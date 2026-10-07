import React, { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { styles } from "../../constants/theme";
import ApprovalStatus from "../../components/common/ApprovalStatus";
import { getApprovalNotice } from "../../utils/loginStatus";
import { useAuth } from "../../hooks/useAuth";
export default function LoginScreen({ navigation, route }) {
  const { login, enterDemo } = useAuth();
  const pending = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState(null);
  const [message, setMessage] = useState("");
  async function submit() {
    if (pending.current) return;
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setMessage("");
    setApprovalNotice(null);
    if (Object.keys(next).length) return;
    pending.current = true;
    setLoading(true);
    try {
      await login({ email, password });
    } catch (error) {
      const notice = getApprovalNotice(error);
      setApprovalNotice(notice);
      if (!notice)
        setMessage(
          error.response?.status === 403
            ? error.response.data?.message || "Your account is not approved."
            : error.response?.status === 401
              ? "Invalid email or password."
              : error.response?.status === 400
                ? "Please check your email and password."
                : "We couldn't sign you in. Please try again.",
        );
    } finally {
      setPassword("");
      setLoading(false);
      pending.current = false;
    }
  }
  return (
    <Screen>
      {route?.params?.registered && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {route?.params?.approvalStatus === "PENDING"
            ? "Account created. Your account is awaiting approval before you can sign in."
            : "Account created successfully. Login to continue."}
        </Text>
      )}
      <Text style={styles.eyebrow}>WILDGUARD LK</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Welcome Back
      </Text>
      <Text style={styles.muted}>Sign in to continue to WildGuard LK</Text>
      <View>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="username"
          editable={!loading}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#627267"
        />
        {errors.email && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.email}
          </Text>
        )}
      </View>
      <View>
        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!loading}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          onPress={() => setVisible(!visible)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            alignSelf: "flex-end",
            paddingHorizontal: 12,
          }}
        >
          <Text style={styles.muted}>
            {visible ? "Hide password" : "Show password"}
          </Text>
        </Pressable>
        {errors.password && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.password}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={() =>
          setMessage(
            "Password reset is not available yet. Please contact your account administrator for help.",
          )
        }
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={styles.muted}>Forgot Password</Text>
      </Pressable>
      <Button title="Login" loading={loading} onPress={submit} />
      <ApprovalStatus notice={approvalNotice} />
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {message}
        </Text>
      )}
      <Button
        title="Explore ranger demo"
        disabled={loading}
        secondary
        onPress={() => {
          setPassword("");
          enterDemo();
        }}
      />
      <Button
        title="Create Account"
        secondary
        disabled={loading}
        onPress={() => navigation.navigate("Register")}
      />
      <Text style={styles.muted}>
        Staff accounts require verification before sign-in.
      </Text>
    </Screen>
  );
}
