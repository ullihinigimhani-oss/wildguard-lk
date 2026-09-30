import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { styles } from "../../constants/theme";
import { useDemoAuth } from "../../hooks/useDemoAuth";
export default function LoginScreen({ navigation, route }) {
  const { enterDemo } = useDemoAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setLoading(false);
    setPassword("");
    setMessage(
      "Staff sign-in is coming soon. No credentials were sent or saved. Use the demo preview below.",
    );
  }
  return (
    <Screen>
      {route?.params?.registered && <Text accessibilityLiveRegion="polite" style={styles.notice}>Account created successfully. Sign-in is coming soon; your community account has been saved.</Text>}
      <Text style={styles.eyebrow}>WILDGUARD LK / RANGER WORKSPACE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Ready for the field?
      </Text>
      <Text style={styles.muted}>Sign in to your ranger workspace.</Text>
      <View style={styles.notice}>
        <Text style={styles.muted}>
          Authentication UI preview. Please do not enter real credentials.
        </Text>
      </View>
      <View>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="username"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="you@example.test"
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
      <Text style={styles.muted}>
        Remember me · Available with real authentication. This preview does not
        save sessions.
      </Text>
      <Button title="Log in" loading={loading} onPress={submit} />
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {message}
        </Text>
      )}
      <Button
        title="Explore ranger demo"
        secondary
        onPress={() => {
          setPassword("");
          enterDemo();
        }}
      />
      <Button title="Create a community account" secondary onPress={() => navigation.navigate("Register")} />
      <Text style={styles.muted}>
        Staff accounts are provisioned by authorized personnel. No public staff
        registration is available.
      </Text>
    </Screen>
  );
}
