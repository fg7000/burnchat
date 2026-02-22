"use client";

import { useState, useRef, useEffect } from "react";
import {
  FileText,
  Check,
  Loader2,
  XCircle,
  Save,
  List,
  Menu,
  X,
  Layers,
} from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { encryptMapping } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SessionSidebar() {
  const {
    documents,
    currentMapping,
    sessionId,
    sessionName,
    sessionMode,
    token,
    setSessionName,
  } = useSessionStore();
  const { showSessionSidebar, setShowSessionSidebar, setShowSessionList } =
    useUIStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(sessionName);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditName(sessionName);
  }, [sessionName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const isVisible = showSessionSidebar && sessionMode === "session";

  const handleNameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== sessionName) {
      setSessionName(trimmed);
    } else {
      setEditName(sessionName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit();
    } else if (e.key === "Escape") {
      setEditName(sessionName);
      setIsEditingName(false);
    }
  };

  const handleSave = async () => {
    if (!token || !sessionId) return;
    setIsSaving(true);
    try {
      const encrypted = encryptMapping(currentMapping, token);
      await apiClient.saveSessionMapping(sessionId, encrypted, token);
    } catch (err) {
      console.error("Failed to save session:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalChunks = documents.reduce(
    (sum, d) => sum + (d.chunkCount || 0),
    0
  );
  const totalEntities = documents.reduce(
    (sum, d) => sum + d.entitiesFound.reduce((s, e) => s + e.count, 0),
    0
  );

  if (!isVisible) {
    if (sessionMode === "session") {
      return (
        <button
          onClick={() => {
            setShowSessionSidebar(true);
            setMobileOpen(true);
          }}
          className="fixed left-4 top-16 z-40 lg:hidden"
          style={{
            padding: 8,
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <Menu style={{ width: 20, height: 20 }} />
        </button>
      );
    }
    return null;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: 16 }}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                className="w-full font-primary"
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  outline: "none",
                }}
                maxLength={100}
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="block w-full truncate text-left font-primary"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
                title="Click to edit session name"
              >
                {sessionName}
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setMobileOpen(false);
              setShowSessionSidebar(false);
            }}
            className="ml-2 lg:hidden"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !sessionId || !token}
            className="flex-1 gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
            ) : (
              <Save style={{ width: 14, height: 14 }} />
            )}
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSessionList(true)}
            className="flex-1 gap-1.5"
          >
            <List style={{ width: 14, height: 14 }} />
            Sessions
          </Button>
        </div>
      </div>

      {/* Document list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Layers style={{ width: 32, height: 32, color: "var(--text-muted)" }} />
              <p className="font-primary" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                No documents loaded yet
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.filename}
                className="flex items-center gap-2.5"
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                }}
              >
                <FileText style={{ width: 16, height: 16, flexShrink: 0, color: "var(--text-muted)" }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-primary" style={{ color: "var(--text-secondary)" }} title={doc.filename}>
                    {doc.filename}
                  </p>
                </div>
                <div className="shrink-0">
                  {doc.status === "ready" && (
                    <div className="flex items-center gap-1">
                      <Check style={{ width: 14, height: 14, color: "var(--accent)" }} />
                      <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {doc.chunkCount || 0} chunks
                      </span>
                    </div>
                  )}
                  {(doc.status === "parsing" ||
                    doc.status === "anonymizing" ||
                    doc.status === "embedding") && (
                    <div className="flex items-center gap-1">
                      <Loader2 className="animate-spin" style={{ width: 14, height: 14, color: "var(--text-secondary)" }} />
                      <span className="font-mono capitalize" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {doc.status}
                      </span>
                    </div>
                  )}
                  {doc.status === "error" && (
                    <XCircle style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {documents.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <div className="flex items-center justify-between font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            <span>{totalChunks} total chunks</span>
            <span>{totalEntities} entities found</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-64 shrink-0 h-full"
        style={{
          borderRight: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => {
              setMobileOpen(false);
              setShowSessionSidebar(false);
            }}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            style={{
              borderRight: "1px solid var(--border)",
              background: "var(--bg)",
            }}
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
