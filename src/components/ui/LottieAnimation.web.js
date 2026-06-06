import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { View } from "react-native";

export default function LottieAnimation({ source, autoPlay, loop, style }) {
  const src = typeof source === "string" ? source : (source?.uri || "");

  return (
    <View style={style}>
      {src ? (
        <DotLottieReact
          src={src}
          autoplay={autoPlay}
          loop={loop}
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}
    </View>
  );
}
