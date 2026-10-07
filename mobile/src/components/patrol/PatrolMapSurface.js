import React from "react";
import { Linking } from "react-native";
import { WebView } from "react-native-webview";
const attributionUrls = [
  "https://www.openstreetmap.org/copyright",
  "https://leafletjs.com",
  "https://leafletjs.com/",
];
export default function PatrolMapSurface({ html, onMessage, onError }) {
  function navigationAllowed(request) {
    if (
      request.url === "about:blank" ||
      request.url === "https://wildguard-map.invalid/"
    )
      return true;
    if (attributionUrls.includes(request.url))
      Linking.openURL(request.url).catch(() => {});
    return false;
  }
  return (
    <WebView
      testID="planned-route-webview"
      accessibilityLabel="Planned patrol route map"
      style={{ flex: 1, backgroundColor: "#edf3ed" }}
      source={{ html, baseUrl: "https://wildguard-map.invalid/" }}
      originWhitelist={["*"]}
      javaScriptEnabled
      scrollEnabled={false}
      nestedScrollEnabled
      geolocationEnabled={false}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never"
      applicationNameForUserAgent="WildGuardLK/1.0"
      onShouldStartLoadWithRequest={navigationAllowed}
      onOpenWindow={(event) =>
        navigationAllowed({ url: event.nativeEvent.targetUrl })
      }
      onMessage={(event) => {
        try {
          onMessage(JSON.parse(event.nativeEvent.data));
        } catch {
          /* Ignore malformed bridge messages. */
        }
      }}
      onError={onError}
      onHttpError={onError}
      onContentProcessDidTerminate={onError}
    />
  );
}
