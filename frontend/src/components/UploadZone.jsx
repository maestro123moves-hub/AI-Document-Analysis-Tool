import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { uploadDocument } from "../api/documents";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".txt"];

export default function UploadZone({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef(null);
  const successTimerRef = useRef(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateFile = (file) => {
    if (!file) return "No file selected.";

    // 1. File size check (> 20MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "File size exceeds the 20MB limit. Please choose a smaller file.";
    }

    // 2. File extension check
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return "Unsupported file type. Accepted formats: .pdf, .docx, .png, .jpg, .jpeg, .txt";
    }

    return null;
  };

  const handleProcessFile = async (file) => {
    setErrorMessage("");
    setSuccessMessage("");
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }

    // Client-side validation check
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      resetFileInput();
      return;
    }

    // File passed client validation -> start upload
    setUploading(true);
    setUploadProgress(0);
    setCurrentFileName(file.name);

    try {
      const result = await uploadDocument(file, (percent) => {
        setUploadProgress(percent);
      });

      setSuccessMessage(`"${file.name}" uploaded successfully!`);
      if (typeof onUploadSuccess === "function") {
        onUploadSuccess(result);
      }

      // Auto-clear success message after 3.5 seconds
      successTimerRef.current = setTimeout(() => {
        setSuccessMessage("");
        setCurrentFileName("");
      }, 3500);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 413) {
        setErrorMessage("File too large: exceeds the 20MB server limit.");
      } else if (status === 422) {
        let msg = "Unsupported file type or invalid document structure.";
        if (typeof detail === "string") {
          msg = detail;
        } else if (Array.isArray(detail) && detail[0]?.msg) {
          msg = detail[0].msg;
        }
        setErrorMessage(msg);
      } else if (status === 500) {
        setErrorMessage("Server error occurred while processing the document. Please try again.");
      } else if (!err.response) {
        setErrorMessage("Upload failed: unable to connect to backend server. Please check your network.");
      } else {
        setErrorMessage(
          typeof detail === "string" ? detail : "Upload failed, please try again."
        );
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      resetFileInput();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleClickZone = () => {
    if (!uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Upload Box */}
      <div
        id="upload-dropzone"
        role="button"
        tabIndex={0}
        onClick={handleClickZone}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClickZone();
          }
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 select-none ${
          isDragging
            ? "border-primary bg-primary-light/60 scale-[1.005] shadow-md ring-4 ring-primary/10"
            : "border-border hover:border-primary/60 bg-surface hover:bg-surface-subtle/50 shadow-sm"
        } ${uploading ? "pointer-events-none opacity-90" : ""}`}
      >
        <input
          ref={fileInputRef}
          id="document-file-input"
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          /* Loading State */
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="relative">
              <div className="w-12 h-12 border-3 border-border border-t-primary rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-main">
                Uploading and extracting &ldquo;{currentFileName}&rdquo;…
              </p>
              <p className="text-xs text-text-tertiary">
                Extracting text and analyzing document structure
              </p>
            </div>

            {uploadProgress > 0 && (
              <div className="w-full max-w-xs space-y-1 pt-1">
                <div className="w-full bg-surface-subtle rounded-full h-2 overflow-hidden border border-border">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs font-medium text-text-secondary text-right">
                  {uploadProgress}%
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Default Ready State */
          <div className="flex flex-col items-center justify-center py-3 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary-light border border-primary-border/60 flex items-center justify-center text-primary shadow-xs">
              <UploadCloud className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <p className="text-base font-semibold text-text-main">
                <span className="text-primary hover:underline font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-text-tertiary">
                PDF, DOCX, PNG, JPG, or TXT (up to 20MB)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {["PDF", "DOCX", "PNG", "JPG", "TXT"].map((ext) => (
                <span
                  key={ext}
                  className="px-2 py-0.5 text-[11px] font-medium bg-surface-subtle border border-border text-text-secondary rounded-md"
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Feedback Alerts */}
      {errorMessage && (
        <div
          id="upload-error-message"
          className="flex items-start gap-3 p-3.5 rounded-xl bg-danger-light border border-danger-border text-danger text-sm shadow-xs animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-danger" />
          <div className="flex-1">
            <p className="font-medium text-danger">Upload Error</p>
            <p className="text-xs mt-0.5 opacity-90">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage("")}
            className="text-xs font-semibold hover:opacity-75 p-1"
            title="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div
          id="upload-success-message"
          className="flex items-center gap-3 p-3.5 rounded-xl bg-success-light border border-success-border text-success text-sm shadow-xs animate-in fade-in duration-200"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
          <div className="flex-1">
            <p className="font-medium text-success">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-xs font-semibold hover:opacity-75 p-1"
            title="Dismiss"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
