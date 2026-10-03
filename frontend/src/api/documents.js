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
