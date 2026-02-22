"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "@/store/ui-store";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";
import { FileText, Link, Folder, FileEdit, X } from "lucide-react";
import { parseImage } from "@/lib/parsers/ocr-parser";

type InlineMode = null | "url" | "gdrive" | "text";

function getErrorMessage(error: unknown): string {
  console.error("[attachment-menu] Error details:", {
    type: error?.constructor?.name,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Could not connect to the server. Make sure the backend is running.";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out. The document may be too large — try a smaller file.";
  }
  if (error instanceof Error) {
    if (error.message.includes("402")) {
      return "Insufficient credits. Please purchase more credits to continue.";
    }
    if (error.message.includes("401")) {
      return "Authentication required. Please sign in first.";
    }
    return error.message;
  }
  return "An unexpected error occurred.";
}

export default function AttachmentMenu() {
  const showAttachmentMenu = useUIStore((s) => s.showAttachmentMenu);
  const setShowAttachmentMenu = useUIStore((s) => s.setShowAttachmentMenu);

  const token = useSessionStore((s) => s.token);
  const sessionId = useSessionStore((s) => s.sessionId);
  const addDocument = useSessionStore((s) => s.addDocument);
  const updateDocumentStatus = useSessionStore((s) => s.updateDocumentStatus);
  const setCurrentMapping = useSessionStore((s) => s.setCurrentMapping);
  const setSessionMode = useSessionStore((s) => s.setSessionMode);
  const setSessionId = useSessionStore((s) => s.setSessionId);
  const addMessage = useSessionStore((s) => s.addMessage);

  const [inlineMode, setInlineMode] = useState<InlineMode>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAttachmentMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAttachmentMenu(false);
        setInlineMode(null);
        setInlineValue("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAttachmentMenu, setShowAttachmentMenu]);

  const closeMenu = useCallback(() => {
    setShowAttachmentMenu(false);
    setInlineMode(null);
    setInlineValue("");
  }, [setShowAttachmentMenu]);

  const parseFile = async (
    file: File,
    onProgress?: (pct: number, detail?: string) => void
  ): Promise<string> => {
    const name = file.name.toLowerCase();
    if (
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg")
    ) {
      return parseImage(file);
    } else if (
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      name.endsWith(".txt")
    ) {
      const result = await apiClient.parseFile(file, token);
      return result.text;
    } else {
      return file.text();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    closeMenu();

    const fileArray = Array.from(files);
    const filenames = fileArray.map((f) => f.name);

    try {
      if (fileArray.length === 1) {
        const file = fileArray[0];
        const filename = file.name;

        addDocument({
          filename,
          text: "",
          anonymizedText: "",
          mapping: [],
          entitiesFound: [],
          tokenCount: 0,
          status: "parsing",
          progress: 0,
          progressDetail: "Starting...",
        });

        addMessage({
          id: `doc-${Date.now()}`,
          role: "system",
          content: `[document:${filename}]`,
        });

        let text: string;
        try {
          text = await parseFile(file, (pct, detail) => {
            updateDocumentStatus(filename, "parsing", {
              progress: Math.round(pct * 0.5),
              progressDetail: detail,
            });
          });
        } catch (parseError) {
          console.error("PDF parse error:", parseError);
          throw new Error(
            `Failed to parse ${filename}: ${parseError instanceof Error ? parseError.message : "Unknown parsing error"}`
          );
        }

        updateDocumentStatus(filename, "anonymizing", {
          text,
          progress: 50,
          progressDetail: "Anonymizing...",
        });

        setSessionMode("quick");
        const result = await apiClient.anonymizeChunked(text, token, (pct, detail) => {
          updateDocumentStatus(filename, "anonymizing", {
            progress: 50 + Math.round(pct * 0.5),
            progressDetail: detail,
          });
        });

        updateDocumentStatus(filename, "ready", {
          anonymizedText: result.anonymized_text,
          mapping: result.mapping,
          entitiesFound: result.entities_found ?? [],
          tokenCount: result.token_count ?? 0,
          progress: 100,
        });
        setCurrentMapping(result.mapping);
      } else {
        setSessionMode("session");

        const parsedDocs: { filename: string; text: string }[] = [];
        const totalFiles = fileArray.length;

        for (let idx = 0; idx < fileArray.length; idx++) {
          const file = fileArray[idx];
          const filename = file.name;

          addDocument({
            filename,
            text: "",
            anonymizedText: "",
            mapping: [],
            entitiesFound: [],
            tokenCount: 0,
            status: "parsing",
            progress: 0,
            progressDetail: `File ${idx + 1} of ${totalFiles}`,
          });

          addMessage({
            id: `doc-${Date.now()}-${filename}`,
            role: "system",
            content: `[document:${filename}]`,
          });

          const text = await parseFile(file, (pct, detail) => {
            updateDocumentStatus(filename, "parsing", {
              progress: Math.round(pct * 0.5),
              progressDetail: detail
                ? `${detail} (file ${idx + 1}/${totalFiles})`
                : `File ${idx + 1} of ${totalFiles}`,
            });
          });
          updateDocumentStatus(filename, "anonymizing", {
            text,
            progress: 50,
            progressDetail: `File ${idx + 1} of ${totalFiles}`,
          });
          parsedDocs.push({ filename, text });
        }

        setSessionMode("quick");
        let combinedMapping: { original: string; replacement: string; entity_type: string }[] = [];

        for (const doc of parsedDocs) {
          updateDocumentStatus(doc.filename, "anonymizing", {
            progress: 60,
            progressDetail: "Anonymizing...",
          });

          const result = await apiClient.anonymizeChunked(doc.text, token, (pct, detail) => {
            updateDocumentStatus(doc.filename, "anonymizing", {
              progress: 60 + Math.round(pct * 0.4),
              progressDetail: detail,
            });
          });

          updateDocumentStatus(doc.filename, "ready", {
            anonymizedText: result.anonymized_text,
            mapping: result.mapping,
            entitiesFound: result.entities_found ?? [],
            tokenCount: result.token_count ?? 0,
            progress: 100,
          });

          combinedMapping = [...combinedMapping, ...result.mapping];
        }

        if (combinedMapping.length > 0) {
          setCurrentMapping(combinedMapping);
        }
      }
    } catch (error) {
      console.error("File processing error:", error);
      const detail = getErrorMessage(error);
      for (const name of filenames) {
        updateDocumentStatus(name, "error", { errorDetail: detail });
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlSubmit = async () => {
    const url = inlineValue.trim();
    if (!url) return;

    setIsProcessing(true);
    closeMenu();

    const filename = new URL(url).hostname;

    try {
      addDocument({
        filename,
        text: "",
        anonymizedText: "",
        mapping: [],
        entitiesFound: [],
        tokenCount: 0,
        status: "parsing",
        progress: 0,
        progressDetail: "Fetching URL...",
      });

      addMessage({
        id: `doc-${Date.now()}`,
        role: "system",
        content: `[document:${filename}]`,
      });

      const ingestResult = await apiClient.ingestUrl(url, token);
      const text = ingestResult.text ?? "";

      updateDocumentStatus(filename, "anonymizing", {
        text,
        progress: 50,
        progressDetail: "Anonymizing...",
      });

      setSessionMode("quick");
      const anonResult = await apiClient.anonymizeChunked(text, token);

      updateDocumentStatus(filename, "ready", {
        anonymizedText: anonResult.anonymized_text,
        mapping: anonResult.mapping,
        entitiesFound: anonResult.entities_found ?? [],
        tokenCount: anonResult.token_count ?? 0,
        progress: 100,
      });
      setCurrentMapping(anonResult.mapping);
    } catch (error) {
      console.error("URL ingestion error:", error);
      updateDocumentStatus(filename, "error", { errorDetail: getErrorMessage(error) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGDriveSubmit = async () => {
    const folderUrl = inlineValue.trim();
    if (!folderUrl) return;

    setIsProcessing(true);
    closeMenu();

    const gdriveFilename = "Google Drive Folder";

    try {
      addDocument({
        filename: gdriveFilename,
        text: "",
        anonymizedText: "",
        mapping: [],
        entitiesFound: [],
        tokenCount: 0,
        status: "parsing",
        progress: 0,
        progressDetail: "Connecting to Google Drive...",
      });

      addMessage({
        id: `doc-${Date.now()}`,
        role: "system",
        content: `[document:${gdriveFilename}]`,
      });

      updateDocumentStatus(gdriveFilename, "embedding", {
        progress: 20,
        progressDetail: "Downloading files...",
      });
      setSessionMode("session");

      const result = await apiClient.ingestGDriveFolder(folderUrl, token);

      if (result.session_id) {
        setSessionId(result.session_id);
      }

      updateDocumentStatus(gdriveFilename, "embedding", {
        progress: 50,
        progressDetail: "Processing documents...",
      });

      const processResult = await apiClient.processDocuments(
        result.documents ?? [],
        result.session_id ?? sessionId,
        token
      );

      if (processResult.session_id) {
        setSessionId(processResult.session_id);
      }

      updateDocumentStatus(gdriveFilename, "ready", {
        tokenCount: processResult.token_count ?? 0,
        chunkCount: processResult.chunk_count ?? 0,
        progress: 100,
      });

      if (processResult.mapping) {
        setCurrentMapping(processResult.mapping);
      }
    } catch (error) {
      console.error("GDrive ingestion error:", error);
      updateDocumentStatus(gdriveFilename, "error", { errorDetail: getErrorMessage(error) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextPaste = async () => {
    const pastedText = inlineValue.trim();
    if (!pastedText) return;

    setIsProcessing(true);
    closeMenu();

    const pasteFilename = "Pasted Text";

    try {
      addDocument({
        filename: pasteFilename,
        text: pastedText,
        anonymizedText: "",
        mapping: [],
        entitiesFound: [],
        tokenCount: 0,
        status: "anonymizing",
      });

      addMessage({
        id: `doc-${Date.now()}`,
        role: "system",
        content: `[document:${pasteFilename}]`,
      });

      setSessionMode("quick");
      const result = await apiClient.anonymizeChunked(pastedText, token);

      updateDocumentStatus(pasteFilename, "ready", {
        anonymizedText: result.anonymized_text,
        mapping: result.mapping,
        entitiesFound: result.entities_found ?? [],
        tokenCount: result.token_count ?? 0,
      });
      setCurrentMapping(result.mapping);
    } catch (error) {
      console.error("Text paste error:", error);
      updateDocumentStatus(pasteFilename, "error", { errorDetail: getErrorMessage(error) });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!showAttachmentMenu) return null;

  const menuItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    fontFamily: "var(--font-primary)",
    color: "var(--text-secondary)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left" as const,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "var(--font-primary)",
    color: "var(--text-primary)",
    outline: "none",
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        bottom: 64,
        left: 12,
        zIndex: 50,
        background: "#111113",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        padding: 6,
        minWidth: 240,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {inlineMode === null && (
        <div className="flex flex-col gap-0.5">
          <button
            style={menuItemStyle}
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <FileText style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
            Upload file(s)
          </button>

          <button
            style={menuItemStyle}
            onClick={() => setInlineMode("url")}
            disabled={isProcessing}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Link style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
            Paste URL
          </button>

          <button
            style={menuItemStyle}
            onClick={() => setInlineMode("gdrive")}
            disabled={isProcessing}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Folder style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
            Google Drive folder
          </button>

          <button
            style={menuItemStyle}
            onClick={() => setInlineMode("text")}
            disabled={isProcessing}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <FileEdit style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
            Paste text
          </button>
        </div>
      )}

      {inlineMode === "url" && (
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center justify-between">
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Paste URL</span>
            <button
              onClick={() => { setInlineMode(null); setInlineValue(""); }}
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <input
            type="url"
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="https://example.com/article"
            style={inputStyle}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); }}
          />
          <button
            onClick={handleUrlSubmit}
            disabled={!inlineValue.trim() || isProcessing}
            className="w-full accent-gradient-bg font-primary"
            style={{
              padding: "8px 0",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 500,
              color: "#0a0a0b",
              border: "none",
              cursor: "pointer",
              opacity: !inlineValue.trim() || isProcessing ? 0.5 : 1,
            }}
          >
            {isProcessing ? "Processing..." : "Ingest URL"}
          </button>
        </div>
      )}

      {inlineMode === "gdrive" && (
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center justify-between">
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Google Drive folder URL</span>
            <button
              onClick={() => { setInlineMode(null); setInlineValue(""); }}
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <input
            type="url"
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            style={inputStyle}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleGDriveSubmit(); }}
          />
          <button
            onClick={handleGDriveSubmit}
            disabled={!inlineValue.trim() || isProcessing}
            className="w-full accent-gradient-bg font-primary"
            style={{
              padding: "8px 0",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 500,
              color: "#0a0a0b",
              border: "none",
              cursor: "pointer",
              opacity: !inlineValue.trim() || isProcessing ? 0.5 : 1,
            }}
          >
            {isProcessing ? "Processing..." : "Connect Folder"}
          </button>
        </div>
      )}

      {inlineMode === "text" && (
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center justify-between">
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Paste text</span>
            <button
              onClick={() => { setInlineMode(null); setInlineValue(""); }}
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <textarea
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="Paste your text here..."
            rows={4}
            style={{ ...inputStyle, resize: "none" as const }}
            autoFocus
          />
          <button
            onClick={handleTextPaste}
            disabled={!inlineValue.trim() || isProcessing}
            className="w-full accent-gradient-bg font-primary"
            style={{
              padding: "8px 0",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 500,
              color: "#0a0a0b",
              border: "none",
              cursor: "pointer",
              opacity: !inlineValue.trim() || isProcessing ? 0.5 : 1,
            }}
          >
            {isProcessing ? "Processing..." : "Anonymize & Load"}
          </button>
        </div>
      )}
    </div>
  );
}
