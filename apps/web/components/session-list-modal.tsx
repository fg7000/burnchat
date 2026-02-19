"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Trash2, Loader2, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { decryptMapping } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  return (
    <Dialog open={showSessionList} onOpenChange={setShowSessionList}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-gray-300" />
            Your Sessions
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[200px]">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-gray-400">{error}</p>
              <Button variant="secondary" size="sm" onClick={fetchSessions}>
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && sessions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FolderOpen className="h-10 w-10 text-gray-600" />
              <p className="text-sm text-gray-400">No saved sessions yet</p>
              <p className="text-xs text-gray-500">
                Sessions are saved when you work in Session Mode
              </p>
            </div>
          )}

          {/* Session list */}
          {!isLoading && !error && sessions.length > 0 && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group rounded-lg border border-gray-700 bg-gray-800/30 p-3 transition-colors hover:border-gray-600 hover:bg-gray-800/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Session info */}
                      <button
                        onClick={() => handleResume(session)}
                        disabled={resumingId === session.id}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="truncate text-sm font-medium text-gray-200 group-hover:text-gray-300 transition-colors">
                          {session.name}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {session.document_count}{" "}
                            {session.document_count === 1 ? "doc" : "docs"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.created_at)}
                          </span>
                        </div>
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {resumingId === session.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
                        )}

                        {confirmDeleteId === session.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(session.id)}
                              disabled={deletingId === session.id}
                              className="h-7 px-2 text-xs"
                            >
                              {deletingId === session.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7 px-2 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(session.id)}
                            className="rounded p-1.5 text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-gray-400 group-hover:opacity-100"
                            title="Delete session"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      </DialogContent>
    </Dialog>
  );
}
