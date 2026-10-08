jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock(
  "react-native-webview",
  () => ({ WebView: require("react-native").View }),
  { virtual: true },
);
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
