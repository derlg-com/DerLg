import { Composition, registerRoot } from "remotion";
import { IntroScene } from "./compositions/IntroScene";
import { ProblemScene } from "./compositions/ProblemScene";
import { SolutionScene } from "./compositions/SolutionScene";
import { AiChatScene } from "./compositions/AiChatScene";
import { FeaturesScene } from "./compositions/FeaturesScene";
import { SafetyScene } from "./compositions/SafetyScene";
import { CtaScene } from "./compositions/CtaScene";
import type { CompositionProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DerLgDemo"
        component={IntroScene}
        durationInFrames={7 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: "DerLg",
          subtitle: "Book Cambodia trips by chatting with AI",
          color: "#0f766e",
        } satisfies CompositionProps}
      />
      <Composition
        id="ProblemScene"
        component={ProblemScene}
        durationInFrames={12 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          stressText: "Too many tabs. Too many choices.",
          color: "#64748b",
        } satisfies CompositionProps}
      />
      <Composition
        id="SolutionScene"
        component={SolutionScene}
        durationInFrames={8 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          tagline: "One chat. Your perfect trip.",
          color: "#0f766e",
        } satisfies CompositionProps}
      />
      <Composition
        id="AiChatScene"
        component={AiChatScene}
        durationInFrames={22 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          userMessage: "Plan a 3-day Siem Reap temple tour",
          aiResponse: "Here are your curated options!",
          color: "#0f766e",
        } satisfies CompositionProps}
      />
      <Composition
        id="FeaturesScene"
        component={FeaturesScene}
        durationInFrames={20 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          color: "#0f766e",
        } satisfies CompositionProps}
      />
      <Composition
        id="SafetyScene"
        component={SafetyScene}
        durationInFrames={10 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          color: "#dc2626",
        } satisfies CompositionProps}
      />
      <Composition
        id="CtaScene"
        component={CtaScene}
        durationInFrames={10 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          ctaText: "Install DerLg PWA — your Cambodia trip starts with a chat",
          color: "#0f766e",
        } satisfies CompositionProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
