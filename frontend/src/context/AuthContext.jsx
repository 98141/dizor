"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  getMe,
  loginUser,
  logoutUser,
  registerUser,
} from "@/services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const register = async (formData) => {
    const data = await registerUser(formData);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const login = async (formData) => {
    const data = await loginUser(formData);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setToken(null);
  };

  const loadUser = async () => {
    try {
      const data = await getMe();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loadingAuth,
        isAuthenticated: !!user,
        register,
        login,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
};