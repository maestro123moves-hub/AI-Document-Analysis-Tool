import client from "./client";

/**
 * Register a new user.
 * POST /api/auth/register
 * Returns UserResponse (no token).
 */
export async function register(email, password, fullName) {
  const response = await client.post("/api/auth/register", {
    email,
    password,
    full_name: fullName,
  });
  return response.data;
}

/**
 * Log in an existing user.
 * POST /api/auth/login
 * Returns { access_token, token_type }.
 */
export async function login(email, password) {
  const response = await client.post("/api/auth/login", {
    email,
    password,
  });
  return response.data;
}

/**
 * Fetch the currently authenticated user's profile.
 * GET /api/auth/me
 * Requires Authorization header (attached by interceptor).
 * Returns UserResponse.
 */
export async function getMe() {
  const response = await client.get("/api/auth/me");
  return response.data;
}
