"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { auth, googleProvider } from "@/firebase";
import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";

const DEFAULT_ERROR = "Something went wrong. Please try again.";

export default function useAuthActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const markActive = useAuthStore((state) => state.markActive);

  const handleSession = useCallback(
    async (idToken, referralCode = null) => {
      const response = await apiClient.post("/users/session", { 
        idToken,
        referralCode: referralCode || null,
      });
      const { token, user } = response.data;
      setSession({ token, user });
      markActive();
      return user;
    },
    [markActive, setSession],
  );

  const loginWithGoogle = useCallback(async (referralCode = null) => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      if (!result?.user) {
        throw new Error("No user returned from Google");
      }
      const idToken = await result.user.getIdToken();
      await handleSession(idToken, referralCode);
      router.push("/dashboard");
    } catch (err) {
      const message = err?.message ?? DEFAULT_ERROR;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [handleSession, router]);

  const loginWithEmail = useCallback(
    async (email, password, referralCode = null) => {
      try {
        setLoading(true);
        setError(null);
        const credentials = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await credentials.user.getIdToken();
        await handleSession(idToken, referralCode);
        router.push("/dashboard");
      } catch (err) {
        const message = err?.message ?? DEFAULT_ERROR;
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [handleSession, router],
  );

  const registerWithEmail = useCallback(async (email, password, referralCode = null) => {
    try {
      setLoading(true);
      setError(null);
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await credentials.user.getIdToken();
      await handleSession(idToken, referralCode);
      router.push("/dashboard");
    } catch (err) {
      const message = err?.message ?? DEFAULT_ERROR;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [handleSession, router]);

  const logout = useCallback(async () => {
    // Clear Firebase auth
    try {
      await signOut(auth);
    } catch (error) {
      // Ignore Firebase signOut errors (user might not have Firebase account)
      console.log('[Logout] Firebase signOut:', error.message);
    }
    
    // Clear auth session
    clearSession();
    
    // Clear quick login cache (for quick login users)
    localStorage.removeItem("quickLoginId");
    
    // Set a flag to prevent immediate auto-login
    sessionStorage.setItem("justLoggedOut", "true");
    
    router.push("/");
  }, [clearSession, router]);

  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      setError(err?.message ?? DEFAULT_ERROR);
      return false;
    }
  }, []);

  return {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    resetPassword,
    loading,
    error,
    setError,
  };
}

