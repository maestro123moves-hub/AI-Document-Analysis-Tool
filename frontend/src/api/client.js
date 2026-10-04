import axios from "axios";
import { API_URL } from "../config";

const client = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach token to every outgoing request if one exists
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("documind_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // When sending FormData, let the browser / axios compute the multipart boundary
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
    if (config.headers?.delete) {
      config.headers.delete("Content-Type");
    }
  }
  return config;
});

export default client;
