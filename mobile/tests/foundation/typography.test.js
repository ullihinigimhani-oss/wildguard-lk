import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import {
  Text,
  TextInput,
  TypographyContext,
} from "../../src/components/common/Typography";
import {
  fontFamily,
  fallbackFont,
  typography,
} from "../../src/constants/typography";
test.each([
  ["400", fontFamily.regular],
  ["500", fontFamily.medium],
  ["600", fontFamily.semibold],
  ["700", fontFamily.bold],
])(
  "global text selects the loaded %s face and retains layout",
  (weight, family) => {
    const ui = render(
      <Text
        accessibilityLabel="Field label"
        style={[{ fontSize: 18, lineHeight: 26 }, { fontWeight: weight }]}
      >
        Field label
      </Text>,
    );
    const style = StyleSheet.flatten(ui.getByText("Field label").props.style);
    expect(style.fontFamily).toBe(family);
    expect(style.fontWeight).toBe("normal");
    expect(style.fontSize).toBe(18);
    expect(style.lineHeight).toBe(26);
  },
);
test("failed-font fallback preserves input interactions and accessibility", () => {
  const change = jest.fn();
  const ui = render(
    <TypographyContext.Provider value={false}>
      <Text style={typography.heading}>Heading</Text>
      <TextInput
        accessibilityLabel="Field notes"
        placeholder="Notes"
        onChangeText={change}
      />
    </TypographyContext.Provider>,
  );
  expect(
    StyleSheet.flatten(ui.getByText("Heading").props.style).fontFamily,
  ).toBe(fallbackFont);
  fireEvent.changeText(ui.getByLabelText("Field notes"), "Actual observation");
  expect(change).toHaveBeenCalledWith("Actual observation");
});
