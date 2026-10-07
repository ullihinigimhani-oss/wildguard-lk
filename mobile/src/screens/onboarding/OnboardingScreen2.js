import React from "react";
import OnboardingLayout from "../../components/OnboardingLayout";
export default function OnboardingScreen2({ navigation }) {
  return <OnboardingLayout navigation={navigation} page={2} nextRoute="Onboarding3"
    image={require("../../../assets/images/onboarding-ranger.jpg")}
    title="Report. Respond. Protect."
    description="Record field incidents, capture evidence and help conservation teams respond quickly." />;
}
