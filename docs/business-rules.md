# Reglas de Negocio Implementadas: Proyecto E-lector

Este documento detalla las reglas de lógica de negocio extraídas directamente del código fuente actual.

## 1. Dominio: Autenticación y Acceso Administrativo

### Acceso a la Consola
*   **Regla**: Solo usuarios con correos electrónicos presentes en la colección `authorizedAdmins` (en minúsculas) pueden crear un perfil de administrador.
*   **Ubicación**: `src/components/auth/AdminLoginForm.tsx` (función `handleMicrosoftSignIn`).
*   **Condiciones**: El correo debe coincidir exactamente con el registro en Firestore tras ser convertido a minúsculas.
*   **Dependencia**: Requiere autenticación exitosa previa vía Microsoft SSO.

### Persistencia de Sesión Admin
*   **Regla**: Las sesiones de los administradores son volátiles y se mantienen solo en memoria del navegador, cerrándose al cerrar la pestaña o recargar (en ciertos flujos).
*   **Ubicación**: `src/components/auth/AdminLoginForm.tsx` (uso de `inMemoryPersistence`).
*   **Condiciones**: Se aplica tanto a login por Microsoft como por Email/Password.
*   ⚠️ **Inconsistencia**: El `AdminLayout.tsx` asume persistencia para verificar el estado, lo que puede causar cierres de sesión inesperados al navegar.

### Colaboración en Salas
*   **Regla**: Un administrador puede delegar la gestión de su sala a otros usuarios autorizados mediante su correo electrónico.
*   **Ubicación**: `src/components/admin/settings/CollaboratorsManager.tsx`.
*   **Condiciones**: El colaborador invitado ya debe existir en `authorizedAdmins` y haber iniciado sesión al menos una vez para registrar su UID.

## 2. Dominio: Gestión de Votaciones y Plantillas

### Opciones Obligatorias
*   **Regla**: Toda votación incluye automáticamente las opciones "Blanco" y "Nulo" al final de la lista, las cuales no pueden ser eliminadas ni reordenadas manualmente.
*   **Ubicación**: `src/components/admin/CreatePollDialog.tsx`.
*   **Condiciones**: Se insertan siempre en las dos últimas posiciones del array de opciones.

### Validación de Votación Múltiple
*   **Regla**: En encuestas de selección múltiple, el número máximo de opciones a marcar debe ser mayor a 1 y menor o igual al total de opciones disponibles.
*   **Ubicación**: `src/components/admin/CreatePollDialog.tsx` (validación Zod `refine`).
*   **Condiciones**: Si el tipo es `simple`, esta validación se ignora.

### Estados de Votación
*   **Regla**: Una votación debe pasar por un flujo de estados: `pending` (creada) -> `active` (abierta al público) -> `closed` (finalizada).
*   **Ubicación**: `src/app/admin/polls/[pollId]/page.tsx`.
*   **Condiciones**: Solo se puede activar si tiene un grupo asignado. Solo se puede cerrar si está activa.
*   **Dependencia**: La visibilidad en la bandeja del votante depende de este estado.

## 3. Dominio: Padrones y Grupos

### Exclusión de Mártires
*   **Regla**: La creación automática del grupo "Todo el Personal" excluye explícitamente a los miembros marcados con el tipo "Martir ".
*   **Ubicación**: `src/app/admin/groups/page.tsx` (función `handleCreateAllUsersGroup`).
*   **Condiciones**: Filtra por el string exacto `"Martir "` (incluyendo el espacio al final detectado en el Excel).

### Identificación de Votantes Externos
*   **Regla**: Los votantes añadidos manualmente al sistema sin registro previo reciben un identificador con el prefijo `EXT-` seguido de 5 dígitos aleatorios.
*   **Ubicación**: `src/app/admin/groups/[groupId]/page.tsx` (función `addManualVoter`).
*   **Condiciones**: Se genera para evitar colisiones con números de registro reales.

### Habilitación Individual
*   **Regla**: El administrador puede deshabilitar a votantes específicos dentro de una encuesta, impidiéndoles el acceso aunque pertenezcan al grupo asignado.
*   **Ubicación**: `src/app/admin/polls/[pollId]/page.tsx` (función `toggleVoterEnabled`).
*   **Condiciones**: Solo editable mientras la encuesta está en estado `pending`.

## 4. Dominio: Proceso de Votación y Escrutinio

### Unicidad del Voto
*   **Regla**: Un usuario solo puede emitir su voto si su registro está marcado como `hasVoted: false` y `enabled: true` para esa encuesta específica.
*   **Ubicación**: `src/app/vote/[pollId]/page.tsx`.
*   **Condiciones**: La verificación ocurre en el momento de cargar la página de votación.
*   ⚠️ **Inconsistencia**: La marca de `hasVoted` y la escritura del voto ocurren en una transacción atómica, pero la validación inicial es una lectura simple que podría ser vulnerable a condiciones de carrera rápidas.

### Anonimato del Sufragio
*   **Regla**: El registro de quién votó y el contenido del voto se almacenan en colecciones totalmente separadas sin claves foráneas que los vinculen.
*   **Ubicación**: `src/app/vote/[pollId]/page.tsx` (función `onSubmit`).
*   **Condiciones**: Se registra el `adminId` y `pollId` en el voto, pero nunca el `voterId`.

### Escrutinio y Exportación
*   **Regla**: Los resultados solo son visibles y exportables una vez que la votación ha sido marcada como `closed`.
*   **Ubicación**: `src/app/admin/polls/[pollId]/page.tsx` y `PollResultsDialog.tsx`.
*   **Condiciones**: El botón de "Resultados" está oculto en estados `pending` y `active`.

## 5. Dominio: Carga de Datos y Personal

### Normalización de Cabeceras Excel
*   **Regla**: El sistema ignora tildes, espacios y caracteres especiales en los encabezados de Excel para mapear los datos a los campos de la base de datos.
*   **Ubicación**: `src/components/admin/settings/VoluntariosManager.tsx` (función `normalizeHeader`).
*   **Condiciones**: Convierte todo a mayúsculas y elimina diacríticos antes de comparar.

### Mapeo de RFID
*   **Regla**: La carga de tarjetas RFID no crea registros nuevos, sino que actualiza voluntarios existentes buscando una coincidencia exacta en el "Número de Registro".
*   **Ubicación**: `src/components/admin/settings/VoluntariosManager.tsx` (función `uploadRfid`).
*   **Condiciones**: Si el número de registro en el Excel de RFID no existe en la base de datos, el registro se ignora silenciosamente.
