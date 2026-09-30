import React, { useState } from "react";
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
} from "lucide-react";
import { formatBytes, formatRelativeTime, getFileTypeBadge } from "../utils/formatters";

export default function DocumentCard({ doc, onDelete }) {
  const navigate = useNavigate();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const badge = getFileTypeBadge(doc.file_type);
  const fileName = doc.original_filename || doc.filename || "Untitled Document";

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
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

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
