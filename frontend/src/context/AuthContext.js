import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || "Failed to log in. Please check your credentials.";
        setError(errorMsg);
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }

      setUser(data.user);
      setIsLoading(false);
      return { success: true, user: data.user };
    } catch (err) {
      const errorMsg = err.message || "Network error while logging in.";
      setError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.message || "Failed to change password." };
      }
    } catch (err) {
      return { success: false, error: err.message || "Network error." };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        requiresPasswordChange: !!user?.requiresPasswordChange,
        isAuthenticated: !!user,
        isLoading,
        error,
        setError,
        login,
        changePassword,
        logout,
        refreshAuth: checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
