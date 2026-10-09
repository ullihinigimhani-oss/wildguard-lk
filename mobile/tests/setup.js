jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockWebView = React.forwardRef((props, ref) => <View {...props} ref={ref} />);
  return {
    __esModule: true,
    default: MockWebView,
    WebView: MockWebView,
  };
});
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
