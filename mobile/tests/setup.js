jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("react-native-webview", () => ({
  WebView: require("react-native").View,
}));
jest.mock("expo-video", () => ({
  VideoView: require("react-native").View,
  useVideoPlayer: () => {
    const React = require("react");
    return React.useMemo(
      () => ({
        pause: jest.fn(),
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      }),
      [],
    );
  },
}));

jest.mock("@expo/vector-icons/Feather", () => {
  const React = require("react");
  const { View } = require("react-native");
  return (props) => <View {...props} />;
});
jest.mock(
  "@expo/vector-icons/Ionicons",
  () => {
    const React = require("react");
    const { Text } = require("react-native");
    return function MockIonicons(props) {
      return <Text {...props}>{props.name}</Text>;
    };
  },
  { virtual: true },
);
