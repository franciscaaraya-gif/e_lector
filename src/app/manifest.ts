import type { MetadataRoute } from 'next';

// Permite "instalar" E-lector en la pantalla de inicio del celular.
// Sin service worker a propósito: no se guarda nada en caché, así nadie
// ve una versión vieja de la app el día de una votación.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'E-lector: Votación Digital Segura',
    short_name: 'E-lector',
    description: 'Plataforma de votación digital, segura y anónima.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#4051b5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
