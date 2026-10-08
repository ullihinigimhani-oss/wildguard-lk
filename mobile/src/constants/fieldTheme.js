import React from "react";

// Presentation only: scoped to the Ranger stack, including its detail screens.
export const RangerVisualContext = React.createContext(false);
export const fieldColors = {
  forest: "#123D29",
  secondary: "#2F6547",
  sage: "#DCEDE1",
  background: "#F8FAF7",
  white: "#FFFFFF",
  amber: "#E89B42",
  alert: "#D85B4B",
  text: "#17241C",
  muted: "#596B60", // Readable secondary text on the light surfaces.
  softText: "#718078",
  danger: "#A53529",
  border: "#E2E9E2",
};
export const fieldCard = {
  backgroundColor: fieldColors.white,
  borderRadius: 24,
  padding: 20,
  gap: 14,
  borderWidth: 1,
  borderColor: fieldColors.border,
  shadowColor: fieldColors.forest,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.045,
  shadowRadius: 14,
  elevation: 2,
};
