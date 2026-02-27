"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Eye, EyeOff, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChatMessage as ChatMessageType, type MappingEntry } from "@/store/session-store";
import { deAnonymize } from "@/lib/anonymizer/de-anonymizer";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  message: ChatMessageType;
  mapping: MappingEntry[];
  showRealNames: boolean;
}

function FlameIcon({ animated = false }: { animated?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!animated || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2 + 4;
    const MAX = 35;
    const particles = particlesRef.current;
    particles.length = 0;

    function spawn() {
      return {
        x: cx + (Math.random() - 0.5) * 10,
        y: cy + 2,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(0.4 + Math.random() * 0.8),
        life: 1,
        decay: 0.01 + Math.random() * 0.02,
        size: 0.5 + Math.random() * 1.5,
        hue: 20 + Math.random() * 25,
      };
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      if (particles.length < MAX && Math.random() > 0.3) {
        particles.push(spawn());
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx + (Math.random() - 0.5) * 0.3;
        p.y += p.vy;
        p.vy *= 0.99;
        p.life -= p.decay;
        p.size *= 0.995;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const alpha = p.life * 0.7;
        const lightness = 50 + (1 - p.life) * 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${lightness}%, ${alpha})`;
        ctx.fill();
        if (p.life > 0.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${alpha * 0.15})`;
          ctx.fill();
        }
      }
      const glowAlpha = 0.15 + Math.sin(Date.now() / 300) * 0.08;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      grad.addColorStop(0, `rgba(255, 150, 50, ${glowAlpha})`);
      grad.addColorStop(1, "rgba(255, 107, 53, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      animFrameRef.current = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animated]);

  return (
    <div style={{ position: "relative", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {animated && (
        <canvas
          ref={canvasRef}
          width={44}
          height={44}
          style={{ position: "absolute", inset: "-8px", zIndex: 1, pointerEvents: "none" }}
        />
      )}
      <span style={{ fontSize: "18px", position: "relative", zIndex: 2, lineHeight: 1, filter: animated ? "none" : "drop-shadow(0 0 2px rgba(255,107,53,0.3))" }}>🔥</span>
    </div>
  );
}


export function ChatMessage({ message, mapping, showRealNames: initialShowReal }: ChatMessageProps) {
  const [localShowReal, setLocalShowReal] = useState(initialShowReal);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const displayContent = useMemo(() => {
    if (!isAssistant || !localShowReal || !mapping || mapping.length === 0) {
      return message.content;
    }
    return deAnonymize(message.content, mapping);
  }, [message.content, mapping, localShowReal, isAssistant]);

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div
          className="max-w-[80%] rounded-xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-sm whitespace-pre-wrap break-words" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans', sans-serif" }}>
            {displayContent}
          </div>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    const isThinking = message.isStreaming && !message.content;

    return (
      <div className="flex w-full justify-start gap-2.5">
        <FlameIcon animated={!!message.isStreaming} />
        <div className="max-w-[80%]">
          {isThinking ? (
            <div className="flex items-center gap-2 py-2">
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                Thinking...
              </span>
            </div>
          ) : (
            <>
              <div className="burnchat-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
                {message.isStreaming && message.content && (
                  <span
                    className="inline-block ml-0.5"
                    style={{
                      width: "6px",
                      height: "14px",
                      background: "#ff6b35",
                      borderRadius: "1px",
                      animation: "blink 1s step-end infinite",
                      verticalAlign: "text-bottom",
                    }}
                  />
                )}
              </div>

              {/* Footer */}
              {!message.isStreaming && (
                <div className="mt-2 flex items-center gap-3 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  {mapping && mapping.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocalShowReal(!localShowReal)}
                      className="h-6 gap-1 px-2 text-xs"
                      style={{ color: localShowReal ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
                    >
                      {localShowReal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {localShowReal ? "Hide real names" : "Show real names"}
                    </Button>
                  )}
                  {message.creditsUsed != null && message.creditsUsed > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                      <Coins className="h-3 w-3" />
                      {message.creditsUsed} credit{message.creditsUsed !== 1 ? "s" : ""}
                    </span>
                  )}
                  {message.tokenCount && (
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                      {message.tokenCount.input + message.tokenCount.output} tokens
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          <style jsx global>{`
            @keyframes blink {
              50% { opacity: 0; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return null;
}
