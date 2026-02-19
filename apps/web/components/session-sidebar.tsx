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

  // Sync editName with sessionName
  useEffect(() => {
    setEditName(sessionName);
  }, [sessionName]);

  // Focus the input when editing
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
    // Mobile hamburger toggle when sidebar is hidden but session mode is active
    if (sessionMode === "session") {
      return (
        <button
          onClick={() => {
            setShowSessionSidebar(true);
            setMobileOpen(true);
          }}
          className="fixed left-4 top-16 z-40 rounded-md bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      );
    }
    return null;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          {/* Editable session name */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 outline-none focus:border-gray-400"
                maxLength={100}
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="block w-full truncate text-left text-sm font-medium text-gray-200 hover:text-white transition-colors"
                title="Click to edit session name"
              >
                {sessionName}
              </button>
            )}
          </div>

          {/* Mobile close */}
          <button
            onClick={() => {
              setMobileOpen(false);
              setShowSessionSidebar(false);
            }}
            className="ml-2 rounded p-1 text-gray-400 hover:text-gray-200 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !sessionId || !token}
            className="flex-1 gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSessionList(true)}
            className="flex-1 gap-1.5"
          >
            <List className="h-3.5 w-3.5" />
            Sessions
          </Button>
        </div>
      </div>

      {/* Document list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Layers className="h-8 w-8 text-gray-600" />
              <p className="text-xs text-gray-500">
                No documents loaded yet
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.filename}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-gray-800/60 transition-colors"
              >
                <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-gray-300" title={doc.filename}>
                    {doc.filename}
                  </p>
                </div>
                <div className="shrink-0">
                  {doc.status === "ready" && (
                    <div className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 text-white" />
                      <span className="text-[11px] text-gray-500">
                        {doc.chunkCount || 0} chunks
                      </span>
                    </div>
                  )}
                  {(doc.status === "parsing" ||
                    doc.status === "anonymizing" ||
                    doc.status === "embedding") && (
                    <div className="flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />
                      <span className="text-[11px] text-gray-500 capitalize">
                        {doc.status}
                      </span>
                    </div>
                  )}
                  {doc.status === "error" && (
                    <XCircle className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {documents.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
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
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-gray-800 bg-gray-900 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => {
              setMobileOpen(false);
              setShowSessionSidebar(false);
            }}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-gray-800 bg-gray-900 lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
