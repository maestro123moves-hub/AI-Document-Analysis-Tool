import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  Trash2,
  Calendar,
  Layers,
  HardDrive,
  FileCheck,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { formatBytes, formatRelativeTime, getFileTypeBadge } from "../utils/formatters";
import { processDocument, getDocument } from "../api/documents";

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

export default function DocumentCard({ doc, onDelete, onProcessed }) {
  const navigate = useNavigate();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const badge = getFileTypeBadge(doc.file_type);
  const fileName = doc.original_filename || doc.filename || "Untitled Document";
  const status = doc.processing_status || "pending";

  const handleCardClick = () => {
    if (!showConfirmDelete && !deleting) {
      navigate(`/documents/${doc.id}`);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowConfirmDelete(true);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setShowConfirmDelete(false);
  };

  const handleConfirmDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      if (typeof onDelete === "function") {
        await onDelete(doc.id);
      }
    } finally {
      if (isMountedRef.current) {
        setDeleting(false);
        setShowConfirmDelete(false);
      }
    }
  };

  const handleProcess = useCallback(
    async (e) => {
      e.stopPropagation();
      if (processing) return;
      setProcessing(true);
      try {
        const result = await processDocument(doc.id);
        if (isMountedRef.current) {
          // Fetch fresh document data after processing completes
          try {
            const freshDoc = await getDocument(doc.id);
            if (isMountedRef.current && typeof onProcessed === "function") {
              // Merge confidence & chunk_count from process result (GET doesn't return these)
              onProcessed(doc.id, {
                ...freshDoc,
                confidence: result.confidence,
                chunk_count: result.chunk_count,
              });
            }
          } catch {
            // Fallback: update with the result data we have
            if (isMountedRef.current && typeof onProcessed === "function") {
              onProcessed(doc.id, {
                ...doc,
                processing_status: "completed",
                document_type: result.document_type,
                confidence: result.confidence,
                summary: result.summary,
                chunk_count: result.chunk_count,
              });
            }
          }
        }
      } catch {
        // On failure, re-fetch to get the real status from DB
        if (isMountedRef.current) {
          try {
            const freshDoc = await getDocument(doc.id);
            if (isMountedRef.current && typeof onProcessed === "function") {
              onProcessed(doc.id, freshDoc);
            }
          } catch {
            // Can't refresh — just mark processing done
          }
        }
      } finally {
        if (isMountedRef.current) {
          setProcessing(false);
        }
      }
    },
    [doc, processing, onProcessed]
  );

  const isProcessing = processing || status === "processing";

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-surface border border-border hover:border-primary/40 rounded-xl p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
      id={`document-card-${doc.id}`}
    >
      <div>
        {/* Top Header: Badge + Delete Button */}
        <div className="flex items-center justify-between gap-2 mb-3">
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

          {showConfirmDelete ? (
            <div
              className="flex items-center gap-1.5 bg-danger-light p-1 rounded-lg border border-danger-border animate-in fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[11px] font-medium text-danger px-1">
                Delete?
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-2 py-0.5 text-xs font-medium bg-danger text-white rounded hover:bg-danger-hover transition-colors disabled:opacity-50 cursor-pointer"
                id={`confirm-delete-${doc.id}`}
              >
                {deleting ? "…" : "Yes"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleCancelDelete}
                className="px-2 py-0.5 text-xs font-medium bg-surface text-text-secondary border border-border rounded hover:bg-surface-subtle transition-colors cursor-pointer"
                id={`cancel-delete-${doc.id}`}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDeleteClick}
              title="Delete document"
              className="text-text-subtle hover:text-danger hover:bg-danger-light p-1.5 rounded-lg transition-colors cursor-pointer"
              id={`delete-btn-${doc.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Title */}
        <h3
          className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors line-clamp-2 mb-3 break-all"
          title={fileName}
        >
          {fileName}
        </h3>

        {/* AI Processing Status Row */}
        <div className="mb-3">
          {status === "completed" && !isProcessing && (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getDocTypeBadgeStyle(doc.document_type)}`}
              >
                <Sparkles className="w-3 h-3" />
                {doc.document_type || "Analyzed"}
              </span>
              {doc.confidence != null && (
                <span className="text-[11px] text-text-subtle font-medium">
                  {Math.round(doc.confidence * 100)}%
                </span>
              )}
              <button
                type="button"
                onClick={handleProcess}
                title="Re-process document"
                className="ml-auto p-1 rounded-md text-text-subtle hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                id={`reprocess-btn-${doc.id}`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs font-medium gentle-pulse">Analyzing…</span>
            </div>
          )}

          {status === "pending" && !isProcessing && (
            <button
              type="button"
              onClick={handleProcess}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary border border-primary-border bg-primary-light hover:bg-primary/10 transition-colors cursor-pointer"
              id={`process-btn-${doc.id}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Process
            </button>
          )}

          {status === "failed" && !isProcessing && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-medium text-danger">
                <AlertTriangle className="w-3.5 h-3.5" />
                Failed
              </span>
              <button
                type="button"
                onClick={handleProcess}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-danger border border-danger-border bg-danger-light hover:bg-danger/10 transition-colors cursor-pointer"
                id={`retry-btn-${doc.id}`}
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Meta Footer */}
      <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs text-text-tertiary">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-text-subtle" />
            {formatBytes(doc.file_size_bytes)}
          </span>
          {doc.page_count != null && (
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-text-subtle" />
              {doc.page_count} {doc.page_count === 1 ? "page" : "pages"}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-text-subtle pt-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-text-subtle" />
            {formatRelativeTime(doc.created_at)}
          </span>
          {doc.word_count != null && (
            <span className="flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-text-subtle" />
              {doc.word_count.toLocaleString()} words
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
