"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "@/store/ui-store";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";
import { anonymizeDocument } from "@/lib/anonymizer/anonymizer";
import { FileText, Link, Folder, FileEdit, X, Loader2 } from "lucide-react";
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
    return "Request timed out. The document may be too large.";
  }
  if (error instanceof Error) {
    if (error.message.includes("402")) return "Insufficient credits.";
    if (error.message.includes("401")) return "Authentication required. Please sign in.";
    return error.message;
  }
  return "An unexpected error occurred.";
}

/**
 * Detect Google Docs/Sheets/Slides URLs and convert to export format.
 * Google app URLs return JS shell, not document content.
 * Export URLs return the actual text/CSV.
 */
function convertGoogleDocsUrl(url: string): { exportUrl: string; displayName: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("docs.google.com")) return null;

    // Google Docs: /document/d/{ID}/...
    const docMatch = u.pathname.match(/\/document\/d\/([^/]+)/);
    if (docMatch) {
      return {
        exportUrl: `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`,
        displayName: "Google Doc",
      };
    }

    // Google Sheets: /spreadsheets/d/{ID}/...
    const sheetMatch = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (sheetMatch) {
      return {
        exportUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`,
        displayName: "Google Sheet",
      };
    }

    // Google Slides: /presentation/d/{ID}/...
    const slideMatch = u.pathname.match(/\/presentation\/d\/([^/]+)/);
    if (slideMatch) {
      return {
        exportUrl: `https://docs.google.com/presentation/d/${slideMatch[1]}/export?format=txt`,
        displayName: "Google Slides",
      };
    }
  } catch {}
  return null;
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

  const parseFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/parse-file", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    return data.text;
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
          filename, text: "", anonymizedText: "", mapping: [],
          entitiesFound: [], tokenCount: 0, status: "parsing",
          progress: 0, progressDetail: "Starting...",
        });
        addMessage({ id: `doc-${Date.now()}`, role: "system", content: `[document:${filename}]` });

        let text: string;
        try { text = await parseFile(file); }
        catch (parseError) {
          throw new Error(`Failed to parse ${filename}: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
        }

        if (!text || text.trim().length === 0) {
          throw new Error(`No text could be extracted from ${filename}.`);
        }

        updateDocumentStatus(filename, "anonymizing", { text, progress: 50, progressDetail: "Anonymizing..." });

        setSessionMode("quick");
        const result = await anonymizeDocument(text, (pct, detail) => {
          updateDocumentStatus(filename, "anonymizing", { progress: 50 + Math.round(pct * 0.5), progressDetail: detail });
        });

        updateDocumentStatus(filename, "ready", {
          anonymizedText: result.anonymized_text, mapping: result.mapping,
          entitiesFound: result.entities_found ?? [], tokenCount: 0, progress: 100,
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
            filename, text: "", anonymizedText: "", mapping: [],
            entitiesFound: [], tokenCount: 0, status: "parsing",
            progress: 0, progressDetail: `File ${idx + 1} of ${totalFiles}`,
          });
          addMessage({ id: `doc-${Date.now()}-${filename}`, role: "system", content: `[document:${filename}]` });

          const text = await parseFile(file);
          updateDocumentStatus(filename, "anonymizing", { text, progress: 50, progressDetail: `File ${idx + 1} of ${totalFiles}` });
          parsedDocs.push({ filename, text });
        }

        setSessionMode("quick");
        let combinedMapping: { original: string; replacement: string; entity_type: string }[] = [];

        for (const doc of parsedDocs) {
          updateDocumentStatus(doc.filename, "anonymizing", { progress: 60, progressDetail: "Anonymizing..." });
          const result = await anonymizeDocument(doc.text, (pct, detail) => {
            updateDocumentStatus(doc.filename, "anonymizing", { progress: 60 + Math.round(pct * 0.4), progressDetail: detail });
          });
          updateDocumentStatus(doc.filename, "ready", {
            anonymizedText: result.anonymized_text, mapping: result.mapping,
            entitiesFound: result.entities_found ?? [], tokenCount: 0, progress: 100,
          });
          combinedMapping = [...combinedMapping, ...result.mapping];
        }
        if (combinedMapping.length > 0) setCurrentMapping(combinedMapping);
      }
    } catch (error) {
      console.error("File processing error:", error);
      const detail = getErrorMessage(error);
      for (const name of filenames) {
        updateDocumentStatus(name, "error", { errorDetail: detail });
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = async () => {
    const url = inlineValue.trim();
    if (!url) return;

    setIsProcessing(true);
    closeMenu();

    // Detect Google Docs and convert URL
    const googleDoc = convertGoogleDocsUrl(url);
    const fetchUrl = googleDoc ? googleDoc.exportUrl : url;
    const filename = googleDoc ? googleDoc.displayName : new URL(url).hostname;

    try {
      addDocument({
        filename, text: "", anonymizedText: "", mapping: [],
        entitiesFound: [], tokenCount: 0, status: "parsing",
        progress: 0, progressDetail: googleDoc ? "Exporting from Google Docs..." : "Fetching URL...",
      });
      addMessage({ id: `doc-${Date.now()}`, role: "system", content: `[document:${filename}]` });

      const ingestResult = await apiClient.ingestUrl(fetchUrl, token);
      const text = ingestResult.text ?? "";

      if (!text || text.trim().length < 20) {
        throw new Error(
          googleDoc
            ? "Could not extract text. Make sure the document is shared publicly (Anyone with the link)."
            : "No readable content found at this URL."
        );
      }

      updateDocumentStatus(filename, "anonymizing", { text, progress: 50, progressDetail: "Anonymizing..." });

      setSessionMode("quick");
      const anonResult = await anonymizeDocument(text);

      updateDocumentStatus(filename, "ready", {
        anonymizedText: anonResult.anonymized_text, mapping: anonResult.mapping,
        entitiesFound: anonResult.entities_found ?? [], tokenCount: 0, progress: 100,
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
        filename: gdriveFilename, text: "", anonymizedText: "", mapping: [],
        entitiesFound: [], tokenCount: 0, status: "parsing",
        progress: 0, progressDetail: "Connecting to Google Drive...",
      });
      addMessage({ id: `doc-${Date.now()}`, role: "system", content: `[document:${gdriveFilename}]` });

      updateDocumentStatus(gdriveFilename, "embedding", { progress: 20, progressDetail: "Downloading files..." });
      setSessionMode("session");

      const result = await apiClient.ingestGDriveFolder(folderUrl, token);
      if (result.session_id) setSessionId(result.session_id);

      updateDocumentStatus(gdriveFilename, "embedding", { progress: 50, progressDetail: "Processing documents..." });

      const processResult = await apiClient.processDocuments(result.documents ?? [], result.session_id ?? sessionId, token);
      if (processResult.session_id) setSessionId(processResult.session_id);

      updateDocumentStatus(gdriveFilename, "ready", {
        tokenCount: processResult.token_count ?? 0, chunkCount: processResult.chunk_count ?? 0, progress: 100,
      });
      if (processResult.mapping) setCurrentMapping(processResult.mapping);
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
        filename: pasteFilename, text: pastedText, anonymizedText: "", mapping: [],
        entitiesFound: [], tokenCount: 0, status: "anonymizing",
      });
      addMessage({ id: `doc-${Date.now()}`, role: "system", content: `[document:${pasteFilename}]` });

      setSessionMode("quick");
      const result = await anonymizeDocument(pastedText);

      updateDocumentStatus(pasteFilename, "ready", {
        anonymizedText: result.anonymized_text, mapping: result.mapping,
        entitiesFound: result.entities_found ?? [], tokenCount: 0,
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

  const menuItems = [
    { icon: FileText, label: "Upload file", sub: "PDF, DOCX, TXT, images", action: () => fileInputRef.current?.click() },
    { icon: Link, label: "Paste URL", sub: "Web pages, Google Docs", action: () => setInlineMode("url") },
    { icon: Folder, label: "Google Drive folder", sub: "Ingest entire folders", action: () => setInlineMode("gdrive") },
    { icon: FileEdit, label: "Paste text", sub: "Raw text content", action: () => setInlineMode("text") },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "0",
        zIndex: 50,
        minWidth: "280px",
        borderRadius: "14px",
        background: "rgba(20, 20, 22, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
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
        <div style={{ padding: "6px" }}>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              disabled={isProcessing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "transparent",
                border: "none",
                cursor: isProcessing ? "wait" : "pointer",
                textAlign: "left",
                transition: "background 0.15s",
                opacity: isProcessing ? 0.5 : 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(255, 107, 53, 0.06)",
                  border: "1px solid rgba(255, 107, 53, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <item.icon style={{ width: "15px", height: "15px", color: "#ff6b35" }} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans', sans-serif" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "1px" }}>
                  {item.sub}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* URL input */}
      {inlineMode === "url" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif" }}>
              Paste URL
            </span>
            <button
              onClick={() => { setInlineMode(null); setInlineValue(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px" }}
            >
              <X style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginBottom: "8px" }}>
            Works with web pages, articles, and Google Docs (must be shared publicly)
          </div>
          <input
            type="url"
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="https://docs.google.com/document/d/..."
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
              outline: "none",
              marginBottom: "10px",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleUrlSubmit}
            disabled={!inlineValue.trim() || isProcessing}
            style={{
              width: "100%",
              padding: "9px",
              borderRadius: "10px",
              background: inlineValue.trim() && !isProcessing ? "rgba(255, 107, 53, 0.12)" : "rgba(255,255,255,0.03)",
              border: inlineValue.trim() && !isProcessing ? "1px solid rgba(255, 107, 53, 0.2)" : "1px solid rgba(255,255,255,0.06)",
              color: inlineValue.trim() && !isProcessing ? "#ff6b35" : "rgba(255,255,255,0.2)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: inlineValue.trim() && !isProcessing ? "pointer" : "default",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {isProcessing && <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
            {isProcessing ? "Processing..." : "Ingest & Anonymize"}
          </button>
        </div>
      )}

      {/* GDrive input */}
      {inlineMode === "gdrive" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif" }}>
              Google Drive Folder
            </span>
            <button
              onClick={() => { setInlineMode(null); setInlineValue(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px" }}
            >
              <X style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
          <input
            type="url"
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleGDriveSubmit(); }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
              outline: "none",
              marginBottom: "10px",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleGDriveSubmit}
            disabled={!inlineValue.trim() || isProcessing}
            style={{
              width: "100%",
              padding: "9px",
              borderRadius: "10px",
              background: inlineValue.trim() && !isProcessing ? "rgba(255, 107, 53, 0.12)" : "rgba(255,255,255,0.03)",
              border: inlineValue.trim() && !isProcessing ? "1px solid rgba(255, 107, 53, 0.2)" : "1px solid rgba(255,255,255,0.06)",
              color: inlineValue.trim() && !isProcessing ? "#ff6b35" : "rgba(255,255,255,0.2)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: inlineValue.trim() && !isProcessing ? "pointer" : "default",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {isProcessing && <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
            {isProcessing ? "Processing..." : "Connect Folder"}
          </button>
        </div>
      )}

      {/* Text paste */}
      {inlineMode === "text" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif" }}>
              Paste Text
            </span>
            <button
              onClick={() => { setInlineMode(null); setInlineValue(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px" }}
            >
              <X style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
          <textarea
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="Paste your text here..."
            rows={5}
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              fontSize: "13px",
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              resize: "vertical",
              marginBottom: "10px",
              boxSizing: "border-box",
              lineHeight: "1.6",
            }}
          />
          <button
            onClick={handleTextPaste}
            disabled={!inlineValue.trim() || isProcessing}
            style={{
              width: "100%",
              padding: "9px",
              borderRadius: "10px",
              background: inlineValue.trim() && !isProcessing ? "rgba(255, 107, 53, 0.12)" : "rgba(255,255,255,0.03)",
              border: inlineValue.trim() && !isProcessing ? "1px solid rgba(255, 107, 53, 0.2)" : "1px solid rgba(255,255,255,0.06)",
              color: inlineValue.trim() && !isProcessing ? "#ff6b35" : "rgba(255,255,255,0.2)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: inlineValue.trim() && !isProcessing ? "pointer" : "default",
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {isProcessing && <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
            {isProcessing ? "Processing..." : "Anonymize & Load"}
          </button>
        </div>
      )}
    </div>
  );
}
