import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ForceBodyInteractive } from '@/components/ForceBodyInteractive'

export const metadata: Metadata = {
  title: 'E-lector: Votación Digital Segura',
  description: 'Una plataforma de votación moderna, segura y anónima.',
  applicationName: 'E-lector',
  // iPhone: ícono al "Añadir a pantalla de inicio" y modo pantalla completa
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'E-lector',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#4051b5',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('font-body antialiased')}>
        <ForceBodyInteractive />

        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>

        <Toaster />
      </body>
    </html>
  );
}
