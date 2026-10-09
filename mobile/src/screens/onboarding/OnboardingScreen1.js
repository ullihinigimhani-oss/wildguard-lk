import React from "react";
import OnboardingLayout from "../../components/OnboardingLayout";
export default function OnboardingScreen1({ navigation }) {
  return <OnboardingLayout navigation={navigation} page={1} nextRoute="Onboarding2"
    image={require("../../../assets/images/onboarding-wildlife.jpg")}
    title="Protect Sri Lanka's Wildlife"
    description="Helping rangers and communities protect wildlife through faster reporting and better field awareness." />;
}
