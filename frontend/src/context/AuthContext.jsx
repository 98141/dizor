"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  getMe,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  updatePassword as updatePasswordApi,
  updateProfile as updateProfileApi,
} from "@/services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const register = async (formData) => {
    const data = await registerUser(formData);
    setUser(data.user);
    return data;
  };

  const login = async (formData) => {
    const data = await loginUser(formData);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const updatePassword = async (formData) => {
    const data = await updatePasswordApi(formData);
    setUser(data.user);
    return data;
  };

  const updateProfile = async (formData) => {
    const data = await updateProfileApi(formData);
    setUser(data.user);
    return data;
  };

  const setAuthUser = (userData) => {
    setUser(userData);
  };

  const loadUser = async () => {
    try {
      const data = await getMe();
      setUser(data.user);
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          await refreshSession();
          const data = await getMe();
          setUser(data.user);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
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
        loadingAuth,
        isAuthenticated: !!user,
        register,
        login,
        logout,
        updatePassword,
        updateProfile,
        setAuthUser,
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