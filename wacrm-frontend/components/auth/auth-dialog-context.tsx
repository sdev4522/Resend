'use client';

import React, { createContext, useContext, useState } from 'react';

type AuthDialogType = 'login' | 'register' | null;

interface AuthDialogContextValue {
  dialog: AuthDialogType;
  openLogin: () => void;
  openRegister: () => void;
  closeDialog: () => void;
}

const AuthDialogContext = createContext<AuthDialogContextValue>({
  dialog: null,
  openLogin: () => {},
  openRegister: () => {},
  closeDialog: () => {},
});

export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<AuthDialogType>(null);

  const openLogin = () => setDialog('login');
  const openRegister = () => setDialog('register');
  const closeDialog = () => setDialog(null);

  return (
    <AuthDialogContext.Provider value={{ dialog, openLogin, openRegister, closeDialog }}>
      {children}
    </AuthDialogContext.Provider>
  );
}

export function useAuthDialog() {
  return useContext(AuthDialogContext);
}
