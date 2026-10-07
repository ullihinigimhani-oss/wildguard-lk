import React, { createContext, forwardRef, useContext } from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
} from "react-native";
import { fallbackFont, fontForWeight } from "../../constants/typography";
export const TypographyContext = createContext(true);
export function useFontStyle(style) {
  const ready = useContext(TypographyContext);
  const flattened = StyleSheet.flatten(style) || {};
  return ready
    ? { fontFamily: fontForWeight(flattened.fontWeight), fontWeight: "normal" }
    : { fontFamily: fallbackFont };
}
// Preserve layout, accessibility and native behaviour; resolve each static font face explicitly.
export const Text = forwardRef(function AppText({ style, ...props }, ref) {
  return (
    <NativeText
      {...props}
      ref={ref}
      style={[...(Array.isArray(style) ? style : [style]), useFontStyle(style)]}
    />
  );
});
export const TextInput = forwardRef(function AppTextInput(
  { style, ...props },
  ref,
) {
  return (
    <NativeTextInput
      {...props}
      ref={ref}
      style={[...(Array.isArray(style) ? style : [style]), useFontStyle(style)]}
    />
  );
});
