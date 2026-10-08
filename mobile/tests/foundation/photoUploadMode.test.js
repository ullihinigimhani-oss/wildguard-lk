import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import PhotoUploadMode from "../../src/components/incident/PhotoUploadMode";

test("quality selection is explicit, warns about metadata loss and preserves an original option", () => {
  const onChange = jest.fn();
  const screen = render(<PhotoUploadMode value="original" onChange={onChange} />);
  expect(screen.getByText(/embedded metadata may be removed/)).toBeTruthy();
  fireEvent.press(screen.getByText("Use optimized photos (faster)"));
  expect(onChange).toHaveBeenCalledWith("optimized");
  screen.rerender(<PhotoUploadMode value="optimized" onChange={onChange} />);
  fireEvent.press(screen.getByText("Use original quality"));
  expect(onChange).toHaveBeenLastCalledWith("original");
});

test("cannot change quality during selection/upload", () => {
  const onChange = jest.fn();
  const screen = render(<PhotoUploadMode value="original" onChange={onChange} disabled />);
  fireEvent.press(screen.getByText("Use optimized photos (faster)"));
  expect(onChange).not.toHaveBeenCalled();
});
