"use client";

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { anonymizeText } from "@/lib/anonymizer/anonymizer";
import { initGliner, isGlinerReady } from "@/lib/anonymizer/gliner-engine";
import { deAnonymize } from "@/lib/anonymizer/de-anonymizer";
import PrivacyShield from "@/components/privacy-shield";
import BurnButton from "@/components/burn-button";
import AnonymizationDiff from "@/components/anonymization-diff";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, ArrowUp, Mic, MicOff, Coins } from "lucide-react";
import AttachmentMenu from "@/components/attachment-menu";

// Audio reactive bars component
function AudioBars({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 5;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 3;
      const gap = 3;
      const totalWidth = barCount * barWidth + (barCount - 1) * gap;
      const startX = (canvas.width - totalWidth) / 2;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength * 0.5);
        const value = dataArray[dataIndex] / 255;
        const minHeight = 4;
        const maxHeight = canvas.height - 4;
        const barHeight = minHeight + value * (maxHeight - minHeight);

        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = `rgba(255, 107, 53, ${0.5 + value * 0.5})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={28}
      style={{ display: "block" }}
    />
  );
}

export default function ChatInput() {
  const [text, setText] = useState("");
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [modelReady, setModelReady] = useState(false);
  const [lastDiff, setLastDiff] = useState<{
    original: string;
    anonymized: string;
    mapping: import("@/store/session-store").MappingEntry[];
    context?: string;
  } | null>(null);
  const [diffCollapsed, setDiffCollapsed] = useState(false);
  const pendingMessageRef = useRef<string | null>(null);

  // Auto-collapse diff when AI finishes responding
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && lastDiff) {
      setDiffCollapsed(true);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, lastDiff]);

  // Poll for model readiness (checks every 500ms until ready)
  useEffect(() => {
    if (modelReady) return;
    const check = () => {
      if (isGlinerReady()) {
        setModelReady(true);
        // If there's a queued message, send it now
        if (pendingMessageRef.current) {
          const msg = pendingMessageRef.current;
          pendingMessageRef.current = null;
          doSendRef.current?.(msg);
        }
      }
    };
    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [modelReady]);

  const [isRecording, setIsRecording] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [noSpeechSupport, setNoSpeechSupport] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const messages = useSessionStore((s) => s.messages);
  const selectedModel = useSessionStore((s) => s.selectedModel);
  const sessionId = useSessionStore((s) => s.sessionId);
  const sessionMode = useSessionStore((s) => s.sessionMode);
  const token = useSessionStore((s) => s.token);
  const documents = useSessionStore((s) => s.documents);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const creditBalance = useSessionStore((s) => s.creditBalance);
  const creditsExhausted = useSessionStore((s) => s.creditsExhausted);
  const addMessage = useSessionStore((s) => s.addMessage);
  const updateLastAssistantMessage = useSessionStore(
    (s) => s.updateLastAssistantMessage
  );
  const setStreamingComplete = useSessionStore((s) => s.setStreamingComplete);
  const setIsStreaming = useSessionStore((s) => s.setIsStreaming);
  const currentMapping = useSessionStore((s) => s.currentMapping);
  const setCurrentMapping = useSessionStore((s) => s.setCurrentMapping);

  const setShowAttachmentMenu = useUIStore((s) => s.setShowAttachmentMenu);
  const setShowCreditModal = useUIStore((s) => s.setShowCreditModal);
  const setCreditModalReason = useUIStore((s) => s.setCreditModalReason);
  const setShowSignInModal = useUIStore((s) => s.setShowSignInModal);
  const setPendingAction = useUIStore((s) => s.setPendingAction);
  const pendingAction = useUIStore((s) => s.pendingAction);

  const hasText = text.trim().length > 0;
  const hasDocument = documents.length > 0;

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 5;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    adjustTextareaHeight();
  };

  // ---- VOICE INPUT ----
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAnalyserNode(null);
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNoSpeechSupport(true);
      setTimeout(() => setNoSpeechSupport(false), 3000);
      return;
    }

    try {
      // Get mic stream for visualizer
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      setAnalyserNode(analyser);

      // Set up speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;

      let finalTranscript = "";

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interim = transcript;
          }
        }
        // Show live transcription in the text field
        setText((prev) => {
          const base = prev.replace(/\u200B.*$/, ""); // remove previous interim
          const combined = (finalTranscript + interim).trim();
          return combined || base;
        });
      };

      recognition.onerror = () => {
        stopRecording();
      };

      recognition.onend = () => {
        // Only stop if we initiated the stop
        if (isRecording) {
          stopRecording();
        }
      };

      recognition.start();
      setIsRecording(true);
    } catch {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => { stopRecording(); };
  }, [stopRecording]);

  // ---- SEND LOGIC ----
  const doSendRef = useRef<((msg: string) => Promise<void>) | null>(null);
  const doSend = useCallback(async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isStreaming) return;

    if (creditsExhausted) {
      setCreditModalReason("exhausted");
      setShowCreditModal(true);
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // --- Privacy Shield: Anonymize before sending ---
    let textForApi = trimmed;
    let activeMapping = currentMapping;

    if (privacyEnabled) {
      try {
        const anonResult = await anonymizeText(trimmed, currentMapping);
        textForApi = anonResult.anonymizedText;
        activeMapping = anonResult.mapping;
        setCurrentMapping(activeMapping);

        if (anonResult.entitiesFound > 0) {
          setLastDiff({
            original: trimmed,
            anonymized: textForApi,
            mapping: activeMapping,
            context: anonResult.detectedContext,
          });
          setDiffCollapsed(false);
        }
      } catch (err) {
        console.warn("Anonymization failed, sending raw:", err);
      }
    }

    const chatHistory = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.anonymizedContent || m.content }));
    chatHistory.push({ role: "user", content: textForApi });

    addMessage({ id: userMessageId, role: "user", content: trimmed, anonymizedContent: textForApi });
    addMessage({ id: assistantMessageId, role: "assistant", content: "", isStreaming: true });

    setText("");
    setIsStreaming(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const options: {
        sessionId?: string | null;
        anonymizedDocument?: string | null;
        token?: string | null;
      } = { token };

      if (sessionMode === "quick" && hasDocument) {
        const doc = documents[0];
        if (doc?.anonymizedText) {
          options.anonymizedDocument = doc.anonymizedText;
        }
      }

      if (sessionMode === "session" && sessionId) {
        options.sessionId = sessionId;
      }

      const url = "/api/chat";
      const body = JSON.stringify({
        model: selectedModel,
        messages: chatHistory,
        session_id: options.sessionId,
        anonymized_document: options.anonymizedDocument,
        session_token: options.token,
      });

      const { readerPromise } = apiClient._createSSEReader(url, body, token);
      const reader = await readerPromise;
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                fullContent += data.content;
                const displayContent = privacyEnabled
                  ? deAnonymize(fullContent, activeMapping)
                  : fullContent;
                updateLastAssistantMessage(displayContent);
              } else if (data.type === "done") {
                const serverBalance = data.usage?.credit_balance;
                setStreamingComplete(
                  assistantMessageId,
                  data.usage?.credits_used ?? 0,
                  { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
                  serverBalance
                );
                if (data.credits_exhausted) {
                  setCreditModalReason("exhausted");
                  setShowCreditModal(true);
                }
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch {
      updateLastAssistantMessage("Something went wrong. Please try again.");
      setIsStreaming(false);
    }
  }, [
    isStreaming, messages, selectedModel, sessionId, sessionMode,
    token, documents, hasDocument, creditsExhausted, addMessage,
    updateLastAssistantMessage, setStreamingComplete, setIsStreaming,
    setShowCreditModal, setCreditModalReason, privacyEnabled,
    currentMapping, setCurrentMapping,
  ]);

  // Keep ref in sync for polling effect
  useEffect(() => { doSendRef.current = doSend; }, [doSend]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Stop recording if active
    if (isRecording) stopRecording();

    // AUTH GATE: require sign-in before sending
    if (!token) {
      setPendingAction({ type: "message", data: trimmed });
      setShowSignInModal(true);
      return;
    }

    // If privacy is on but model not ready, queue the message
    if (privacyEnabled && !modelReady) {
      pendingMessageRef.current = trimmed;
      setText("");
      // Show a temporary "waiting" message
      const waitId = `system-${Date.now()}`;
      addMessage({
        id: waitId,
        role: "assistant",
        content: "⏳ Privacy Shield is loading. Your message will be sent automatically once ready...",
        isStreaming: true,
      });
      return;
    }

    await doSend(trimmed);
  }, [text, isStreaming, isRecording, stopRecording, token, setPendingAction, setShowSignInModal, doSend, privacyEnabled, modelReady, addMessage]);

  // Resume pending message after sign-in
  useEffect(() => {
    if (token && pendingAction?.type === "message" && typeof pendingAction.data === "string") {
      const msg = pendingAction.data;
      setPendingAction(null);
      doSend(msg);
    }
  }, [token, pendingAction, setPendingAction, doSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBuyCredits = useCallback(() => {
    setCreditModalReason("exhausted");
    setShowCreditModal(true);
  }, [setCreditModalReason, setShowCreditModal]);

  return (
    <div className="relative" style={{ background: "#0a0a0b", borderTop: "1px solid rgba(255,255,255,0.04)", padding: "12px" }}>
      <AttachmentMenu />
      <div className="max-w-3xl mx-auto">
        {/* Anonymization diff */}
        {lastDiff && (
          <div className="mb-2">
            <AnonymizationDiff
              originalText={lastDiff.original}
              anonymizedText={lastDiff.anonymized}
              mapping={lastDiff.mapping}
              collapsed={diffCollapsed}
            />
            {lastDiff.context && lastDiff.context !== "general" && (
              <div style={{
                marginTop: "4px",
                fontSize: "11px",
                color: "rgba(255, 107, 53, 0.5)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                <span>
                  {lastDiff.context === "legal" ? "⚖️" : lastDiff.context === "medical" ? "🏥" : "💰"}
                </span>
                <span>
                  {lastDiff.context === "legal"
                    ? "Legal context: jurisdictions & courts preserved"
                    : lastDiff.context === "medical"
                    ? "Medical context: conditions & facilities preserved"
                    : "Financial context: companies & markets preserved"}
                </span>
              </div>
            )}
          </div>
        )}
        {/* Credits exhausted banner */}
        {creditsExhausted ? (
          <div className="mb-3 rounded-lg px-4 py-3" style={{ border: "1px solid rgba(255, 107, 53, 0.3)", background: "rgba(255, 107, 53, 0.05)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 shrink-0" style={{ color: "#ff6b35" }} />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  You&apos;ve run out of credits. Purchase more to continue chatting.
                </p>
              </div>
              <Button
                onClick={handleBuyCredits}
                size="sm"
                style={{ background: "#ff6b35", color: "#0a0a0b" }}
                className="shrink-0 hover:opacity-90"
              >
                Buy Credits
              </Button>
            </div>
          </div>
        ) : (
          hasDocument && (
            <div className="text-xs mb-2 text-center" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace" }}>
              Credit balance: {creditBalance}
            </div>
          )
        )}

        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onClick={() => setShowAttachmentMenu(true)}
            disabled={isStreaming}
          >
            <Plus className="h-5 w-5" />
          </Button>

          {/* Textarea */}
          <div className="flex-1 relative">
            <div className="flex items-center gap-2 mb-2" style={{ paddingLeft: "4px" }}>
            <PrivacyShield enabled={privacyEnabled} onToggle={setPrivacyEnabled} />
            <span style={{ fontSize: "11px", color: privacyEnabled ? "rgba(255, 107, 53, 0.6)" : "rgba(255,255,255,0.2)" }}>
              {privacyEnabled ? (modelReady ? "Privacy Shield active" : "Privacy Shield (loading model…)") : "Privacy Shield off"}
            </span>
            <BurnButton />
          </div>
          <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={creditsExhausted ? "Purchase credits to continue..." : "Say anything. It\u0027s anonymous."}
              disabled={isStreaming || creditsExhausted}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl px-4 py-2.5",
                "text-sm",
                "focus:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              style={{
                maxHeight: `${24 * 5}px`,
                background: isRecording ? "rgba(255, 107, 53, 0.04)" : "rgba(255,255,255,0.025)",
                border: isRecording ? "1px solid rgba(255, 107, 53, 0.2)" : "1px solid rgba(255,255,255,0.06)",
                color: "#fff",
                fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.25s ease",
              }}
            />
          </div>

          {/* Mic button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "shrink-0 h-10 w-10 rounded-full transition-all",
                  )}
                  style={{
                    color: isRecording ? "#ff6b35" : "rgba(255,255,255,0.25)",
                    background: isRecording ? "rgba(255, 107, 53, 0.1)" : "transparent",
                    border: isRecording ? "1px solid rgba(255, 107, 53, 0.2)" : "1px solid transparent",
                  }}
                  onClick={handleMicClick}
                >
                  {isRecording ? (
                    <AudioBars analyser={analyserNode} />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? "Tap to stop" : "Voice input"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Send button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full transition-all"
            style={{
              background: hasText && !isStreaming ? "linear-gradient(135deg, #ff6b35, #ff3c1e)" : "rgba(255,255,255,0.04)",
              color: hasText && !isStreaming ? "#0a0a0b" : "rgba(255,255,255,0.15)",
            }}
            onClick={handleSend}
            disabled={!hasText || isStreaming || creditsExhausted}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>

        {/* Footer */}
        <div className="flex justify-center items-center gap-4 mt-3">
          {["zero persistence", "all PII stripped", "nothing stored"].map((t, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(255, 107, 53, 0.3)" }} />
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* No speech support toast */}
      {noSpeechSupport && (
        <div style={{
          position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
          background: "#111113", color: "rgba(255,255,255,0.7)", padding: "10px 20px",
          borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)",
          fontSize: "13px", zIndex: 999, fontFamily: "'DM Sans', sans-serif",
        }}>
          Voice input is not supported in this browser. Try Chrome.
        </div>
      )}
    </div>
  );
}
