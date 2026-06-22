import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

interface AiChatProps {
  userMessage?: string;
  aiResponse?: string;
  color?: string;
}

const chatMessages = [
  { role: "user" as const, text: "Plan a 3-day Siem Reap temple tour", delay: 0 },
  { role: "ai" as const, text: "Here are your curated options!", delay: 1.2 },
];

export const AiChatScene: React.FC<AiChatProps> = ({
  userMessage = "Plan a 3-day Siem Reap temple tour",
  aiResponse = "Here are your curated options!",
  color = "#0f766e",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone frame entrance
  const phoneOp = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const phoneScale = interpolate(frame, [0, 0.8 * fps], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phone subtle floating
  const floatY = interpolate(frame % (5 * fps), [0, 2.5 * fps, 5 * fps], [0, -6, 0], {
    extrapolateRight: "clamp",
  });

  // Screen glow
  const glowOp = interpolate(frame % (2 * fps), [0, fps, 2 * fps], [0.15, 0.3, 0.15], {
    extrapolateRight: "clamp",
  });

  // User bubble animation
  const userBubbleX = interpolate(frame, [0.5 * fps, 1.2 * fps], [50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const userBubbleOp = interpolate(frame, [0.5 * fps, 0.9 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // AI bubble animation
  const aiBubbleX = interpolate(frame, [1.5 * fps, 2.3 * fps], [-50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const aiBubbleOp = interpolate(frame, [1.5 * fps, 2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typing indicator dots bounce
  const typingDotsVisible = interpolate(frame, [2.5 * fps, 2.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dotBounce = (offset: number) =>
    interpolate((frame - 2.8 * fps - offset * 6) % (1 * fps), [0, 0.5 * fps, fps], [0, -7, 0], {
      extrapolateRight: "clamp",
    });

  // Travel card: spring slide up
  const cardSpring = spring({ frame: frame - 4 * fps, fps, config: { damping: 12, stiffness: 70 } });
  const cardY = interpolate(cardSpring, [0, 1], [40, 0]);
  const cardScale = interpolate(cardSpring, [0, 0.7], [0.9, 1]);
  const cardOp = interpolate(frame, [3.8 * fps, 4.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card inner items stagger
  const cardItems = ["3 days / 2 nights", "Verified local guide", "From $189"];
  const cardItemColors = ["#64748b", "#64748b", color];

  // Tiny floating emojis around the card
  const emojiParticles = [
    { emoji: "✈️", x: -40, y: -30, delay: 0 },
    { emoji: "🏛️", x: 50, y: -40, delay: 0.2 },
    { emoji: "📍", x: -35, y: 30, delay: 0.4 },
    { emoji: "🌴", x: 45, y: 25, delay: 0.15 },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Phone container */}
      <div
        style={{
          width: 340,
          height: 640,
          background: "white",
          borderRadius: 36,
          boxShadow: `0 0 100px rgba(15,118,110,${glowOp}), 0 30px 80px rgba(15,118,110,0.15)`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          opacity: phoneOp,
          transform: `scale(${phoneScale}) translateY(${floatY}px)`,
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${color} 0%, #14b8a6 100%)`,
            padding: "16px 20px",
            color: "white",
            fontWeight: 600,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "white",
              opacity: interpolate(frame % (8), [0, 4, 8], [1, 0.3, 1], { extrapolateRight: "clamp" }),
            }}
          />
          DerLg ✦ AI Concierge
        </div>

        {/* Chat body */}
        <div
          style={{
            flex: 1,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "#f8fafc",
          }}
        >
          {/* User message */}
          <div
            style={{
              alignSelf: "flex-end",
              background: `linear-gradient(135deg, ${color} 0%, #14b8a6 100%)`,
              color: "white",
              padding: "12px 18px",
              borderRadius: 18,
              borderBottomRightRadius: 6,
              fontSize: 14,
              maxWidth: "82%",
              lineHeight: 1.5,
              opacity: userBubbleOp,
              transform: `translateX(${userBubbleX}px)`,
              boxShadow: `0 4px 14px ${color}35`,
            }}
          >
            {userMessage}
          </div>

          {/* AI message */}
          <div
            style={{
              alignSelf: "flex-start",
              background: "white",
              color: "#1e293b",
              padding: "12px 18px",
              borderRadius: 18,
              borderBottomLeftRadius: 6,
              fontSize: 14,
              maxWidth: "85%",
              lineHeight: 1.5,
              opacity: aiBubbleOp,
              transform: `translateX(${aiBubbleX}px)`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
            }}
          >
            {aiResponse}
          </div>

          {/* Animated typing dots */}
          <div
            style={{
              alignSelf: "flex-start",
              opacity: typingDotsVisible,
              display: "flex",
              gap: 6,
              padding: "6px 4px",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "#94a3b8",
                  transform: `translateY(${dotBounce(i)}px)`,
                }}
              />
            ))}
          </div>

          {/* Travel card */}
          <div
            style={{
              opacity: cardOp,
              transform: `translateY(${cardY}px) scale(${cardScale})`,
              marginTop: 8,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.09)",
                border: "1px solid #e2e8f0",
              }}
            >
              {/* Card image area */}
              <div
                style={{
                  height: 110,
                  background: `linear-gradient(135deg, ${color} 0%, #14b8a6 40%, #5eead4 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Shimmer overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)`,
                    transform: `translateX(${interpolate(frame % (3 * fps), [0, 3 * fps], [-100, 200], { extrapolateRight: "clamp" })}%)`,
                  }}
                />
                🏛️ Angkor Wat 3-Day Tour
              </div>

              {/* Card details */}
              <div style={{ padding: "14px 16px" }}>
                {cardItems.map((item, i) => {
                  const itemOp = interpolate(
                    frame,
                    [4.2 * fps + i * 0.15 * fps, 4.8 * fps + i * 0.15 * fps],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
                  );
                  const itemX = interpolate(
                    frame,
                    [4.2 * fps + i * 0.15 * fps, 4.8 * fps + i * 0.15 * fps],
                    [-10, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
                  );
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: i < cardItems.length - 1 ? "1px solid #f1f5f9" : "none",
                        opacity: itemOp,
                        transform: `translateX(${itemX}px)`,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                        {i === 0 ? "Duration" : i === 1 ? "Guide" : "Price"}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: i === 2 ? color : "#1e293b",
                        }}
                      >
                        {item}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating emoji particles */}
      {emojiParticles.map((e, i) => {
        const eFrame = frame - e.delay * fps;
        const eFloatY = interpolate(eFrame % (3 * fps), [0, 1.5 * fps, 3 * fps], [0, -20, 0], {
          extrapolateRight: "clamp",
        });
        const eFloatX = Math.sin(eFrame * 0.06) * 12;
        const eOp = interpolate(eFrame % (3 * fps), [0, 0.3 * fps, 2.5 * fps, 3 * fps], [0, 0.7, 0.7, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${e.x + eFloatX}px)`,
              top: `calc(50% + ${e.y + eFloatY}px)`,
              fontSize: 22,
              opacity: eOp,
              zIndex: 3,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
            }}
          >
            {e.emoji}
          </div>
        );
      })}
    </div>
  );
};
