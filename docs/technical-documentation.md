# Documentación Técnica: Proyecto E-lector

Este documento detalla el estado actual del repositorio, su arquitectura, dependencias y deuda técnica identificada al día de hoy.

## 1. Stack Técnico
*   **Framework Principal**: [Next.js 15.5.9](https://nextjs.org/) (App Router).
*   **Lenguaje**: TypeScript.
*   **Interfaz de Usuario**:
    *   **Componentes**: [Shadcn UI](https://ui.shadcn.com/) (basado en Radix UI).
    *   **Estilos**: [Tailwind CSS](https://tailwindcss.com/).
    *   **Iconos**: [Lucide React](https://lucide.dev/).
    *   **Gráficos**: [Recharts](https://recharts.org/).
*   **Servicios Externos (Firebase)**:
    *   **Autenticación**: Firebase Auth (Soporta Email/Password, Microsoft SSO y login Anónimo para votantes).
    *   **Base de Datos**: Firestore (NoSQL en tiempo real).
*   **APIs de Terceros**:
    *   **Generador de QR**: `https://api.qrserver.com/v1/create-qr-code/` (Utilizado para el acceso a salas y encuestas).
*   **Procesamiento de Datos**:
    *   **Excel**: [XLSX (SheetJS)](https://sheetjs.com/) para parsear listados de personal y RFID.
*   **IA de Próxima Generación**: [Genkit](https://firebase.google.com/docs/genkit) (Configurado para futuras integraciones).

## 2. Estructura del Proyecto
*   `src/app`: Directorio raíz de rutas y layouts.
    *   `/admin`: Panel de control, gestión de encuestas, grupos y configuración de sala.
    *   `/inbox`: Area del votante para identificar encuestas disponibles mediante Número de Registro.
    *   `/vote`: Proceso de emisión de voto y éxito.
*   `src/components`:
    *   `/ui`: Componentes base de Shadcn (Botones, inputs, diálogos, etc.).
    *   `/admin`: Componentes específicos de gestión (Creación de encuestas, resultados, gestión de personal).
    *   `/auth`: Formularios de inicio de sesión.
    *   `/layout`: Navegación principal y Sidebar para administradores.
*   `src/firebase`: Lógica de inicialización y hooks personalizados para Firestore/Auth.
*   `src/lib`: Definición de tipos globales (`types.ts`), constantes de imágenes y utilidades.
*   `docs`: Contiene el blueprint del backend (`backend.json`) y reglas de seguridad.

## 3. Puntos de Entrada y Flujos de Usuario
### Flujo del Administrador
1.  **Login (`/admin/login`)**: Autenticación vía Microsoft o Email. Solo correos en la whitelist `authorizedAdmins` pueden crear perfil.
2.  **Dashboard (`/admin/dashboard`)**: Vista general de encuestas y acceso rápido al QR de la sala.
3.  **Gestión de Grupos (`/admin/groups`)**: Creación de listas de votantes (manual o masiva).
4.  **Configuración (`/admin/settings`)**: Carga de personal vía Excel, asociación de tarjetas RFID y definición de plantillas.
5.  **Detalle de Encuesta (`/admin/polls/[id]`)**: Asignación de grupo -> Activación -> Cierre -> Informe (Excel).

### Flujo del Votante
1.  **Ingreso a Sala (`/inbox?salaId=...`)**: El usuario llega vía QR o link directo de la sala.
2.  **Identificación**: Ingresa su "Número de Registro".
3.  **Bandeja de Entrada (`/inbox/polls`)**: Ve encuestas "Pendientes" (próximamente) y "Activas".
4.  **Votación (`/vote/[id]`)**: Emisión anónima. El sistema marca `hasVoted: true` en el padrón y añade un voto sin ID a la urna.

## 4. Dependencias Externas Críticas
*   **Firebase SDK**: Si los servicios de Google Cloud fallan, la aplicación queda totalmente inoperativa (no se pueden leer encuestas ni emitir votos).
*   **QR Server API**: El renderizado de códigos QR depende de este servicio externo. Si falla, los administradores no pueden mostrar el acceso visual (aunque los links manuales seguirían funcionando).
*   **Vercel**: El despliegue y las variables de entorno dependen de la plataforma de hosting.

## 5. Deuda Técnica Conocida
*   **Hacks de Interactividad**: 
    *   `src/components/ForceBodyInteractive.tsx`: Existe un hack (`setInterval`) para forzar que el `body` sea interactivo porque Radix UI a veces deja el scroll bloqueado tras cerrar diálogos.
    *   `src/app/globals.css`: Regla `[data-radix-portal] { pointer-events: none; }` para evitar que portales invisibles bloqueen clics.
*   **Doble Lectura en Voto**: En `src/app/vote/[pollId]/page.tsx`, se debe consultar primero `poll-lookup` para saber a qué administrador pertenece la encuesta antes de poder leer la encuesta misma. Esto es un workaround por la estructura de subcolecciones de Firestore.
*   **Redundancia de Tipos**: Algunos tipos en `src/lib/types.ts` podrían estar más normalizados; hay pequeñas inconsistencias entre cómo se manejan los `Timestamp` de Firebase y las fechas en el cliente.
*   **Búsqueda en Cliente**: En `src/app/admin/groups/[groupId]/page.tsx`, la búsqueda de personal se hace sobre el array completo cargado en memoria. Con listas de miles de voluntarios, esto podría impactar el rendimiento.

## 6. Bugs y Comportamientos Inusuales
*   **Correlación Temporal**: Actualmente, los votos se guardan con `serverTimestamp()`. Un análisis de la base de datos podría ligar a un votante con su voto si ambos registros ocurren en el mismo segundo (vínculo por proximidad).
*   **Flasheo de Login**: En `src/app/admin/layout.tsx`, el usuario puede ver brevemente el estado de carga (`FullScreenSkeleton`) antes de que Firebase Auth confirme la sesión, incluso si ya estaba logueado.
*   **Estado de Hidratación**: Uso de `window.location.origin` dentro de `useEffect` en el Dashboard. Aunque está protegido, podría causar pequeñas discrepancias visuales de URL si no se maneja con cuidado en entornos de red lentos.
*   **Validación de Excel**: El parseo en `VoluntariosManager.tsx` asume una estructura de encabezados normalizada. Si el Excel tiene codificaciones de caracteres extrañas (UTF-8 con BOM), la normalización de cabeceras podría fallar silenciosamente.
