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
  return config;
});

export default client;
