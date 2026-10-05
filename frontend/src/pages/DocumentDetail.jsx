import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  Calendar,
  Layers,
  HardDrive,
  FileCheck,
  Copy,
  Check,
  AlertCircle,
  FileText,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Blocks,
} from "lucide-react";
import { getDocument, deleteDocument, processDocument } from "../api/documents";
import { formatBytes, formatRelativeTime, getFileTypeBadge } from "../utils/formatters";
import DocumentChat from "../components/DocumentChat";
import ExportButtons from "../components/ExportButtons";

/** Map document_type string → muted badge style */
function getDocTypeBadgeStyle(docType) {
  const t = (docType || "").toLowerCase();
  if (t.includes("report"))
    return "bg-badge-report-bg text-badge-report-text border-badge-report-border";
  if (t.includes("legal") || t.includes("contract"))
    return "bg-badge-legal-bg text-badge-legal-text border-badge-legal-border";
  if (t.includes("technical") || t.includes("manual"))
    return "bg-badge-technical-bg text-badge-technical-text border-badge-technical-border";
  if (t.includes("academic") || t.includes("research"))
    return "bg-badge-academic-bg text-badge-academic-text border-badge-academic-border";
  if (t.includes("correspondence") || t.includes("letter") || t.includes("email"))
    return "bg-badge-correspondence-bg text-badge-correspondence-text border-badge-correspondence-border";
  return "bg-badge-general-bg text-badge-general-text border-badge-general-border";
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // AI processing state
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null); // null | "failed" | "empty"
  const [progressText, setProgressText] = useState("Analyzing document…");
  const isMountedRef = useRef(true);
  const progressTimerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;

    async function loadDoc() {
      setLoading(true);
      setNotFound(false);
      setFetchError("");

      try {
        const data = await getDocument(id);
        if (isMountedRef.current) {
          setDocument(data);
        }
      } catch (err) {
        if (isMountedRef.current) {
          if (err.response?.status === 404) {
            setNotFound(true);
          } else {
            setFetchError("Failed to load document. Please check your connection and try again.");
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    if (id) {
      loadDoc();
    }

    return () => {
      isMountedRef.current = false;
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDocument(id);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document. Please try again.");
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const handleCopyText = () => {
    if (!document?.raw_text) return;
    navigator.clipboard.writeText(document.raw_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProcess = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    setProcessError(null);
    setProgressText("Analyzing document…");

    // Switch text after ~4.5 seconds for the realistic 8-10s wait
    progressTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setProgressText("Almost done…");
      }
    }, 4500);

    try {
      const result = await processDocument(id);
      if (isMountedRef.current) {
        // Fetch fresh document data
        try {
          const freshDoc = await getDocument(id);
          if (isMountedRef.current) {
            // Merge confidence & chunk_count from process result (GET doesn't return these)
            setDocument({
              ...freshDoc,
              confidence: result.confidence,
              chunk_count: result.chunk_count,
            });
          }
        } catch {
          // At least mark as completed so user sees something changed
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        const status = err.response?.status;
        if (status === 422) {
          setProcessError("empty");
        } else {
          setProcessError("failed");
        }
        // Re-fetch to get the real processing_status from DB
        try {
          const freshDoc = await getDocument(id);
          if (isMountedRef.current) {
            setDocument(freshDoc);
          }
        } catch {
          // silently fail
        }
      }
    } finally {
      if (isMountedRef.current) {
        setProcessing(false);
      }
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }
  }, [id, processing]);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-text-main flex flex-col">
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-24 h-8 bg-surface border border-border rounded-lg animate-pulse" />
          </div>
          <div className="bg-surface border border-border rounded-2xl p-8 space-y-6 shadow-xs animate-pulse">
            <div className="h-8 bg-surface-subtle rounded-md w-1/3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-surface-subtle rounded-lg" />
              ))}
            </div>
            <div className="h-96 bg-surface-subtle rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Not Found State (404 covers non-existent or owned by someone else)
  if (notFound) {
    return (
      <div className="min-h-screen bg-canvas text-text-main flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-danger-light border border-danger-border flex items-center justify-center text-danger mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-text-main">
              Document not found
            </h1>
            <p className="text-xs text-text-tertiary">
              This document does not exist, has been deleted, or belongs to another user.
            </p>
          </div>
          <Link
            to="/"
            id="back-to-library-not-found"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  // 3. Other Fetch Error State
  if (fetchError || !document) {
    return (
      <div className="min-h-screen bg-canvas text-text-main flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-danger-border rounded-2xl p-8 text-center shadow-xs space-y-4">
          <AlertCircle className="w-10 h-10 text-danger mx-auto" />
          <h2 className="text-lg font-semibold text-text-main">Failed to load</h2>
          <p className="text-xs text-text-tertiary">{fetchError}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const badge = getFileTypeBadge(document.file_type);
  const fileName = document.original_filename || document.filename;
  const status = document.processing_status || "pending";
  const isCompleted = status === "completed" && !processing;

  return (
    <div className="min-h-screen bg-canvas text-text-main flex flex-col">
      {/* Header bar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            id="back-to-library-btn"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-main px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-subtle transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>

          {/* Delete Action */}
          <div className="flex items-center gap-2">
            {showConfirmDelete ? (
              <div className="flex items-center gap-2 bg-danger-light p-1.5 rounded-xl border border-danger-border animate-in fade-in">
                <span className="text-xs font-medium text-danger px-2">
                  Permanently delete this document?
                </span>
                <button
                  type="button"
                  id="confirm-delete-detail-btn"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="px-3 py-1 text-xs font-semibold bg-danger text-white rounded-lg hover:bg-danger-hover transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </button>
                <button
                  type="button"
                  id="cancel-delete-detail-btn"
                  disabled={deleting}
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-3 py-1 text-xs font-medium bg-surface text-text-secondary border border-border rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="delete-detail-btn"
                onClick={() => setShowConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-danger bg-danger-light/60 hover:bg-danger-light border border-danger-border/70 hover:border-danger-border transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Document
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Document Header & Metadata Card */}
        <section className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Title & Badge */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${badge.bgColor}`}
                >
                  {badge.type === "image" ? (
                    <ImageIcon className={`w-3.5 h-3.5 ${badge.iconColor}`} />
                  ) : badge.type === "txt" ? (
                    <FileCode className={`w-3.5 h-3.5 ${badge.iconColor}`} />
                  ) : (
                    <FileText className={`w-3.5 h-3.5 ${badge.iconColor}`} />
                  )}
                  {badge.label}
                </span>
                <span className="text-xs text-text-subtle font-mono">
                  ID: {document.id}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-text-main break-all">
                {fileName}
              </h1>
            </div>

            {/* Export Controls */}
            <div className="shrink-0 pt-1">
              <ExportButtons documentId={document.id} />
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-border">
            {/* File Size */}
            <div className="p-3.5 bg-surface-subtle/80 border border-border rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <HardDrive className="w-3.5 h-3.5" />
                <span>File Size</span>
              </div>
              <p className="text-sm font-semibold text-text-main">
                {formatBytes(document.file_size_bytes)}
              </p>
            </div>

            {/* Pages */}
            <div className="p-3.5 bg-surface-subtle/80 border border-border rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Layers className="w-3.5 h-3.5" />
                <span>Page Count</span>
              </div>
              <p className="text-sm font-semibold text-text-main">
                {document.page_count != null ? document.page_count : "1"}
              </p>
            </div>

            {/* Word Count */}
            <div className="p-3.5 bg-surface-subtle/80 border border-border rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Word Count</span>
              </div>
              <p className="text-sm font-semibold text-text-main">
                {document.word_count != null ? document.word_count.toLocaleString() : "0"}
              </p>
            </div>

            {/* Created At */}
            <div className="p-3.5 bg-surface-subtle/80 border border-border rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Calendar className="w-3.5 h-3.5" />
                <span>Uploaded</span>
              </div>
              <p
                className="text-sm font-semibold text-text-main truncate"
                title={new Date(document.created_at).toLocaleString()}
              >
                {formatRelativeTime(document.created_at)}
              </p>
            </div>
          </div>
        </section>

        {/* AI Processing Section */}
        {/* Pending — show Process button */}
        {status === "pending" && !processing && processError === null && (
          <section className="bg-surface border border-primary-border/50 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-main">AI Analysis Available</h2>
                  <p className="text-xs text-text-tertiary">
                    Classify, summarize, and index this document with AI
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="process-detail-btn"
                onClick={handleProcess}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                Process this document
              </button>
            </div>
          </section>
        )}

        {/* Processing — calm loading state with changing text */}
        {processing && (
          <section className="bg-surface border border-primary-border/50 rounded-2xl p-6 shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-main">{progressText}</h2>
                  <p className="text-xs text-text-tertiary">
                    Our AI is reading and understanding your document
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full ai-progress-bar" />
              </div>
            </div>
          </section>
        )}

        {/* Failed (502 — Gemini/processing failure) */}
        {!processing && processError === "failed" && (
          <section className="bg-surface border border-danger-border rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger-light border border-danger-border flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-main">AI processing failed</h2>
                  <p className="text-xs text-text-tertiary">
                    Something went wrong during analysis — you can try again
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="retry-detail-btn"
                onClick={handleProcess}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-danger border border-danger-border bg-danger-light hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </section>
        )}

        {/* DB-level failed status (e.g. on page load after a past failure) */}
        {!processing && processError === null && status === "failed" && (
          <section className="bg-surface border border-danger-border rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger-light border border-danger-border flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-main">AI processing failed</h2>
                  <p className="text-xs text-text-tertiary">
                    Something went wrong during analysis — you can try again
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="retry-detail-btn-status"
                onClick={handleProcess}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-danger border border-danger-border bg-danger-light hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          </section>
        )}

        {/* 422 — empty/no extractable text */}
        {!processing && processError === "empty" && (
          <section className="bg-surface border border-border rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-text-subtle" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-main">
                  Not enough readable text
                </h2>
                <p className="text-xs text-text-tertiary">
                  This document doesn't contain enough readable text to analyze
                </p>
              </div>
            </div>
          </section>
        )}

        {/* "processing" status loaded from DB on mount — show passive processing state */}
        {!processing && processError === null && status === "processing" && (
          <section className="bg-surface border border-primary-border/50 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-main">Processing in progress…</h2>
                <p className="text-xs text-text-tertiary">
                  This document is being analyzed. Refresh the page to check for updates.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Completed — AI Summary Section */}
        {isCompleted && processError === null && (
          <section className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-primary-light/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-text-main">
                  AI Summary
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* Document type badge */}
                {document.document_type && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${getDocTypeBadgeStyle(document.document_type)}`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {document.document_type}
                  </span>
                )}
                {/* Confidence */}
                {document.confidence != null && (
                  <span className="text-xs text-text-subtle font-medium">
                    {Math.round(document.confidence * 100)}%
                  </span>
                )}
                {/* Re-process icon */}
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={processing}
                  title="Re-process document"
                  className="p-1.5 rounded-lg text-text-subtle hover:text-primary hover:bg-primary-light transition-colors cursor-pointer disabled:opacity-50"
                  id="reprocess-detail-btn"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary prose */}
              {document.summary && (
                <p className="text-sm leading-relaxed text-text-secondary" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  {document.summary}
                </p>
              )}

              {/* Chunk count caption */}
              {document.chunk_count != null && (
                <div className="flex items-center gap-1.5 text-xs text-text-subtle pt-2 border-t border-border/50">
                  <Blocks className="w-3.5 h-3.5" />
                  <span>Indexed in {document.chunk_count} {document.chunk_count === 1 ? "segment" : "segments"}</span>
                </div>
              )}
            </div>
          </section>
        )}
 
        {/* Document Q&A Section */}
        <DocumentChat
          processingStatus={document.processing_status}
          documentId={document.id}
        />

        {/* Extracted Raw Text Section */}
        <section className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-text-main">
                Extracted Text Content
              </h2>
              {document.raw_text && (
                <span className="text-xs text-text-tertiary">
                  ({document.raw_text.length.toLocaleString()} characters)
                </span>
              )}
            </div>

            {document.raw_text && (
              <button
                type="button"
                id="copy-text-btn"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-subtle text-xs font-medium text-text-secondary hover:text-text-main transition-colors cursor-pointer shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-success" />
                    <span className="text-success font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-6">
            {document.raw_text && document.raw_text.trim().length > 0 ? (
              <div
                id="document-raw-text"
                className="max-h-[600px] overflow-y-auto p-6 bg-surface-subtle border border-border rounded-xl font-mono text-sm leading-relaxed text-text-main whitespace-pre-wrap select-text selection:bg-primary-light selection:text-primary"
              >
                {document.raw_text}
              </div>
            ) : (
              <div className="py-12 text-center text-text-tertiary text-xs italic">
                No text could be extracted from this document.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-text-subtle mt-12">
        DocuMind AI &copy; 2026 &bull; Secure Document Processing Platform
      </footer>
    </div>
  );
}
