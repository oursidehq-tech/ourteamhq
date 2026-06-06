import React from "react";
import LottieView from "lottie-react-native";

export default function LottieAnimation({ source, autoPlay, loop, style }) {
  const resolvedSource = typeof source === "string" ? { uri: source } : source;
  return (
    <LottieView
      source={resolvedSource}
      autoPlay={autoPlay}
      loop={loop}
      style={style}
    />
  );
}
