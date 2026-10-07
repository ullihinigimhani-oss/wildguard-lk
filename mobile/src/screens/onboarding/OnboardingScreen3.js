import React from "react";
import OnboardingLayout from "../../components/OnboardingLayout";
export default function OnboardingScreen3({ navigation }) {
  return <OnboardingLayout navigation={navigation} page={3}
    image={require("../../../assets/images/onboarding-monitoring.jpg")}
    title="Connected in the Field"
    description="Access patrol information, wildlife alerts and field reports wherever your work takes you." />;
}
