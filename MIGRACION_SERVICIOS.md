# Guía de Migración de Servicios al API

Esta guía explica cómo migrar servicios desde el frontend (`src/services`) al API backend para mejorar la seguridad y separación de responsabilidades.

## 📋 Índice

- [Preparación](#preparación)
- [1. Análisis del Servicio](#1-análisis-del-servicio)
- [2. Migración del Servicio](#2-migración-del-servicio)
- [3. Creación del Controlador](#3-creación-del-controlador)
- [4. Configuración de Rutas](#4-configuración-de-rutas)
- [5. Cliente API](#5-cliente-api)
- [6. Actualización de Imports](#6-actualización-de-imports)
- [7. Pruebas](#7-pruebas)
- [Casos Especiales](#casos-especiales)

## Preparación

### Servicios Candidatos para Migración

**✅ MIGRAR** (Lógica sensible):
- Operaciones de base de datos complejas
- Validaciones de negocio críticas
- Operaciones con archivos/storage
- Cálculos sensibles
- Logs de auditoría

**❌ NO MIGRAR** (Lógica de UI):
- Validaciones de formularios simples
- Formateo de datos para UI
- Manejo de estado local
- Utilidades de frontend

### Servicios Ya Migrados
- ✅ `ServiceObservaciones.ts` → API `/observaciones`

## 1. Análisis del Servicio

### 1.1 Identificar Funciones Públicas

Revisa el servicio y lista todas las funciones exportadas:

```typescript
// Ejemplo: ServiceEjemplo.ts
export async function funcionA(param1: string): Promise<ResultadoA> { ... }
export async function funcionB(param1: number, param2: Data): Promise<void> { ... }
```

### 1.2 Identificar Dependencias

- Imports de Supabase ✅ (mantener)
- Imports de otros servicios ⚠️ (evaluar)
- Imports de utilidades 🔄 (mover si es necesario)

### 1.3 Identificar Tipos/Interfaces

Separa interfaces que deben ser compartidas entre frontend y API.

## 2. Migración del Servicio

### 2.1 Crear Servicio en API

**Ubicación**: `src/services/[NombreServicio].ts`

```typescript
// src/services/TramiteService.ts
import { supabase } from '@/config/supabase'

export interface TramiteData {
  id: number
  nombre: string
  // ... otros campos
}

export async function obtenerTramite(id: number): Promise<TramiteData> {
  const { data, error } = await supabase
    .from('tbl_tramites')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function crearTramite(
  tramiteData: Omit<TramiteData, 'id'>,
  userId: number
): Promise<TramiteData> {
  // Lógica del servicio...
}
```

### 2.2 Adaptaciones Necesarias

#### Autenticación
```typescript
// ❌ Frontend (antes)
const { data: userData } = await supabase.auth.getUser()

// ✅ API (después)
// El usuario viene desde req.user (middleware de auth)
export async function funcionConAuth(userId: number) {
  // usar userId directamente
}
```

#### Manejo de Archivos
```typescript
// ❌ Frontend (antes)
function procesarArchivo(file: File) { ... }

// ✅ API (después)
function procesarArchivo(archivo: { buffer: Buffer; filename: string }) { ... }
```

## 3. Creación del Controlador

### 3.1 Estructura del Controlador

**Ubicación**: `src/controllers/[Nombre]Controller.ts`

```typescript
// src/controllers/TramiteController.ts
import { Request, Response } from 'express'
import { AuthenticatedRequest } from '@/middleware/auth'
import * as TramiteService from '@/services/TramiteService'

/**
 * GET /api/tramites/:id
 * Obtener trámite por ID
 */
export const obtenerTramite = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tramiteId = parseInt(id)

    if (isNaN(tramiteId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de trámite inválido',
        code: 'INVALID_TRAMITE_ID'
      })
    }

    const tramite = await TramiteService.obtenerTramite(tramiteId)

    res.json({
      success: true,
      message: 'Trámite obtenido exitosamente',
      data: tramite
    })
  } catch (error) {
    console.error('Error en obtenerTramite:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno',
      code: 'OBTENER_TRAMITE_ERROR'
    })
  }
}

/**
 * POST /api/tramites
 * Crear nuevo trámite
 */
export const crearTramite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        code: 'USER_NOT_AUTHENTICATED'
      })
    }

    const tramiteData = req.body
    // Validaciones...

    const nuevoTramite = await TramiteService.crearTramite(tramiteData, userId)

    res.status(201).json({
      success: true,
      message: 'Trámite creado exitosamente',
      data: nuevoTramite
    })
  } catch (error) {
    console.error('Error en crearTramite:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno',
      code: 'CREAR_TRAMITE_ERROR'
    })
  }
}
```

### 3.2 Patrones de Respuesta

**Respuesta Exitosa**:
```typescript
res.json({
  success: true,
  message: 'Descripción de la operación',
  data: resultado
})
```

**Respuesta de Error**:
```typescript
res.status(400).json({
  success: false,
  error: 'Descripción del error',
  code: 'ERROR_CODE'
})
```

## 4. Configuración de Rutas

### 4.1 Crear Archivo de Rutas

**Ubicación**: `src/routes/[nombre].ts`

```typescript
// src/routes/tramites.ts
import { Router } from 'express'
import * as TramiteController from '@/controllers/TramiteController'
import { authenticateRequest } from '@/middleware/auth'

const router = Router()

// Autenticación requerida para todas las rutas
router.use(authenticateRequest)

/**
 * GET /api/tramites/:id
 * Obtener trámite por ID
 */
router.get('/:id', TramiteController.obtenerTramite)

/**
 * POST /api/tramites
 * Crear nuevo trámite
 */
router.post('/', TramiteController.crearTramite)

/**
 * PUT /api/tramites/:id
 * Actualizar trámite
 */
router.put('/:id', TramiteController.actualizarTramite)

export default router
```

### 4.2 Registrar Rutas en App Principal

**Archivo**: `src/index.ts`

```typescript
// Importar rutas
import tramitesRoutes from '@/routes/tramites'

// Registrar rutas
app.use('/api/tramites', tramitesRoutes)
```

## 5. Cliente API

### 5.1 Crear Cliente API

**Ubicación en Frontend**: `src/services/[Nombre]ApiClient.ts`

```typescript
// src/services/TramiteApiClient.ts

// Copiar interfaces del servicio original
export interface TramiteData {
  id: number
  nombre: string
  // ... campos
}

// Configuración
const API_BASE_URL = import.meta.env.VITE_TRAMITES_API_URL || 'http://localhost:3001/api'

class TramiteApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL
  }

  /**
   * Método genérico para hacer peticiones
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    const defaultHeaders: HeadersInit = {}

    // Obtener token JWT de Supabase
    const token = await this.getAuthToken()
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`
    } else {
      throw new Error('Usuario no autenticado')
    }

    // Content-Type para requests que no sean FormData
    if (options.body && !(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json'
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Error en petición a ${endpoint}:`, error)
      throw error
    }
  }

  /**
   * Obtener token de Supabase
   */
  private async getAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null

    const { supabase } = await import('@/lib/supabase')

    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        console.warn('No hay sesión activa en Supabase')
        return null
      }

      return session.access_token
    } catch (error) {
      console.error('Error obteniendo token de Supabase:', error)
      return null
    }
  }

  /**
   * Obtener trámite por ID
   */
  async obtenerTramite(id: number): Promise<TramiteData> {
    const response = await this.makeRequest<TramiteData>(`/tramites/${id}`)

    if (!response.success) {
      throw new Error('Error al obtener trámite')
    }

    return response.data
  }

  /**
   * Crear nuevo trámite
   */
  async crearTramite(tramiteData: Omit<TramiteData, 'id'>): Promise<TramiteData> {
    const response = await this.makeRequest<TramiteData>('/tramites', {
      method: 'POST',
      body: JSON.stringify(tramiteData)
    })

    if (!response.success) {
      throw new Error('Error al crear trámite')
    }

    return response.data
  }
}

// Instancia singleton
const tramiteApiClient = new TramiteApiClient()

// Exportar funciones con la misma interfaz que el servicio original
export async function obtenerTramite(id: number): Promise<TramiteData> {
  return tramiteApiClient.obtenerTramite(id)
}

export async function crearTramite(tramiteData: Omit<TramiteData, 'id'>): Promise<TramiteData> {
  return tramiteApiClient.crearTramite(tramiteData)
}

export default tramiteApiClient
```

### 5.2 Interfaces Compartidas

```typescript
// Tipos para respuestas de API
interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}
```

## 6. Actualización de Imports

### 6.1 Buscar y Reemplazar

```bash
# Buscar archivos que usan el servicio original
grep -r "from.*TramiteService" src/
```

### 6.2 Actualizar Imports

```typescript
// ❌ Antes
import { obtenerTramite, crearTramite } from '@/services/TramiteService'

// ✅ Después
import { obtenerTramite, crearTramite } from '@/services/TramiteApiClient'
```

### 6.3 Variables de Entorno

**Archivo**: `.env`

```bash
VITE_TRAMITES_API_URL=http://localhost:3001/api
```

## 7. Pruebas

### 7.1 Pruebas de API

```bash
# Probar endpoint con curl
curl -X GET "http://localhost:3001/api/tramites/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7.2 Verificación Frontend

1. Verificar que no hay errores de consola
2. Probar flujos completos
3. Verificar autenticación
4. Verificar manejo de errores

## Casos Especiales

### Servicios con Archivos

Para servicios que manejan archivos (como `ServiceObservaciones`):

1. **Multer en rutas**:
```typescript
import { upload, handleMulterError } from '@/middleware/multer'

router.post('/upload',
  upload.any(),
  handleMulterError,
  Controller.uploadFunction
)
```

2. **FormData en cliente**:
```typescript
const formData = new FormData()
formData.append('file_0', archivo.file, archivo.file.name)
formData.append('tipoId_file_0', archivo.tipoId.toString())

const response = await this.makeRequest('/upload', {
  method: 'POST',
  body: formData // Sin Content-Type, se establece automáticamente
})
```

### Servicios con Validaciones Complejas

Para servicios con validaciones usando Joi u otras librerías:

```typescript
// src/middleware/validation.ts
import Joi from 'joi'

export const validateTramite = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    nombre: Joi.string().required(),
    descripcion: Joi.string().optional()
  })

  const { error } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message,
      code: 'VALIDATION_ERROR'
    })
  }

  next()
}
```

## 📝 Checklist de Migración

- [ ] Análisis del servicio original
- [ ] Creación del servicio en API
- [ ] Creación del controlador
- [ ] Configuración de rutas
- [ ] Registro de rutas en app principal
- [ ] Creación del cliente API en frontend
- [ ] Actualización de imports en frontend
- [ ] Configuración de variables de entorno
- [ ] Pruebas de API endpoints
- [ ] Pruebas de integración frontend
- [ ] Verificación de autenticación
- [ ] Verificación de manejo de errores

## 🚀 Servicios Sugeridos para Próximas Migraciones

**Prioridad Alta**:
- `TramiteService.ts` - Operaciones críticas de trámites
- `ServiceE6.ts` - Lógica de etapa 6
- `ServiceE12.ts` - Lógica de etapa 12

**Prioridad Media**:
- Servicios de validación de documentos
- Servicios de notificaciones
- Servicios de reportes

**Considerar No Migrar**:
- Utilidades de formateo de UI
- Helpers de validación de formularios
- Servicios puramente de frontend