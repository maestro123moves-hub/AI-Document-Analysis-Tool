import client from "./client";

/**
 * Upload a document to the backend.
 * @param {File} file - The file to upload
 * @param {Function} [onProgress] - Optional upload progress callback (percent: number) => void
 * @returns {Promise<object>} DocumentUploadResponse
 */
export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const config = {};
  if (typeof onProgress === "function") {
    config.onUploadProgress = (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    };
  }

  const response = await client.post("/api/documents/upload", formData, config);
  return response.data;
}

/**
 * List documents for the current user.
 * @param {number} [skip=0]
 * @param {number} [limit=20]
 * @returns {Promise<Array<object>>} List of DocumentResponse
 */
export async function listDocuments(skip = 0, limit = 20) {
  const response = await client.get("/api/documents/", {
    params: { skip, limit },
  });
  return response.data;
}

/**
 * Get single document details including raw_text.
 * @param {string} id - Document UUID
 * @returns {Promise<object>} DocumentDetailResponse
 */
export async function getDocument(id) {
  const response = await client.get(`/api/documents/${id}`);
  return response.data;
}

/**
 * Delete a document by UUID.
 * @param {string} id - Document UUID
 * @returns {Promise<object>}
 */
export async function deleteDocument(id) {
  const response = await client.delete(`/api/documents/${id}`);
  return response.data;
}

/**
 * Trigger AI processing for a document.
 * The backend takes 8–10 seconds under real conditions, so this call uses a
 * 30-second timeout to avoid dropping requests that would succeed under
 * normal network jitter.  The shared client's default timeout is NOT changed.
 *
 * @param {string} id - Document UUID
 * @returns {Promise<object>} ProcessingResult
 */
export async function processDocument(id) {
  const response = await client.post(`/api/documents/${id}/process`, null, {
    timeout: 30000,
  });
  return response.data;
}

/**
 * Ask a question about a single document using RAG.
 * @param {string} documentId - Document UUID
 * @param {string} question - Question text
 * @param {number} [topK=5] - Number of chunks to retrieve
 * @returns {Promise<object>} AskResponse { answer, source_chunks, processing_time_ms }
 */
export async function askDocument(documentId, question, topK = 5) {
  const response = await client.post(
    `/api/documents/${documentId}/ask`,
    {
      question,
      top_k: topK,
    },
    { timeout: 15000 }
  );
  return response.data;
}

/**
 * Ask a question across all (or a subset of) documents using RAG.
 * documentIds arrives as null (not []) when unscoped, and is passed as-is.
 * @param {string} question - Question text
 * @param {number} [topK=5] - Number of chunks to retrieve
 * @param {Array<string>|null} [documentIds=null] - Document IDs or null
 * @returns {Promise<object>} GlobalAskResponse { answer, source_chunks, processing_time_ms }
 */
export async function askGlobal(question, topK = 5, documentIds = null) {
  const response = await client.post(
    "/api/documents/ask",
    {
      question,
      top_k: topK,
      document_ids: documentIds,
    },
    { timeout: 15000 }
  );
  return response.data;
}

/**
 * Export a document as PDF or Excel.
 * Streams response as blob, handles blob error responses, extracts filename
 * from Content-Disposition header, and triggers browser download.
 *
 * @param {string} id - Document UUID
 * @param {'pdf' | 'excel'} format - Export format
 * @returns {Promise<{ filename: string }>} Resolves on successful download trigger
 */
export async function exportDocument(id, format) {
  try {
    const response = await client.get(`/api/documents/${id}/export`, {
      params: { format },
      responseType: "blob",
    });

    // Read filename from Content-Disposition response header
    let filename = "";
    const disposition =
      response.headers?.["content-disposition"] ||
      response.headers?.["Content-Disposition"];

    if (disposition) {
      // Matches filename="document.pdf", filename=document.pdf, or filename*=UTF-8''document.pdf
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";\r\n]+)"?/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1].trim());
      }
    }

    // Defensive fallback if Content-Disposition header missing or unparsable
    if (!filename) {
      const ext = format === "excel" ? "xlsx" : "pdf";
      filename = `document-${id}.${ext}`;
    }

    // Trigger download via temporary anchor element
    const blob = new Blob([response.data], {
      type:
        response.headers?.["content-type"] ||
        (format === "excel"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf"),
    });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { filename };
  } catch (error) {
    let errorMessage = "Failed to export document. Please try again.";

    // When responseType is 'blob', error payloads (404, 422, 500) are also Blobs
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const parsed = JSON.parse(text);
        if (parsed?.detail) {
          if (typeof parsed.detail === "string") {
            errorMessage = parsed.detail;
          } else if (Array.isArray(parsed.detail)) {
            errorMessage = parsed.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
          } else {
            errorMessage = JSON.stringify(parsed.detail);
          }
        } else if (text) {
          errorMessage = text;
        }
      } catch {
        if (error.response?.statusText) {
          errorMessage = `Export failed (${error.response.status}): ${error.response.statusText}`;
        }
      }
    } else if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      errorMessage = typeof detail === "string" ? detail : JSON.stringify(detail);
    } else if (error.message) {
      errorMessage = error.message;
    }

    const enhancedError = new Error(errorMessage);
    enhancedError.status = error.response?.status;
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

