import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // true while restoring session on mount

  // On mount, check localStorage for a saved token and validate it via getMe()
  useEffect(() => {
    const savedToken = localStorage.getItem("documind_token");
    if (!savedToken) {
      setLoading(false);
      return;
    }

    setToken(savedToken);

    authApi
      .getMe()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        // Token is expired or invalid — clear everything
        localStorage.removeItem("documind_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /**
   * Log in with email + password.
   * Stores the token and fetches the user profile.
   */
  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    const accessToken = data.access_token;

    localStorage.setItem("documind_token", accessToken);
    setToken(accessToken);

    const userData = await authApi.getMe();
    setUser(userData);

    return userData;
  }, []);

  /**
   * Register a new account, then immediately log in to get a token.
   * The backend's /register does NOT return a token, so we must call
   * /login right after to obtain one.
   */
  const register = useCallback(
    async (email, password, fullName) => {
      await authApi.register(email, password, fullName);
      // Now log in with the same credentials to get the access_token
      return login(email, password);
    },
    [login]
  );

  /**
   * Clear auth state and remove saved token.
   */
  const logout = useCallback(() => {
    localStorage.removeItem("documind_token");
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
