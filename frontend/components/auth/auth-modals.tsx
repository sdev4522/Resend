'use client';

import React from 'react';
import { LoginDialog } from './login-dialog';
import { RegisterDialog } from './register-dialog';

export function AuthModals() {
  return (
    <>
      <LoginDialog />
      <RegisterDialog />
    </>
  );
}
