import { formatDistanceToNow } from "date-fns";

/**
 * Format bytes into human-readable string (e.g., "2.4 MB")
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === null || bytes === undefined) return "N/A";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format date string into relative time (e.g. "5 minutes ago")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return "Recently";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Recently";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Recently";
  }
}

/**
 * Return badge configuration for file types
 */
export function getFileTypeBadge(fileType) {
  const type = (fileType || "").toLowerCase();
  if (type.includes("pdf")) {
    return {
      label: "PDF",
      type: "pdf",
      bgColor: "bg-rose-50 text-rose-700 border-rose-200",
      iconColor: "text-rose-600",
    };
  }
  if (type.includes("word") || type.includes("docx")) {
    return {
      label: "DOCX",
      type: "docx",
      bgColor: "bg-blue-50 text-blue-700 border-blue-200",
      iconColor: "text-blue-600",
    };
  }
  if (type.includes("image") || type.includes("png") || type.includes("jpg") || type.includes("jpeg")) {
    return {
      label: "IMAGE",
      type: "image",
      bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconColor: "text-emerald-600",
    };
  }
  return {
    label: "TXT",
    type: "txt",
    bgColor: "bg-stone-100 text-stone-700 border-stone-200",
    iconColor: "text-stone-600",
  };
}
