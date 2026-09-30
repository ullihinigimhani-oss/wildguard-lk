import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { styles, colors } from "../../constants/theme";
import { registerAccount } from "../../services/authApi";
import { initialRegistration, passwordHelp, validateRegistration } from "../../utils/registration";
export default function RegisterScreen({ navigation }) {
 const [values,setValues] = useState(initialRegistration);
 const [visible,setVisible] = useState({});
 const [errors,setErrors] = useState({});
 const [loading,setLoading] = useState(false);
 const [message,setMessage] = useState("");
 const [policy,setPolicy] = useState(false);
 const pending = useRef(false);
 async function submit() {
  if (pending.current) return;
  const next = validateRegistration(values); setErrors(next); setMessage("");
  if (Object.keys(next).length) return;
  pending.current=true; setLoading(true);
  try { await registerAccount(values); setValues(initialRegistration); navigation.navigate("Login", { registered: true }); }
  catch(error) { setErrors(error.response?.data?.errors || {}); setMessage(error.response?.status === 409 ? "An account with this email already exists." : error.response?.status === 400 ? "Please check your details." : "We couldn't create your account. Please try again. If you already submitted, your account may have been created."); }
  finally { pending.current=false; setLoading(false); }
 }
 return <Screen>
  <Text style={styles.eyebrow}>WILDGUARD LK / COMMUNITY</Text>
  <Text accessibilityRole="header" style={styles.title}>Create Account</Text>
  <Text style={styles.muted}>Small actions. A wilder tomorrow. Join a community caring for Sri Lanka’s wildlife.</Text>
  <View style={styles.notice}><Text style={styles.muted}>A community account for residents. Staff accounts are managed separately.</Text></View>
  {[["name","Full Name","name"],["email","Email Address","email"],["phone","Phone Number (optional)","tel"],["password","Password","new-password"],["confirmPassword","Confirm Password","new-password"]].map(([key,label,autoComplete]) => {
   const secret = key === "password" || key === "confirmPassword";
   return <View key={key}><Text style={styles.label}>{label}{key !== "phone" && " *"}</Text>
    <TextInput accessibilityLabel={label} autoComplete={autoComplete} autoCapitalize={key === "name" ? "words" : "none"} autoCorrect={false} keyboardType={key === "email" ? "email-address" : key === "phone" ? "phone-pad" : "default"} secureTextEntry={secret && !visible[key]} editable={!loading} value={values[key]} onChangeText={text => setValues({...values,[key]:text})} style={[styles.input,errors[key] && {borderColor:colors.error}]} />
    {secret && <Pressable accessibilityRole="button" accessibilityLabel={(visible[key] ? "Hide " : "Show ")+label.toLowerCase()} onPress={() => setVisible({...visible,[key]:!visible[key]})} style={{minHeight:48,justifyContent:"center",alignSelf:"flex-end",paddingHorizontal:12}}><Text style={styles.muted}>{visible[key] ? "Hide" : "Show"} {label.toLowerCase()}</Text></Pressable>}
    {key === "password" && <Text style={styles.muted}>{passwordHelp}</Text>}
    {errors[key] && <Text accessibilityRole="alert" style={styles.error}>{errors[key]}</Text>}
   </View>;
  })}
  <Pressable accessibilityRole="button" accessibilityState={{expanded:policy}} onPress={() => setPolicy(!policy)} style={{minHeight:48,justifyContent:"center"}}><Text style={styles.heading}>{policy ? "−" : "+"} Terms & Privacy</Text></Pressable>
  {policy && <Text style={styles.muted}>This conservation prototype provides community accounts. Use accurate information and use the service respectfully. Your name, email, optional phone number and a securely hashed password are stored to manage your account. Do not submit sensitive wildlife locations in account fields.</Text>}
  <Pressable accessibilityRole="checkbox" accessibilityLabel="I accept the Terms & Privacy" accessibilityState={{checked:values.termsAccepted,disabled:loading}} disabled={loading} onPress={() => setValues({...values,termsAccepted:!values.termsAccepted})} style={{minHeight:52,flexDirection:"row",alignItems:"center",gap:12}}><Text style={{fontSize:26,color:colors.green}}>{values.termsAccepted ? "☑" : "☐"}</Text><Text style={[styles.text,{flex:1}]}>I accept the Terms & Privacy *</Text></Pressable>
  {errors.termsAccepted && <Text accessibilityRole="alert" style={styles.error}>{errors.termsAccepted}</Text>}
  {!!message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
  <Button title="Create Account" loading={loading} onPress={submit} />
  <Button title="Already have an account? Sign In" secondary disabled={loading} onPress={() => navigation.navigate("Login")} />
 </Screen>;
}
