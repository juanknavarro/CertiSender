"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CertificateSettings {
  nameFontSize: number;
  docFontSize: number;
  nameColorHex: string;
  docColorHex: string;
}

export const DEFAULT_SETTINGS: CertificateSettings = {
  nameFontSize: 28,
  docFontSize: 14,
  nameColorHex: "#1a264d",
  docColorHex: "#4d4d4d",
};

interface SettingsContextType {
  settings: CertificateSettings;
  updateSettings: (newSettings: Partial<CertificateSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

const LOCAL_STORAGE_KEY = "certisender_settings";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CertificateSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Cargar configuraciones guardadas en localStorage al montar en el cliente
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings((prev) => ({
            ...prev,
            ...parsed,
          }));
        }
      } catch (e) {
        console.warn("No se pudo cargar la configuración de localStorage:", e);
      } finally {
        setIsLoaded(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Actualizar una o varias propiedades y persistir en localStorage
  const updateSettings = (newSettings: Partial<CertificateSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("No se pudo guardar la configuración en localStorage:", e);
      }
      return updated;
    });
  };

  // Restablecer valores de fábrica
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.warn("No se pudo restablecer la configuración en localStorage:", e);
    }
  };

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, resetSettings, isLoaded }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings debe utilizarse dentro de un <SettingsProvider>");
  }
  return context;
}
