"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "@/store/ui-store";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { FileText, Link, Folder, FileEdit, X } from "lucide-react";
import { Button } from "@/components/ui/button";
//import { parsePDF, type ProgressCallback } from "@/lib/parsers/pdf-parser";
//import { parseDOCX } from "@/lib/parsers/docx-parser";
import { parseImage } from "@/lib/parsers/ocr-parser";

type InlineMode = null | "url" | "gdrive" | "text";

function getErrorMessage(error: unknown): string {
  // Log full error details for debugging
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

  // Close on outside click
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

  // Parse a single file based on its type
  const parseFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/parse-file', {
      method: 'POST',
      body: formData,
    });
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
        // Single file path
        const file = fileArray[0];
        const filename = file.name;

        // Add document with parsing status
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

        // Add system message for document card
        addMessage({
          id: `doc-${Date.now()}`,
          role: "system",
          content: `[document:${filename}]`,
        });

        let text: string;
        try {
          text = await parseFile(file);
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

        // Always anonymize via chunked API (handles large files without timeout)
        setSessionMode("quick");
        const result = await apiClient.anonymizeChunked(text, token, (pct, detail) => {
          updateDocumentStatus(filename, "anonymizing", {
            progress: 50 + Math.round(pct * 0.5), // anonymizing = 50-100%
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
        // Multiple files -> Session Mode
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

          const text = await parseFile(file);
          updateDocumentStatus(filename, "anonymizing", {
            text,
            progress: 50,
            progressDetail: `File ${idx + 1} of ${totalFiles}`,
          });
          parsedDocs.push({ filename, text });
        }

        // Anonymize each document via chunked API
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
      // Reset file input
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

      // Ingest the URL
      const ingestResult = await apiClient.ingestUrl(url, token);
      const text = ingestResult.text ?? "";

      updateDocumentStatus(filename, "anonymizing", {
        text,
        progress: 50,
        progressDetail: "Anonymizing...",
      });

      // Anonymize the result
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

      // Ingest the GDrive folder
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

      // Process through documents pipeline
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

      // Anonymize directly (chunked for large texts)
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

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute bottom-16 left-3 z-50",
        "bg-gray-800 rounded-lg border border-gray-700 shadow-xl p-2",
        "min-w-[240px]"
      )}
    >
      {/* Hidden file input */}
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
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-gray-200 hover:bg-gray-700 transition-colors text-left"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <FileText className="h-4 w-4 text-gray-400" />
            Upload file(s)
          </button>

          <button
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-gray-200 hover:bg-gray-700 transition-colors text-left"
            onClick={() => setInlineMode("url")}
            disabled={isProcessing}
          >
            <Link className="h-4 w-4 text-gray-400" />
            Paste URL
          </button>

          <button
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-gray-200 hover:bg-gray-700 transition-colors text-left"
            onClick={() => setInlineMode("gdrive")}
            disabled={isProcessing}
          >
            <Folder className="h-4 w-4 text-gray-400" />
            Google Drive folder
          </button>

          <button
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-gray-200 hover:bg-gray-700 transition-colors text-left"
            onClick={() => setInlineMode("text")}
            disabled={isProcessing}
          >
            <FileEdit className="h-4 w-4 text-gray-400" />
            Paste text
          </button>
        </div>
      )}

      {/* Inline URL input */}
      {inlineMode === "url" && (
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Paste URL</span>
            <button
              onClick={() => {
                setInlineMode(null);
                setInlineValue("");
              }}
              className="text-gray-500 hover:text-gray-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="url"
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUrlSubmit();
            }}
          />
          <Button
            size="sm"
            onClick={handleUrlSubmit}
            disabled={!inlineValue.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? "Processing..." : "Ingest URL"}
          </Button>
        </div>
      )}

      {/* Inline GDrive input */}
      {inlineMode === "gdrive" && (
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">
              Google Drive folder URL
            </span>
            <button
              onClick={() => {
                setInlineMode(null);
                setInlineValue("");
              }}
              className="text-gray-500 hover:text-gray-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="url"
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGDriveSubmit();
            }}
          />
          <Button
            size="sm"
            onClick={handleGDriveSubmit}
            disabled={!inlineValue.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? "Processing..." : "Connect Folder"}
          </Button>
        </div>
      )}

      {/* Inline text paste */}
      {inlineMode === "text" && (
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Paste text</span>
            <button
              onClick={() => {
                setInlineMode(null);
                setInlineValue("");
              }}
              className="text-gray-500 hover:text-gray-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            placeholder="Paste your text here..."
            rows={4}
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 resize-none"
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleTextPaste}
            disabled={!inlineValue.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? "Processing..." : "Anonymize & Load"}
          </Button>
        </div>
      )}
    </div>
  );
}
