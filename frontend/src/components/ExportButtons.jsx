import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { exportDocument } from "../api/documents";

/**
 * ExportButtons component.
 * Supports standard view (two distinct buttons for PDF & Excel)
 * and compact view (sleek card-level export with dropdown/quick-action).
 *
 * State is strictly local to each component instance to prevent cross-card
 * pollution in lists or dashboards.
 *
 * @param {object} props
 * @param {string} props.documentId - UUID of document to export
 * @param {'default' | 'compact'} [props.variant='default'] - Visual style
 * @param {string} [props.className=''] - Extra classes
 */
export default function ExportButtons({
  documentId,
  variant = "default",
  className = "",
}) {
  // Local loading states tracked independently per format
  const [loading, setLoading] = useState({ pdf: false, excel: false });
  // Local format-specific error states
  const [errors, setErrors] = useState({ pdf: null, excel: null });
  // Local auto-fading success state
  const [successMsg, setSuccessMsg] = useState(null);
  // Compact dropdown open/close state
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isMountedRef = useRef(true);
  const successTimerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  // Close compact dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [dropdownOpen]);

  const handleExport = async (format, e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }

    // Double-submission guard: early return if already exporting this format
    if (loading[format]) return;

    setLoading((prev) => ({ ...prev, [format]: true }));
    setErrors((prev) => ({ ...prev, [format]: null }));
    setSuccessMsg(null);
    if (dropdownOpen) setDropdownOpen(false);

    try {
      const result = await exportDocument(documentId, format);
      if (isMountedRef.current) {
        const label = format === "excel" ? "Excel" : "PDF";
        setSuccessMsg(`Exported ${result.filename || label}`);
        if (successTimerRef.current) {
          clearTimeout(successTimerRef.current);
        }
        successTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setSuccessMsg(null);
          }
        }, 3500);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message =
          err.message || `Failed to export as ${format.toUpperCase()}`;
        setErrors((prev) => ({ ...prev, [format]: message }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading((prev) => ({ ...prev, [format]: false }));
      }
    }
  };

  // Compact variant for Dashboard DocumentCard
  if (variant === "compact") {
    const isAnyLoading = loading.pdf || loading.excel;

    return (
      <div
        ref={dropdownRef}
        className={`relative inline-flex items-center ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center rounded-lg border border-border bg-surface shadow-2xs">
          {/* Quick PDF Export Icon */}
          <button
            type="button"
            id={`export-btn-${documentId}`}
            disabled={isAnyLoading}
            onClick={(e) => handleExport("pdf", e)}
            title={
              loading.pdf
                ? "Exporting PDF…"
                : "Export as PDF (Click) or open format menu (▾)"
            }
            aria-label="Export document as PDF"
            className="p-1.5 text-text-subtle hover:text-primary hover:bg-surface-subtle rounded-l-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading.pdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Dropdown toggle */}
          <button
            type="button"
            id={`export-dropdown-toggle-${documentId}`}
            disabled={isAnyLoading}
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((prev) => !prev);
            }}
            title="Export options"
            aria-label="Export options"
            className="px-1 py-1.5 text-text-subtle hover:text-text-main hover:bg-surface-subtle border-l border-border rounded-r-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div
            id={`export-menu-${documentId}`}
            className="absolute right-0 top-full mt-1.5 w-44 bg-surface border border-border rounded-xl shadow-lg z-50 py-1 text-xs animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              id={`export-pdf-card-${documentId}`}
              disabled={loading.pdf}
              onClick={(e) => handleExport("pdf", e)}
              className="w-full flex items-center gap-2 px-3 py-2 text-text-main hover:bg-surface-subtle transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              {loading.pdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>{loading.pdf ? "Exporting PDF…" : "Export as PDF"}</span>
            </button>

            <button
              type="button"
              id={`export-excel-card-${documentId}`}
              disabled={loading.excel}
              onClick={(e) => handleExport("excel", e)}
              className="w-full flex items-center gap-2 px-3 py-2 text-text-main hover:bg-surface-subtle transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              {loading.excel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>
                {loading.excel ? "Exporting Excel…" : "Export as Excel"}
              </span>
            </button>
          </div>
        )}

        {/* Card-level compact feedback */}
        {successMsg && (
          <div className="absolute right-0 -bottom-6 z-30 whitespace-nowrap text-[10px] font-medium text-success bg-success-light border border-success-border px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 animate-in fade-in">
            <CheckCircle2 className="w-3 h-3 text-success" />
            <span>Saved!</span>
          </div>
        )}

        {(errors.pdf || errors.excel) && (
          <div
            id={`export-card-error-${documentId}`}
            className="absolute right-0 -bottom-8 z-30 whitespace-nowrap text-[10px] font-medium text-danger bg-danger-light border border-danger-border px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 animate-in fade-in"
            title={errors.pdf || errors.excel}
          >
            <AlertCircle className="w-3 h-3 text-danger" />
            <span className="max-w-[160px] truncate">
              {errors.pdf || errors.excel}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Standard variant for DocumentDetail
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Buttons Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* PDF Export Button */}
        <button
          type="button"
          id="export-pdf-btn"
          disabled={loading.pdf}
          onClick={(e) => handleExport("pdf", e)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-border bg-surface text-text-main hover:bg-surface-subtle hover:border-border-hover transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.pdf ? (
            <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
          ) : (
            <FileText className="w-4 h-4 text-rose-600" />
          )}
          <span>{loading.pdf ? "Exporting PDF…" : "Export as PDF"}</span>
        </button>

        {/* Excel Export Button */}
        <button
          type="button"
          id="export-excel-btn"
          disabled={loading.excel}
          onClick={(e) => handleExport("excel", e)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-border bg-surface text-text-main hover:bg-surface-subtle hover:border-border-hover transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading.excel ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          )}
          <span>{loading.excel ? "Exporting Excel…" : "Export as Excel"}</span>
        </button>

        {/* Auto-fading Success Indicator */}
        {successMsg && (
          <div
            id="export-success-message"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success-light border border-success-border px-3 py-1.5 rounded-lg animate-in fade-in"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
            <span className="truncate max-w-[220px]">{successMsg}</span>
          </div>
        )}
      </div>

      {/* Format-specific Inline Errors */}
      {(errors.pdf || errors.excel) && (
        <div className="flex flex-col gap-1.5 w-full text-xs text-danger bg-danger-light border border-danger-border rounded-xl p-3 animate-in fade-in">
          {errors.pdf && (
            <div className="flex items-start gap-1.5" id="export-error-pdf">
              <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">PDF Export:</strong>{" "}
                {errors.pdf}
              </span>
            </div>
          )}
          {errors.excel && (
            <div className="flex items-start gap-1.5" id="export-error-excel">
              <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">Excel Export:</strong>{" "}
                {errors.excel}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
