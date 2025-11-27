# WhatsCRM Webhook Server

Servidor Node.js/Express para recibir mensajes de WhatsApp y sincronizarlos con Firebase.

## Despliegue en Render.com

### Paso 1: ~~Obtener Credenciales~~ ¡Ya No Es Necesario!

**Buenas noticias:** Este webhook usa la REST API de Firestore, así que **NO necesitas credenciales de servicio**.

Solo necesitas tu **API Key** de Firebase (que ya tienes):
- `AIzaSyAZe-olQsCvU9l8riFI_YjqPgMF9h2Evbk`

✅ ¡Saltamos este paso!

### Paso 2: Crear Repositorio en GitHub

1. Crea un nuevo repositorio en GitHub (puede ser privado)
2. Sube esta carpeta `webhook-server` al repositorio:
   ```bash
   cd webhook-server
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/whatscrm-webhook.git
   git push -u origin main
   ```

### Paso 3: Desplegar en Render

1. Ve a [Render.com](https://render.com/) y crea una cuenta (gratis)
2. Haz clic en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `whatscrm-webhook`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

5. En **Environment Variables**, agrega:
   - `FIREBASE_PROJECT_ID` = `axel-messenger`
   - `FIREBASE_API_KEY` = `AIzaSyAZe-olQsCvU9l8riFI_YjqPgMF9h2Evbk`
   - `APP_ID` = `whatscrm-axel`
   - `VERIFY_TOKEN` = `MI_TOKEN_SECRETO`

6. Haz clic en **"Create Web Service"**

### Paso 4: Obtener URL

Una vez desplegado, Render te dará una URL como:
`https://whatscrm-webhook.onrender.com`

Copia esa URL y agrégale `/webhook`:
`https://whatscrm-webhook.onrender.com/webhook`

¡Esa es la URL que usarás en Meta Developer Console!
