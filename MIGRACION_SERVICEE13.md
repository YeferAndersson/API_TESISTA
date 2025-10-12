# Guía de Implementación: Migración Completa de ServiceE13.ts

Esta guía proporciona instrucciones paso a paso para migrar completamente el servicio `ServiceE13.ts` desde el frontend hacia la API externa, manteniendo toda la funcionalidad y mejorando la arquitectura con transacciones atómicas.

## 📋 Índice

- [Contexto del Proyecto](#contexto-del-proyecto)
- [Análisis del Servicio Original](#análisis-del-servicio-original)
- [Arquitectura de Migración](#arquitectura-de-migración)
- [Implementación Backend (API)](#implementación-backend-api)
- [Implementación Frontend (Cliente)](#implementación-frontend-cliente)
- [Actualización de Componentes](#actualización-de-componentes)
- [Testing y Validación](#testing-y-validación)
- [Despliegue](#despliegue)

## 🎯 Contexto del Proyecto

### **Estado Actual**
- Proyecto VRI con frontend React + Supabase
- API externa `API_TESISTA` ya implementada con:
  - ✅ `ObservacionesService` migrado y funcionando
  - ✅ Autenticación JWT con middleware
  - ✅ Manejo de archivos con Multer + FormData
  - ✅ VPS configurado (sin limitaciones Vercel)

### **Objetivo**
Migrar completamente `ServiceE13.ts` para:
- ✅ Implementar transacciones atómicas (problema crítico actual)
- ✅ Centralizar lógica de negocio en API
- ✅ Mejorar performance y escalabilidad
- ✅ Mantener 100% compatibilidad con frontend

## 📊 Análisis del Servicio Original

### **Ubicación**: `sb_start/src/services/tesistaTramitesServices/ServiceE13.ts`

### **Estadísticas**:
- **392 líneas** de código
- **3 funciones principales** + 1 función interna
- **13 operaciones de base de datos** en función principal
- **9 tablas diferentes** involucradas
- **Manejo de archivos** con Supabase Storage

### **Funciones Principales**:
```typescript
// 1. Función simple - consulta de catálogo
export async function getTiposArchivosEtapa13(): Promise<TipoArchivo[]>

// 2. Función interna - inserción de metadatos
async function guardarMetadatosDictamenBorrador(tramiteId: number, metadatos: MetadatosDictamenBorrador): Promise<void>

// 3. Función principal - COMPLEJA (13 operaciones BD + archivos)
export async function completarEtapa13(tramiteId: number, codigoProyecto: string, data: CompletarEtapa13Data): Promise<void>

// 4. Función simple - validación de permisos
export async function puedeCompletarEtapa13(tramiteId: number): Promise<{ puede: boolean; mensaje: string }>
```

### **Problemas Actuales a Resolver**:
1. **❌ Sin transacciones**: 13 operaciones pueden fallar en el medio
2. **❌ Autenticación frontend**: `supabase.auth.getUser()`
3. **❌ Acoplamiento**: Lógica mezclada con manejo de archivos

## 🏗️ Arquitectura de Migración

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────┤
│ CompletarEtapa13.tsx                                        │
│ ↓ Mantiene misma interfaz                                   │
│                                                             │
│ ServiceE13ApiClient.ts (NUEVO - Crear)                     │
│ • Replica interfaz del ServiceE13.ts original              │
│ • Maneja FormData para archivos                            │
│ • Autenticación JWT automática                             │
└─────────────────────────────────────────────────────────────┘
                              │ HTTP Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                API_TESISTA (Node.js + VPS)                 │
├─────────────────────────────────────────────────────────────┤
│ ServiceE13Controller.ts (NUEVO - Crear)                    │
│ ↓ Maneja FormData + validación + autenticación JWT         │
│                                                             │
│ ServiceE13Service.ts (NUEVO - Crear)                       │
│ ↓ Lógica migrada + transacciones implementadas             │
│                                                             │
│ routes/servicee13.ts (NUEVO - Crear)                       │
│ ↓ Endpoints REST configurados                              │
└─────────────────────────────────────────────────────────────┘
                              │ 13 operaciones BD + Storage
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
│ ✅ PostgreSQL Database (9 tablas)                          │
│ ✅ Storage (bucket: tramites-documentos)                    │
│ ✅ Transacciones nativas soportadas                        │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Implementación Backend (API)

### **Paso 1: Crear Tipos Compartidos**

**Archivo**: `API_TESISTA/src/types/servicee13.ts`

```typescript
// Migrar interfaces desde el original
export interface MetadatosDictamenBorrador {
    id_tipo_archivo: number
    fecha_documento: string
    hora_reunion?: string | null // Solo para ID 15 (Acta)
    lugar_reunion?: string | null // Solo para ID 15 (Acta)
}

export interface TipoArchivo {
    id: number
    nombre: string
    descripcion: string | null
    obligatorio: boolean
    max_size: number
}

// Para la API (adaptado para recibir Buffers)
export interface CompletarEtapa13ApiData {
    archivos: {
        buffer: Buffer
        filename: string
        tipoId: number
        metadatos: MetadatosDictamenBorrador
    }[]
}

// Para respuestas de la API
export interface ApiResponse<T> {
    success: boolean
    message: string
    data: T
}

export interface PuedeCompletarResponse {
    puede: boolean
    mensaje: string
}
```

### **Paso 2: Implementar Servicio Backend**

**Archivo**: `API_TESISTA/src/services/ServiceE13Service.ts`

```typescript
import { supabase } from '@/config/supabase'
import type {
    TipoArchivo,
    MetadatosDictamenBorrador,
    CompletarEtapa13ApiData,
    PuedeCompletarResponse
} from '@/types/servicee13'

/**
 * Obtiene los tipos de archivos requeridos para etapa 13
 * MIGRADO: Función simple de consulta
 */
export async function getTiposArchivosEtapa13(): Promise<TipoArchivo[]> {
    try {
        // Orden del flujo: 16 (Subdirector solicita) → 14 (Presidente convoca) → 15 (Acta con decisión)
        const tiposIds = [16, 14, 15]

        const { data, error } = await supabase
            .from('dic_tipo_archivo')
            .select('*')
            .in('id', tiposIds)

        if (error) {
            console.error('Error obteniendo tipos de archivo etapa 13:', error)
            throw new Error('Error al obtener los tipos de archivo para etapa 13')
        }

        // Mapear y ordenar según el flujo del proceso
        const tiposArchivo: TipoArchivo[] = data
            .map(tipo => ({
                id: tipo.id,
                nombre: tipo.nombre,
                descripcion: tipo.descripcion,
                obligatorio: true, // Todos son obligatorios en etapa 13
                max_size: 4, // 4MB máximo
            }))
            .sort((a, b) => {
                // Ordenar según flujo: 16 → 14 → 15
                const order = [16, 14, 15]
                return order.indexOf(a.id) - order.indexOf(b.id)
            })

        console.log(`📁 Tipos de archivo para etapa 13:`, tiposArchivo.length)
        return tiposArchivo

    } catch (error) {
        console.error('❌ Error en getTiposArchivosEtapa13:', error)
        throw error
    }
}

/**
 * Verifica si el usuario puede completar la etapa 13
 * MIGRADO: Función simple de validación
 */
export async function puedeCompletarEtapa13(tramiteId: number): Promise<PuedeCompletarResponse> {
    try {
        console.log(`🔍 Verificando permisos para completar etapa 13 - Trámite ${tramiteId}`)

        // Verificar que el trámite esté en etapa 13
        const { data: tramite, error: tramiteError } = await supabase
            .from('tbl_tramites')
            .select('id_etapa, estado_tramite')
            .eq('id', tramiteId)
            .single()

        if (tramiteError || !tramite) {
            console.error('Error obteniendo trámite:', tramiteError)
            return {
                puede: false,
                mensaje: 'No se pudo verificar el estado del trámite'
            }
        }

        if (tramite.id_etapa !== 13) {
            return {
                puede: false,
                mensaje: `El trámite está en etapa ${tramite.id_etapa}, no en etapa 13`
            }
        }

        if (tramite.estado_tramite !== 1) {
            return {
                puede: false,
                mensaje: 'El trámite no está activo'
            }
        }

        console.log(`✅ Trámite ${tramiteId} puede completar etapa 13`)
        return {
            puede: true,
            mensaje: 'El trámite puede completar la etapa 13'
        }

    } catch (error) {
        console.error('❌ Error en puedeCompletarEtapa13:', error)
        return {
            puede: false,
            mensaje: 'Error interno al verificar permisos'
        }
    }
}

/**
 * Guarda metadatos específicos del dictamen borrador
 * MIGRADO: Función interna, ahora separada para mejor testing
 */
export async function guardarMetadatosDictamenBorrador(
    tramiteId: number,
    metadatos: MetadatosDictamenBorrador
): Promise<void> {
    try {
        console.log(`📝 Guardando metadatos para tipo archivo ${metadatos.id_tipo_archivo}`)

        // Desactivar metadatos anteriores del mismo tipo
        const { error: updateError } = await supabase
            .from('tabla_metadatos_dictamen_borrador')
            .update({ estado: 0 })
            .eq('id_tramite', tramiteId)
            .eq('etapa', 13)
            .eq('id_tipo_archivo', metadatos.id_tipo_archivo)
            .eq('estado', 1)

        if (updateError) {
            console.error('Error desactivando metadatos anteriores:', updateError)
            throw new Error('Error al actualizar metadatos anteriores')
        }

        // Preparar datos para inserción
        const insertData: any = {
            id_tramite: tramiteId,
            id_tipo_archivo: metadatos.id_tipo_archivo,
            etapa: 13,
            fecha_documento: metadatos.fecha_documento,
            estado: 1
        }

        // Agregar campos específicos para el Acta (ID 15)
        if (metadatos.id_tipo_archivo === 15) {
            insertData.hora_reunion = metadatos.hora_reunion
            insertData.lugar_reunion = metadatos.lugar_reunion
        }

        const { error: insertError } = await supabase
            .from('tabla_metadatos_dictamen_borrador')
            .insert([insertData])

        if (insertError) {
            console.error('Error insertando metadatos:', insertError)
            throw new Error('Error al guardar los metadatos del documento')
        }

        console.log(`✅ Metadatos guardados para tipo archivo ${metadatos.id_tipo_archivo}`)
    } catch (error) {
        console.error('❌ Error en guardarMetadatosDictamenBorrador:', error)
        throw error
    }
}

/**
 * Completa la etapa 13 con transacciones atómicas
 * MIGRADO: Función principal con mejoras críticas
 */
export async function completarEtapa13(
    tramiteId: number,
    codigoProyecto: string,
    userId: number, // Viene del middleware de autenticación
    data: CompletarEtapa13ApiData
): Promise<void> {
    try {
        console.log(`🚀 Completando etapa 13 para trámite ${tramiteId} - Usuario ${userId}`)

        // IMPORTANTE: Implementar como transacción usando stored procedure
        // Esto resuelve el problema crítico de atomicidad
        const { data: result, error: transactionError } = await supabase.rpc('completar_etapa_13_transaccional', {
            p_tramite_id: tramiteId,
            p_codigo_proyecto: codigoProyecto,
            p_user_id: userId,
            p_archivos_metadata: JSON.stringify(data.archivos.map(archivo => ({
                tipoId: archivo.tipoId,
                filename: archivo.filename,
                metadatos: archivo.metadatos
            })))
        })

        if (transactionError) {
            console.error('Error en transacción de BD:', transactionError)
            throw new Error(`Error en operaciones de base de datos: ${transactionError.message}`)
        }

        console.log('✅ Operaciones de BD completadas exitosamente')

        // 2. Procesar archivos SOLO si las operaciones BD fueron exitosas
        const archivosSubidos: string[] = []

        try {
            for (let i = 0; i < data.archivos.length; i++) {
                const archivo = data.archivos[i]
                const letraCalculada = result.letras_archivos[i] // Viene de la transacción

                // Determinar extensión
                const extension = archivo.filename.split('.').pop()?.toLowerCase()
                if (!extension) {
                    throw new Error(`No se pudo determinar la extensión del archivo: ${archivo.filename}`)
                }

                // Generar nombre del archivo: "A14-P25-200024A.pdf"
                const nombreArchivo = `${letraCalculada}${archivo.tipoId}-${codigoProyecto}.${extension}`
                const storagePath = `tramite-${tramiteId}/${nombreArchivo}`

                console.log(`📁 Subiendo archivo: ${storagePath}`)

                // Subir archivo a Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('tramites-documentos')
                    .upload(storagePath, archivo.buffer, {
                        cacheControl: '3600',
                        upsert: true,
                        contentType: getContentType(extension)
                    })

                if (uploadError) {
                    console.error('Error subiendo archivo:', uploadError)
                    throw new Error(`Error al subir el archivo ${archivo.filename}: ${uploadError.message}`)
                }

                archivosSubidos.push(storagePath)
                console.log(`✅ Archivo subido: ${nombreArchivo}`)
            }

            // Actualizar BD con rutas de archivos exitosos
            await supabase.rpc('actualizar_rutas_archivos_etapa13', {
                p_tramite_id: tramiteId,
                p_rutas_archivos: JSON.stringify(archivosSubidos)
            })

        } catch (storageError) {
            console.error('❌ Error en manejo de archivos:', storageError)

            // Limpiar archivos que se subieron antes del error
            for (const rutaArchivo of archivosSubidos) {
                try {
                    await supabase.storage.from('tramites-documentos').remove([rutaArchivo])
                    console.log(`🗑️ Archivo limpiado: ${rutaArchivo}`)
                } catch (cleanupError) {
                    console.error(`Error limpiando archivo ${rutaArchivo}:`, cleanupError)
                }
            }

            // Hacer rollback de las operaciones de BD
            await supabase.rpc('rollback_etapa_13', { p_tramite_id: tramiteId })

            throw storageError
        }

        console.log(`🎉 Etapa 13 completada exitosamente - Proyecto pasó a etapa 14`)

    } catch (error) {
        console.error('❌ Error en completarEtapa13:', error)
        throw error
    }
}

/**
 * Utilidad para determinar Content-Type basado en extensión
 */
function getContentType(extension: string): string {
    const contentTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png'
    }

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream'
}
```

### **Paso 3: Crear Stored Procedures SQL**

**Archivo**: `API_TESISTA/sql/servicee13_procedures.sql`

```sql
-- Stored Procedure para operaciones transaccionales de Etapa 13
-- Ejecutar este SQL en Supabase Dashboard > SQL Editor

CREATE OR REPLACE FUNCTION completar_etapa_13_transaccional(
    p_tramite_id INTEGER,
    p_codigo_proyecto TEXT,
    p_user_id INTEGER,
    p_archivos_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    archivo_data JSONB;
    metadatos_id INTEGER;
    letra_actual CHAR(1);
    archivos_existentes INTEGER;
    letras_resultado JSONB := '[]'::JSONB;
BEGIN
    -- Iniciar transacción implícita

    -- 1. Obtener metadatos activos para asociar archivos
    SELECT id INTO metadatos_id
    FROM tbl_tramites_metadatos
    WHERE id_tramite = p_tramite_id
      AND estado_tm = 1
    ORDER BY fecha DESC
    LIMIT 1;

    -- 2. Procesar cada archivo y sus metadatos
    FOR archivo_data IN SELECT * FROM jsonb_array_elements(p_archivos_metadata)
    LOOP
        -- 2.1 Guardar metadatos del dictamen borrador
        PERFORM guardar_metadatos_dictamen_borrador_proc(
            p_tramite_id,
            (archivo_data->>'tipoId')::INTEGER,
            archivo_data->'metadatos'
        );

        -- 2.2 Calcular letra para el archivo
        SELECT COUNT(*) INTO archivos_existentes
        FROM tbl_archivos_tramites
        WHERE id_tramite = p_tramite_id
          AND id_tipo_archivo = (archivo_data->>'tipoId')::INTEGER;

        letra_actual := CHR(65 + archivos_existentes); -- A, B, C...

        -- 2.3 Desactivar archivos anteriores del mismo tipo
        UPDATE tbl_archivos_tramites
        SET estado_archivo = 0
        WHERE id_tramite = p_tramite_id
          AND id_tipo_archivo = (archivo_data->>'tipoId')::INTEGER
          AND estado_archivo = 1;

        -- 2.4 Registrar archivo en BD (sin la ruta aún)
        INSERT INTO tbl_archivos_tramites (
            id_tramite,
            id_tipo_archivo,
            nombre_archivo,
            storage,
            bucket,
            id_etapa,
            id_tramites_metadatos,
            estado_archivo,
            max_size
        ) VALUES (
            p_tramite_id,
            (archivo_data->>'tipoId')::INTEGER,
            letra_actual || (archivo_data->>'tipoId') || '-' || p_codigo_proyecto || '.pdf', -- Temporal
            'supabase',
            'tramites-documentos',
            13,
            metadatos_id,
            1,
            4
        );

        -- Agregar letra al resultado
        letras_resultado := letras_resultado || to_jsonb(letra_actual);
    END LOOP;

    -- 3. Cambiar trámite a etapa 14
    UPDATE tbl_tramites
    SET id_etapa = 14
    WHERE id = p_tramite_id;

    -- 4. Insertar en historial
    INSERT INTO tbl_tramites_historial (
        id_tramite,
        id_etapa,
        comentario,
        estado_tramite_historial
    ) VALUES (
        p_tramite_id,
        13,
        'Etapa 13 completada - Memorandum y acta de reunión subidos, proyecto pasa a etapa 14',
        1
    );

    -- 5. Insertar en tramitesdoc
    INSERT INTO tbl_tramitesdoc (
        id_tramite,
        id_etapa,
        id_tramites_metadatos
    ) VALUES (
        p_tramite_id,
        13,
        metadatos_id
    );

    -- 6. Logs de acciones
    -- 6.1 Culminación de etapa 13
    INSERT INTO log_acciones (
        id_tramite,
        id_accion,
        id_etapa,
        id_usuario,
        mensaje
    ) VALUES (
        p_tramite_id,
        47, -- Culminación de etapa 13
        13,
        p_user_id,
        'Etapa 13 culminada exitosamente - Memorandum y acta de reunión subidos'
    );

    -- 6.2 Inicio de etapa 14
    INSERT INTO log_acciones (
        id_tramite,
        id_accion,
        id_etapa,
        id_usuario,
        mensaje
    ) VALUES (
        p_tramite_id,
        48, -- Inicio de etapa 14
        14,
        p_user_id,
        'Inicio de etapa 14 - Preparación para sustentación final'
    );

    -- Retornar letras calculadas para cada archivo
    RETURN jsonb_build_object('letras_archivos', letras_resultado);
END;
$$;

-- Función auxiliar para guardar metadatos
CREATE OR REPLACE FUNCTION guardar_metadatos_dictamen_borrador_proc(
    p_tramite_id INTEGER,
    p_tipo_archivo_id INTEGER,
    p_metadatos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Desactivar metadatos anteriores
    UPDATE tabla_metadatos_dictamen_borrador
    SET estado = 0
    WHERE id_tramite = p_tramite_id
      AND etapa = 13
      AND id_tipo_archivo = p_tipo_archivo_id
      AND estado = 1;

    -- Insertar nuevos metadatos
    INSERT INTO tabla_metadatos_dictamen_borrador (
        id_tramite,
        id_tipo_archivo,
        etapa,
        fecha_documento,
        hora_reunion,
        lugar_reunion,
        estado
    ) VALUES (
        p_tramite_id,
        p_tipo_archivo_id,
        13,
        (p_metadatos->>'fecha_documento')::DATE,
        CASE WHEN p_tipo_archivo_id = 15 THEN p_metadatos->>'hora_reunion' ELSE NULL END,
        CASE WHEN p_tipo_archivo_id = 15 THEN p_metadatos->>'lugar_reunion' ELSE NULL END,
        1
    );
END;
$$;

-- Función para rollback en caso de error
CREATE OR REPLACE FUNCTION rollback_etapa_13(p_tramite_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Revertir cambio de etapa
    UPDATE tbl_tramites SET id_etapa = 13 WHERE id = p_tramite_id;

    -- Eliminar registros creados en esta sesión
    DELETE FROM tbl_archivos_tramites
    WHERE id_tramite = p_tramite_id AND id_etapa = 13 AND fecha_registro > NOW() - INTERVAL '1 hour';

    DELETE FROM log_acciones
    WHERE id_tramite = p_tramite_id AND id_etapa IN (13, 14) AND fecha > NOW() - INTERVAL '1 hour';

    -- Nota: Los metadatos se mantienen para auditoría
END;
$$;

-- Función para actualizar rutas de archivos después de upload exitoso
CREATE OR REPLACE FUNCTION actualizar_rutas_archivos_etapa13(
    p_tramite_id INTEGER,
    p_rutas_archivos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    i INTEGER := 0;
    ruta_archivo TEXT;
BEGIN
    FOR ruta_archivo IN SELECT jsonb_array_elements_text(p_rutas_archivos)
    LOOP
        -- Actualizar la ruta del archivo correspondiente
        UPDATE tbl_archivos_tramites
        SET storage_path = ruta_archivo
        WHERE id_tramite = p_tramite_id
          AND id_etapa = 13
          AND estado_archivo = 1
        ORDER BY id DESC
        LIMIT 1 OFFSET i;

        i := i + 1;
    END LOOP;
END;
$$;
```

### **Paso 4: Crear Controlador**

**Archivo**: `API_TESISTA/src/controllers/ServiceE13Controller.ts`

```typescript
import { Response } from 'express'
import { AuthenticatedRequest } from '@/middleware/auth'
import * as ServiceE13Service from '@/services/ServiceE13Service'
import type { MetadatosDictamenBorrador } from '@/types/servicee13'

/**
 * GET /api/servicee13/tipos-archivos
 * Obtener tipos de archivos para etapa 13
 */
export const getTiposArchivosEtapa13 = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tiposArchivos = await ServiceE13Service.getTiposArchivosEtapa13()

        res.json({
            success: true,
            message: 'Tipos de archivos para etapa 13 obtenidos exitosamente',
            data: tiposArchivos
        })
    } catch (error) {
        console.error('Error en getTiposArchivosEtapa13 controller:', error)
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error interno del servidor',
            code: 'GET_TIPOS_ARCHIVOS_E13_ERROR'
        })
    }
}

/**
 * GET /api/servicee13/puede-completar/:tramiteId
 * Verificar si puede completar etapa 13
 */
export const puedeCompletarEtapa13 = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tramiteId = parseInt(req.params.tramiteId)

        if (isNaN(tramiteId)) {
            return res.status(400).json({
                success: false,
                error: 'ID de trámite debe ser un número válido',
                code: 'INVALID_TRAMITE_ID'
            })
        }

        const resultado = await ServiceE13Service.puedeCompletarEtapa13(tramiteId)

        res.json({
            success: true,
            message: 'Verificación de permisos completada',
            data: resultado
        })
    } catch (error) {
        console.error('Error en puedeCompletarEtapa13 controller:', error)
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error interno del servidor',
            code: 'PUEDE_COMPLETAR_E13_ERROR'
        })
    }
}

/**
 * POST /api/servicee13/completar
 * Completar etapa 13 con archivos y metadatos
 */
export const completarEtapa13 = async (req: AuthenticatedRequest, res: Response) => {
    try {
        // Obtener datos del formulario
        const { tramiteId, codigoProyecto } = req.body

        // Validar parámetros requeridos
        if (!tramiteId || !codigoProyecto) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros requeridos: tramiteId, codigoProyecto',
                code: 'MISSING_PARAMETERS'
            })
        }

        // Validar tipos
        const numericTramiteId = parseInt(tramiteId)
        if (isNaN(numericTramiteId)) {
            return res.status(400).json({
                success: false,
                error: 'tramiteId debe ser un número válido',
                code: 'INVALID_TRAMITE_ID'
            })
        }

        // Obtener usuario desde el token JWT
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado',
                code: 'USER_NOT_AUTHENTICATED'
            })
        }

        // Procesar archivos y metadatos
        const archivos: { buffer: Buffer; filename: string; tipoId: number; metadatos: MetadatosDictamenBorrador }[] = []

        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren archivos para completar la etapa 13',
                code: 'NO_FILES_PROVIDED'
            })
        }

        for (const file of req.files) {
            // El tipo de archivo debe venir en el campo 'tipoId' del FormData
            const tipoIdField = `tipoId_${file.fieldname}`
            const metadatosField = `metadatos_${file.fieldname}`

            const tipoId = req.body[tipoIdField]
            const metadatosString = req.body[metadatosField]

            if (!tipoId) {
                return res.status(400).json({
                    success: false,
                    error: `Falta tipoId para el archivo ${file.originalname}`,
                    code: 'MISSING_TIPO_ID'
                })
            }

            if (!metadatosString) {
                return res.status(400).json({
                    success: false,
                    error: `Faltan metadatos para el archivo ${file.originalname}`,
                    code: 'MISSING_METADATA'
                })
            }

            // Parsear metadatos
            let metadatos: MetadatosDictamenBorrador
            try {
                metadatos = JSON.parse(metadatosString)
            } catch (parseError) {
                return res.status(400).json({
                    success: false,
                    error: `Metadatos no válidos para el archivo ${file.originalname}`,
                    code: 'INVALID_METADATA_FORMAT'
                })
            }

            // Validar metadatos requeridos
            if (!metadatos.fecha_documento || !metadatos.id_tipo_archivo) {
                return res.status(400).json({
                    success: false,
                    error: `Metadatos incompletos para el archivo ${file.originalname}`,
                    code: 'INCOMPLETE_METADATA'
                })
            }

            archivos.push({
                buffer: file.buffer,
                filename: file.originalname,
                tipoId: parseInt(tipoId),
                metadatos: metadatos
            })
        }

        // Validar que se tengan los 3 archivos requeridos (IDs: 16, 14, 15)
        const tiposRequeridos = [16, 14, 15]
        const tiposRecibidos = archivos.map(a => a.tipoId)

        for (const tipoRequerido of tiposRequeridos) {
            if (!tiposRecibidos.includes(tipoRequerido)) {
                return res.status(400).json({
                    success: false,
                    error: `Falta archivo obligatorio con tipo ID ${tipoRequerido}`,
                    code: 'MISSING_REQUIRED_FILE'
                })
            }
        }

        // Ejecutar completar etapa 13
        await ServiceE13Service.completarEtapa13(
            numericTramiteId,
            codigoProyecto,
            userId,
            { archivos }
        )

        res.status(201).json({
            success: true,
            message: 'Etapa 13 completada exitosamente - Proyecto pasó a etapa 14',
            data: {
                tramiteId: numericTramiteId,
                etapaNueva: 14,
                archivosSubidos: archivos.length
            }
        })

    } catch (error) {
        console.error('Error en completarEtapa13 controller:', error)
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Error interno del servidor',
            code: 'COMPLETAR_ETAPA13_ERROR'
        })
    }
}
```

### **Paso 5: Configurar Rutas**

**Archivo**: `API_TESISTA/src/routes/servicee13.ts`

```typescript
import { Router } from 'express'
import * as ServiceE13Controller from '@/controllers/ServiceE13Controller'
import { authenticateRequest } from '@/middleware/auth'
import { upload, handleMulterError } from '@/middleware/multer'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authenticateRequest)

/**
 * GET /api/servicee13/tipos-archivos
 * Obtener tipos de archivos requeridos para etapa 13
 */
router.get('/tipos-archivos', ServiceE13Controller.getTiposArchivosEtapa13)

/**
 * GET /api/servicee13/puede-completar/:tramiteId
 * Verificar si el trámite puede completar la etapa 13
 */
router.get('/puede-completar/:tramiteId', ServiceE13Controller.puedeCompletarEtapa13)

/**
 * POST /api/servicee13/completar
 * Completar etapa 13 con archivos y metadatos
 * Requiere: tramiteId, codigoProyecto + archivos con metadatos
 */
router.post('/completar',
    upload.any(), // Acepta múltiples archivos
    handleMulterError,
    ServiceE13Controller.completarEtapa13
)

export default router
```

### **Paso 6: Registrar Rutas en App Principal**

**Archivo**: `API_TESISTA/src/routes/index.ts`

```typescript
import { Router } from 'express'
import observacionesRoutes from './observaciones'
import servicee13Routes from './servicee13' // NUEVO

const router = Router()

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API VRI Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// Rutas principales
router.use('/observaciones', observacionesRoutes)
router.use('/servicee13', servicee13Routes) // NUEVO

export default router
```

**Actualizar también**: `API_TESISTA/src/index.ts`

```typescript
// En el objeto de endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'API VRI Backend - Sistema de Trámites',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      observaciones: '/api/observaciones',
      servicee13: '/api/servicee13' // NUEVO
    }
  })
})
```

## 🎨 Implementación Frontend (Cliente)

### **Paso 7: Crear Cliente API**

**Archivo**: `sb_start/src/services/ServiceE13ApiClient.ts`

```typescript
// Cliente API para ServiceE13 - Replica interfaz original exactamente

// Importar interfaces originales
export interface MetadatosDictamenBorrador {
    id_tipo_archivo: number
    fecha_documento: string
    hora_reunion?: string | null
    lugar_reunion?: string | null
}

export interface CompletarEtapa13Data {
    archivos: {
        file: File
        tipoId: number
        metadatos: MetadatosDictamenBorrador
    }[]
}

export interface TipoArchivo {
    id: number
    nombre: string
    descripcion: string | null
    obligatorio: boolean
    max_size: number
}

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_SERVICEE13_API_URL || 'http://localhost:3001/api'

// Interfaces para respuestas de la API
interface ApiResponse<T> {
    success: boolean
    message: string
    data: T
}

/**
 * Cliente para hacer llamadas a la API de ServiceE13
 */
class ServiceE13ApiClient {
    private baseUrl: string

    constructor() {
        this.baseUrl = API_BASE_URL
    }

    /**
     * Hacer petición HTTP genérica con autenticación JWT
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

        // Solo agregar Content-Type para requests que no sean FormData
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
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
            }

            return await response.json()
        } catch (error) {
            console.error(`Error en petición a ${endpoint}:`, error)
            throw error
        }
    }

    /**
     * Obtener token de autenticación desde Supabase
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
     * Obtener tipos de archivos para etapa 13
     */
    async getTiposArchivosEtapa13(): Promise<TipoArchivo[]> {
        const response = await this.makeRequest<TipoArchivo[]>('/servicee13/tipos-archivos')

        if (!response.success) {
            throw new Error('Error al obtener tipos de archivos para etapa 13')
        }

        return response.data
    }

    /**
     * Verificar si puede completar etapa 13
     */
    async puedeCompletarEtapa13(tramiteId: number): Promise<{ puede: boolean; mensaje: string }> {
        const response = await this.makeRequest<{ puede: boolean; mensaje: string }>(`/servicee13/puede-completar/${tramiteId}`)

        if (!response.success) {
            throw new Error('Error al verificar permisos para etapa 13')
        }

        return response.data
    }

    /**
     * Completar etapa 13 con archivos y metadatos
     */
    async completarEtapa13(
        tramiteId: number,
        codigoProyecto: string,
        data: CompletarEtapa13Data
    ): Promise<void> {
        // Crear FormData para enviar archivos y metadatos
        const formData = new FormData()

        // Agregar parámetros básicos
        formData.append('tramiteId', tramiteId.toString())
        formData.append('codigoProyecto', codigoProyecto)

        // Agregar archivos y sus metadatos
        data.archivos.forEach((archivo, index) => {
            const fieldName = `file_${index}`
            formData.append(fieldName, archivo.file, archivo.file.name)
            formData.append(`tipoId_${fieldName}`, archivo.tipoId.toString())
            formData.append(`metadatos_${fieldName}`, JSON.stringify(archivo.metadatos))
        })

        const response = await this.makeRequest<any>('/servicee13/completar', {
            method: 'POST',
            body: formData // Sin Content-Type, se establece automáticamente
        })

        if (!response.success) {
            throw new Error('Error al completar etapa 13')
        }
    }
}

// Instancia singleton del cliente
const serviceE13ApiClient = new ServiceE13ApiClient()

// Exportar funciones con la misma interfaz que el servicio original
export async function getTiposArchivosEtapa13(): Promise<TipoArchivo[]> {
    return serviceE13ApiClient.getTiposArchivosEtapa13()
}

export async function puedeCompletarEtapa13(tramiteId: number): Promise<{ puede: boolean; mensaje: string }> {
    return serviceE13ApiClient.puedeCompletarEtapa13(tramiteId)
}

export async function completarEtapa13(
    tramiteId: number,
    codigoProyecto: string,
    data: CompletarEtapa13Data
): Promise<void> {
    return serviceE13ApiClient.completarEtapa13(tramiteId, codigoProyecto, data)
}

export default serviceE13ApiClient
```

## 🔄 Actualización de Componentes

### **Paso 8: Actualizar Imports en Componentes**

**Ubicación**: Buscar archivos que importan ServiceE13 original

```bash
# Buscar componentes que usan ServiceE13
grep -r "from.*ServiceE13" sb_start/src/
```

**Archivos a actualizar típicamente**:
- `sb_start/src/views/ServicePages/TesistaService/Etapa13/CompletarEtapa13.tsx`
- Cualquier otro componente que importe ServiceE13

**Cambio requerido**:
```typescript
// ❌ ANTES
import { getTiposArchivosEtapa13, completarEtapa13, puedeCompletarEtapa13 } from '@/services/tesistaTramitesServices/ServiceE13'

// ✅ DESPUÉS
import { getTiposArchivosEtapa13, completarEtapa13, puedeCompletarEtapa13 } from '@/services/ServiceE13ApiClient'
```

### **Paso 9: Configurar Variables de Entorno**

**Archivo**: `sb_start/.env.local`

```bash
# API ServiceE13
VITE_SERVICEE13_API_URL=http://localhost:3001/api
# En producción: VITE_SERVICEE13_API_URL=https://tu-vps-domain.com/api
```

## 🧪 Testing y Validación

### **Paso 10: Testing Backend**

**Archivo**: `API_TESISTA/test_servicee13.http` (para REST Client)

```http
### 1. Health Check
GET http://localhost:3001/api/health

### 2. Login y obtener token (configurar según tu método)
# Obtener JWT token de tu método de autenticación

### 3. Obtener tipos de archivos
GET http://localhost:3001/api/servicee13/tipos-archivos
Authorization: Bearer {{jwt_token}}

### 4. Verificar permisos
GET http://localhost:3001/api/servicee13/puede-completar/123
Authorization: Bearer {{jwt_token}}

### 5. Completar etapa 13 (usar Postman para FormData con archivos)
POST http://localhost:3001/api/servicee13/completar
Authorization: Bearer {{jwt_token}}
Content-Type: multipart/form-data

# En Postman:
# - tramiteId: 123
# - codigoProyecto: P25-200024A
# - file_0: [archivo.pdf]
# - tipoId_file_0: 16
# - metadatos_file_0: {"id_tipo_archivo": 16, "fecha_documento": "2024-01-15"}
```

### **Paso 11: Testing Frontend**

**Verificaciones en el navegador**:

1. **Console logs**: No debe haber errores de importación
2. **Network**: Verificar que las llamadas van a la API externa
3. **Funcionalidad**: Que el flujo completo funcione igual que antes
4. **Autenticación**: Que el JWT se envíe correctamente

## 🚀 Despliegue

### **Paso 12: Preparar para Producción**

**Variables de entorno de producción**:

```bash
# API_TESISTA/.env (producción)
CORS_ORIGIN=https://tu-frontend-domain.com
NODE_ENV=production

# sb_start/.env.local (producción)
VITE_SERVICEE13_API_URL=https://tu-vps-domain.com/api
```

### **Paso 13: Monitoreo y Logs**

**Puntos de monitoreo críticos**:
1. **Transacciones BD**: Verificar que no haya rollbacks inesperados
2. **Storage**: Verificar que archivos se suban correctamente
3. **Performance**: Tiempo de respuesta de `completarEtapa13`
4. **Errores**: Logs de errores en producción

## ✅ Checklist de Implementación

### **Backend (API)**
- [ ] Crear `src/types/servicee13.ts`
- [ ] Crear `src/services/ServiceE13Service.ts`
- [ ] Ejecutar stored procedures SQL en Supabase
- [ ] Crear `src/controllers/ServiceE13Controller.ts`
- [ ] Crear `src/routes/servicee13.ts`
- [ ] Registrar rutas en `src/routes/index.ts`
- [ ] Actualizar endpoints en `src/index.ts`

### **Frontend**
- [ ] Crear `src/services/ServiceE13ApiClient.ts`
- [ ] Actualizar imports en componentes existentes
- [ ] Configurar variables de entorno
- [ ] Testing en desarrollo

### **Testing**
- [ ] Probar funciones simples (getTiposArchivos, puedeCompletar)
- [ ] Probar función compleja (completarEtapa13)
- [ ] Verificar transacciones (que rollback funcione)
- [ ] Probar con archivos reales
- [ ] Testing end-to-end completo

### **Producción**
- [ ] Deploy en VPS
- [ ] Configurar variables de entorno de producción
- [ ] Testing en ambiente productivo
- [ ] Monitoreo y logs configurados

---

## 🎯 Resultado Esperado

Al completar esta migración tendrás:

✅ **ServiceE13 completamente migrado** con transacciones atómicas
✅ **Zero downtime** - Frontend funciona idénticamente
✅ **Mejor rendimiento** - Operaciones optimizadas en API
✅ **Mayor escalabilidad** - API puede manejar más usuarios
✅ **Código mantenible** - Lógica centralizada y versionada

**La migración resuelve el problema crítico de transacciones y prepara el sistema para un mayor crecimiento.** 🚀