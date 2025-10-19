# 🚀 GUÍA DE DESPLIEGUE - API TESISTA EN DOKPLOY

Esta guía te ayudará a desplegar tu API_TESISTA en tu VPS Hostinger usando Dokploy.

## 📋 PRE-REQUISITOS

### ✅ En tu VPS:
- [x] Dokploy instalado y funcionando
- [x] Docker y Docker Compose funcionando
- [x] Acceso SSH al VPS
- [x] Dominio/subdominio configurado (ej: `api.tu-dominio.com`)

### ✅ Información que necesitarás:
- URL de tu proyecto Supabase
- Service Role Key de Supabase
- Dominio donde estará tu API
- Dominio de tu frontend (para CORS)

---

## 🔧 PASO 1: PREPARAR VARIABLES DE ENTORNO

En el panel de Dokploy, cuando crees la aplicación, necesitarás configurar estas variables:

```env
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server Configuration
PORT=3001
NODE_ENV=production
API_BASE_URL=https://api.tu-dominio.com

# CORS Configuration
CORS_ORIGIN=https://tu-frontend.com
```

---

## 🐳 PASO 2: DESPLEGAR EN DOKPLOY

### 1. **Acceder al Panel de Dokploy**
```
https://tu-vps-ip:3000
```

### 2. **Crear Nueva Aplicación**
- Click en "New Application"
- Selecciona "Docker Compose"
- Nombre: `api-tesista`

### 3. **Configurar Git Repository**
- **Repository URL**: URL de tu repositorio Git
- **Branch**: `main` (o la rama que uses)
- **Build Path**: `/` (raíz del proyecto)

### 4. **Configurar Variables de Entorno**
En la sección "Environment Variables", agrega las variables del Paso 1.

### 5. **Configurar Dominio**
- **Domain**: `api.tu-dominio.com`
- **Enable SSL**: ✅ (activar Let's Encrypt)

### 6. **Deploy**
- Click en "Deploy"
- Espera a que termine el build y deployment

---

## 🌐 PASO 3: CONFIGURAR DOMINIO (SI NO LO HICISTE)

### En tu proveedor de dominio:
```
Tipo: A
Nombre: api
Valor: IP_DE_TU_VPS
TTL: 300
```

### O si usas Cloudflare:
```
Tipo: A
Nombre: api
Contenido: IP_DE_TU_VPS
Proxy: 🟠 (Proxied)
```

---

## ✅ PASO 4: VERIFICAR DEPLOYMENT

### 1. **Health Check**
```bash
curl https://api.tu-dominio.com/health
```
**Respuesta esperada:**
```json
{
  "status": "OK",
  "timestamp": "2024-...",
  "uptime": 123.45,
  "service": "API-TESISTA"
}
```

### 2. **API Principal**
```bash
curl https://api.tu-dominio.com/
```
**Respuesta esperada:**
```json
{
  "message": "API VRI Backend - Sistema de Trámites",
  "version": "1.0.0",
  "status": "running",
  "endpoints": {
    "health": "/api/health",
    "observaciones": "/api/observaciones"
  }
}
```

### 3. **Test de Observaciones** (requiere autenticación)
```bash
curl https://api.tu-dominio.com/api/observaciones/estado/48/2 \
  -H "Authorization: Bearer TU_JWT_TOKEN"
```

---

## 🔧 PASO 5: ACTUALIZAR FRONTEND

En tu proyecto **sb_start**, actualiza las variables de entorno:

```env
# sb_start/.env
VITE_THEME_SERVICE_URL=https://api.tu-dominio.com/api
VITE_THEME_SERVICE_TOKEN=
```

---

## 📊 PASO 6: MONITOREO Y LOGS

### Ver logs en Dokploy:
1. Ve a tu aplicación en el panel
2. Click en "Logs"
3. Verifica que no haya errores

### Ver métricas:
1. Click en "Metrics"
2. Monitorea CPU, RAM y tráfico

---

## 🛠️ TROUBLESHOOTING

### ❌ Error: "Connection refused"
- Verifica que el puerto 3001 esté expuesto
- Revisa los logs de Docker

### ❌ Error: "Environment variable missing"
- Verifica todas las variables de entorno en Dokploy
- Especialmente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`

### ❌ Error: "CORS policy"
- Verifica que `CORS_ORIGIN` apunte a tu frontend
- Ejemplo: `https://tu-frontend.com` (sin barra final)

### ❌ Error: "Supabase unauthorized"
- Verifica que `SUPABASE_SERVICE_ROLE_KEY` sea correcto
- Debe ser el Service Role Key, no el Anon Key

---

## 🔄 PASO 7: ACTUALIZACIONES FUTURAS

Para actualizar tu API:

1. **Push cambios a Git**:
```bash
git add .
git commit -m "Actualización API"
git push origin main
```

2. **Redeploy en Dokploy**:
- Ve a tu aplicación
- Click en "Redeploy"
- Espera a que termine

---

## 📱 PASO 8: CONFIGURAR AUTO-DEPLOY (OPCIONAL)

Para deployments automáticos cuando hagas push:

1. En Dokploy, ve a tu aplicación
2. Click en "Settings"
3. Activa "Auto Deploy"
4. Configura webhook si es necesario

---

## 🎯 COMANDOS ÚTILES

### Verificar status:
```bash
curl https://api.tu-dominio.com/health
```

### Ver logs local:
```bash
docker logs vri-api-tesista
```

### Rebuild imagen:
```bash
npm run docker:build
```

---

## 🔐 SEGURIDAD

### ✅ Configuraciones aplicadas:
- [x] Usuario no-root en container
- [x] Helmet para headers de seguridad
- [x] CORS configurado
- [x] Environment variables seguras
- [x] SSL/HTTPS activado

### 🔒 Recomendaciones adicionales:
- Cambia las keys de Supabase si sospechas compromiso
- Monitorea logs regularmente
- Mantén Dokploy actualizado

---

## 📞 SOPORTE

Si tienes problemas:

1. **Revisa logs** en Dokploy
2. **Verifica variables** de entorno
3. **Testea endpoints** con curl
4. **Revisa conectividad** Supabase

---

**¡Tu API está lista para producción!** 🚀

Recuerda actualizar la URL en tu frontend sb_start para que apunte a la nueva API en producción.