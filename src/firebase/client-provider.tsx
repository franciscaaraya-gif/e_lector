'use client';

import { FirebaseProvider } from './provider';

// This provider ensures that Firebase is only initialized on the client side.
export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <FirebaseProvider>{children}</FirebaseProvider>;
};
