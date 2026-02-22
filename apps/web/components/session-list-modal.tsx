"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Trash2, Loader2, FileText, Calendar, X } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { decryptMapping } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SessionItem {
  id: string;
  name: string;
  document_count: number;
  created_at: string;
}

export default function SessionListModal() {
  const { token, setSessionId, setSessionName, setCurrentMapping, setSessionMode } =
    useSessionStore();
  const { showSessionList, setShowSessionList, setShowSessionSidebar } = useUIStore();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);

  // Fetch sessions when modal opens
  useEffect(() => {
    if (showSessionList && token) {
      const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await apiClient.listSessions(token);
          setSessions(data.sessions || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load sessions.");
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }
  }, [showSessionList, token]);

  const fetchSessions = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.listSessions(token);
      setSessions(data.sessions || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sessions."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async (session: SessionItem) => {
    if (!token) return;
    setResumingId(session.id);
    try {
      const data = await apiClient.getSession(session.id, token);
      const mapping = data.mapping_encrypted
        ? decryptMapping(data.mapping_encrypted, token)
        : [];
      setSessionId(session.id);
      setSessionName(session.name);
      setCurrentMapping(mapping);
      setSessionMode("session");
      setShowSessionSidebar(true);
      setShowSessionList(false);
    } catch (err) {
      console.error("Failed to resume session:", err);
    } finally {
      setResumingId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!token) return;
    setDeletingId(sessionId);
    try {
      await apiClient.deleteSession(sessionId, token);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (!showSessionList) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowSessionList(false);
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2">
            <FolderOpen style={{ width: 20, height: 20, color: "var(--text-muted)" }} />
            <span
              className="font-primary"
              style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}
            >
              Your Sessions
            </span>
          </div>
          <button
            onClick={() => setShowSessionList(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 4,
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ minHeight: 200, flex: 1, overflow: "hidden" }}>
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center" style={{ padding: "48px 0" }}>
              <Loader2
                className="animate-spin"
                style={{ width: 24, height: 24, color: "var(--text-muted)" }}
              />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div
              className="flex flex-col items-center gap-3"
              style={{ padding: "48px 0" }}
            >
              <p className="font-primary" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {error}
              </p>
              <button
                onClick={fetchSessions}
                className="font-primary"
                style={{
                  padding: "6px 16px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && sessions.length === 0 && (
            <div
              className="flex flex-col items-center gap-2 text-center"
              style={{ padding: "48px 0" }}
            >
              <FolderOpen style={{ width: 40, height: 40, color: "var(--text-muted)" }} />
              <p className="font-primary" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                No saved sessions yet
              </p>
              <p className="font-primary" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Sessions are saved when you work in Session Mode
              </p>
            </div>
          )}

          {/* Session list */}
          {!isLoading && !error && sessions.length > 0 && (
            <ScrollArea style={{ maxHeight: 400 }}>
              <div style={{ padding: "8px 12px" }} className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="group"
                    style={{
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      padding: 12,
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--text-muted)";
                      (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLElement).style.background = "var(--bg)";
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Session info */}
                      <button
                        onClick={() => handleResume(session)}
                        disabled={resumingId === session.id}
                        className="flex-1 text-left min-w-0"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <p
                          className="truncate font-primary"
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            transition: "color 0.15s",
                          }}
                        >
                          {session.name}
                        </p>
                        <div
                          className="flex items-center gap-3 font-mono"
                          style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}
                        >
                          <span className="flex items-center gap-1">
                            <FileText style={{ width: 12, height: 12 }} />
                            {session.document_count}{" "}
                            {session.document_count === 1 ? "doc" : "docs"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar style={{ width: 12, height: 12 }} />
                            {formatDate(session.created_at)}
                          </span>
                        </div>
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {resumingId === session.id && (
                          <Loader2
                            className="animate-spin"
                            style={{ width: 16, height: 16, color: "var(--text-muted)" }}
                          />
                        )}

                        {confirmDeleteId === session.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(session.id)}
                              disabled={deletingId === session.id}
                              className="font-primary"
                              style={{
                                padding: "4px 8px",
                                borderRadius: "var(--radius-sm)",
                                background: "#dc2626",
                                border: "none",
                                color: "#fff",
                                fontSize: 11,
                                cursor: "pointer",
                                height: 28,
                              }}
                            >
                              {deletingId === session.id ? (
                                <Loader2
                                  className="animate-spin"
                                  style={{ width: 12, height: 12 }}
                                />
                              ) : (
                                "Delete"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="font-primary"
                              style={{
                                padding: "4px 8px",
                                borderRadius: "var(--radius-sm)",
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                fontSize: 11,
                                cursor: "pointer",
                                height: 28,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(session.id)}
                            style={{
                              borderRadius: "var(--radius-sm)",
                              padding: 6,
                              color: "var(--text-muted)",
                              opacity: 0,
                              transition: "opacity 0.15s, background 0.15s",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                            }}
                            className="group-hover:!opacity-100"
                            title="Delete session"
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)";
                              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                            }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
