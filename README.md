# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Despliegue con Git y Vercel

Aquí tienes una guía paso a paso para poner tu proyecto en un repositorio de Git y desplegarlo en Vercel.

### Prerrequisitos

-   Tener [Node.js](https://nodejs.org/) y [Git](https://git-scm.com/) instalados.
-   Una cuenta en [GitHub](https://github.com/), [GitLab](https://gitlab.com/) o [Bitbucket](https://bitbucket.org/).
-   Una cuenta en [Vercel](https://vercel.com/).

### Paso 1: Preparar el Repositorio Local en Git

Abre una terminal en la carpeta de tu proyecto y ejecuta los siguientes comandos para inicializar un repositorio de Git y hacer tu primer commit.

```bash
# 1. Inicializa el repositorio de Git
git init

# 2. Añade todos los archivos al área de preparación
git add .

# 3. Guarda los cambios con un mensaje
git commit -m "Commit inicial del proyecto E-lector"
```

### Paso 2: Publicar tu Repositorio en GitHub

Ahora, subiremos tu código a un repositorio remoto en GitHub.

1.  Ve a [GitHub](https://github.com/new) y crea un nuevo repositorio (puedes hacerlo público o privado). No lo inicialices con un `README` o `.gitignore`, ya que tu proyecto ya los tiene.

2.  En tu terminal, enlaza tu repositorio local con el remoto que acabas de crear y sube tu código. Reemplaza `<URL_DEL_REPOSITORIO_EN_GITHUB>` con la URL que te proporciona GitHub.

    ```bash
    # 1. Enlaza tu repositorio local con el remoto
    git remote add origin <URL_DEL_REPOSITORIO_EN_GITHUB>

    # 2. (Opcional, recomendado) Renombra la rama principal a 'main'
    git branch -M main

    # 3. Sube tu código a GitHub
    git push -u origin main
    ```

### Paso 3: Desplegar en Vercel

Con tu código ya en GitHub, el despliegue en Vercel es muy sencillo.

1.  **Inicia sesión en Vercel** con tu cuenta.
2.  Desde tu panel de control, haz clic en **"Add New..." -> "Project"**.
3.  **Importa tu repositorio de Git**: Busca y selecciona el repositorio que acabas de subir a GitHub.
4.  **Configura tu proyecto**:
    *   Vercel detectará automáticamente que es un proyecto de Next.js y configurará los comandos de construcción (`next build`) y el directorio de salida por ti. No necesitas cambiar nada aquí.
    *   **¡Muy importante!** Despliega la sección **"Environment Variables"**. Aquí debes añadir las credenciales de tu proyecto de Firebase. He creado un archivo `.env.local` en tu proyecto con estos valores para que tu entorno de desarrollo siga funcionando. Cópialos y pégalos uno por uno en Vercel.

        Debes añadir las siguientes variables:
        -   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
        -   `NEXT_PUBLIC_FIREBASE_APP_ID`
        -   `NEXT_PUBLIC_FIREBASE_
        `
        -   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
        -   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
        -   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (puedes dejarlo en blanco si no lo usas)

5.  **Haz clic en "Deploy"**. Vercel se encargará del resto. Construirá tu aplicación y la desplegará en su red global. ¡En unos minutos, tu aplicación estará en línea!
