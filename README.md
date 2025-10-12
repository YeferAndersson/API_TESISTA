# API Tesista - VRI System

API backend separado para los servicios de tesista y observaciones del sistema VRI. Esta separación mejora la seguridad al aislar la lógica de negocio sensible.

## 🚀 Instalación y Configuración

### 1. Instalar dependencias
```bash
cd API_TESISTA
npm install
```

### 2. Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus valores reales
```

**Variables importantes a configurar:**
- `SUPABASE_URL`: URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key de Supabase (¡MUY IMPORTANTE!)
- `JWT_SECRET`: Clave secreta para JWT (cambiar en producción)
- `API_KEY`: Clave para comunicación interna (cambiar en producción)

### 3. Iniciar el servidor
```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## 📡 Endpoints Disponibles

### Autenticación
Todas las rutas requieren autenticación mediante:
- **JWT Token**: `Authorization: Bearer <token>`
- **API Key**: `x-api-key: <api-key>` (para comunicación interna)

### Rutas principales

#### Health Check
```
GET /api/health
```

#### Servicios de Tesista
```
POST /api/tesista/add
GET  /api/tesista/careers/:userId
GET  /api/tesista/check/:userId
GET  /api/tesista/career-details/:tesistaId
GET  /api/tesista/estructuras-academicas
```

#### Servicios de Observaciones
```
GET  /api/observaciones/estado/:tramiteId/:etapa
GET  /api/observaciones/all/:tramiteId/:etapaActual
GET  /api/observaciones/tipos-archivos/:etapa
POST /api/observaciones/enviar-correccion
```

## 🔧 Configuración en el proyecto principal

### 1. Variables de entorno del proyecto React
Agregar en tu `.env.local`:
```env
# Para observaciones (mantener tesista en el proyecto)
NEXT_PUBLIC_OBSERVACIONES_API_URL=http://localhost:3001/api
NEXT_PUBLIC_OBSERVACIONES_API_KEY=tu_api_key_aqui
```

### 2. Actualizar imports solo para observaciones
Cambiar las importaciones del servicio de observaciones:
```typescript
// Antes
import { getEstadoObservaciones } from '@/services/tesistaTramitesServices/ServiceObservaciones'

// Después
import { getEstadoObservaciones } from '@/services/ObservacionesApiClient'
```

**IMPORTANTE**: Los servicios de tesista (`TesistaServiceEnhanced.ts`) siguen funcionando normalmente en el proyecto original.

## 🛠️ Scripts disponibles

- `npm run dev`: Desarrollo con hot reload
- `npm run build`: Compilar TypeScript
- `npm run start`: Ejecutar en producción
- `npm run lint`: Linting con ESLint

## 🔒 Seguridad

- Usa **Service Role Key** de Supabase para operaciones del servidor
- Todas las rutas están protegidas con autenticación
- CORS configurado para el frontend
- Validación de datos con Joi
- Headers de seguridad con Helmet
- Manejo seguro de archivos con Multer

## 📁 Estructura del proyecto

```
API_TESISTA/
├── src/
│   ├── config/         # Configuración (Supabase, etc.)
│   ├── controllers/    # Controladores de rutas
│   │   ├── TesistaController.ts
│   │   └── ObservacionesController.ts
│   ├── middleware/     # Middleware (auth, validación, multer)
│   ├── routes/         # Definición de rutas
│   │   ├── tesista.ts
│   │   └── observaciones.ts
│   ├── services/       # Lógica de negocio migrada
│   │   ├── TesistaService.ts
│   │   └── ObservacionesService.ts
│   ├── types/          # Tipos TypeScript
│   │   ├── tesista.ts
│   │   └── observaciones.ts
│   └── index.ts        # Punto de entrada
├── dist/              # Código compilado
├── package.json
├── tsconfig.json
└── .env
```

## 🚀 Despliegue

### Railway/Render/Vercel
1. Hacer push del código a un repositorio
2. Conectar con la plataforma
3. Configurar variables de entorno
4. Desplegar

### Docker (opcional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

## 📝 Características de la migración de observaciones

### ✅ Funcionalidades migradas:
- `getEstadoObservaciones()` - Lógica compleja de estados por etapa
- `getAllObservacionesByTramite()` - Consultas con joins complejos
- `getTiposArchivosByEtapa()` - Configuración dinámica por etapa
- `enviarCorreccion()` - **Función crítica** con manejo de archivos
- Manejo de archivos con Multer y Supabase Storage
- Validaciones específicas para etapas 2, 3, 4, 11, 16

### 🔧 Adaptaciones realizadas:
- **Manejo de archivos**: Convertido a FormData para API REST
- **Autenticación**: Usuario obtenido desde JWT token
- **Validaciones**: Mejoradas con Joi y middleware personalizados
- **Error handling**: Centralizado y mejorado
- **Logging**: Mantenido para debugging

### 📊 Endpoints específicos:

#### GET `/api/observaciones/estado/:tramiteId/:etapa`
Obtiene el estado de observaciones para una etapa específica.

#### GET `/api/observaciones/all/:tramiteId/:etapaActual`
Obtiene todas las observaciones agrupadas por etapa hasta la etapa actual.

#### GET `/api/observaciones/tipos-archivos/:etapa?yaEnvioCorreccion=bool`
Obtiene los tipos de archivos requeridos para una etapa.

#### POST `/api/observaciones/enviar-correccion`
Envía correcciones con archivos usando FormData:
```javascript
const formData = new FormData()
formData.append('tramiteId', '123')
formData.append('etapa', '2')
formData.append('codigoProyecto', 'P25-200024')
formData.append('metadatos', JSON.stringify({...}))
formData.append('files', file1)
formData.append('files', file2)
formData.append('tipoId_file_0', '1')
formData.append('tipoId_file_1', '2')
```

## 📝 Notas importantes

- **Solo observaciones** se movieron al API separado
- **TesistaServiceEnhanced.ts** sigue en el proyecto original sin cambios
- El servicio mantiene la **misma interfaz** que el original
- Compatible con el código existente sin cambios en los componentes
- Manejo mejorado de archivos con validaciones adicionales
- Soporte para todas las etapas: 2, 3, 4, 11, 16

## 🔄 Migración en tu proyecto

### Pasos para usar el API:

1. **Configurar variables de entorno** en tu proyecto React
2. **Cambiar imports** solo en archivos que usan ServiceObservaciones
3. **Mantener** todos los imports de TesistaServiceEnhanced como están

### Ejemplo de cambio:
```typescript
// ❌ Antes (directo)
import {
  getEstadoObservaciones,
  enviarCorreccion
} from '@/services/tesistaTramitesServices/ServiceObservaciones'

// ✅ Después (via API)
import {
  getEstadoObservaciones,
  enviarCorreccion
} from '@/services/ObservacionesApiClient'

// ✅ Sin cambios (sigue igual)
import {
  addTesistaService
} from '@/services/TesistaServiceEnhanced'
```