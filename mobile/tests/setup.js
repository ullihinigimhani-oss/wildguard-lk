jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("react-native-webview", () => ({ WebView: require("react-native").View }));
