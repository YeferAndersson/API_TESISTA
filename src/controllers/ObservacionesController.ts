import { Response } from 'express'
import { AuthenticatedRequest } from '@/middleware/auth'
import * as ObservacionesService from '@/services/ObservacionesService'

/**
 * Obtener estado de observaciones para una etapa específica
 */
export const getEstadoObservaciones = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tramiteId = parseInt(req.params.tramiteId)
    const etapa = parseInt(req.params.etapa)

    if (isNaN(tramiteId) || isNaN(etapa)) {
      return res.status(400).json({
        success: false,
        error: 'ID de trámite y etapa deben ser números válidos',
        code: 'INVALID_PARAMETERS'
      })
    }

    const estado = await ObservacionesService.getEstadoObservaciones(tramiteId, etapa)

    res.json({
      success: true,
      message: 'Estado de observaciones obtenido exitosamente',
      data: estado
    })
  } catch (error) {
    console.error('Error en getEstadoObservaciones controller:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      code: 'GET_ESTADO_ERROR'
    })
  }
}

/**
 * Obtener todas las observaciones de un trámite agrupadas por etapa
 */
export const getAllObservacionesByTramite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tramiteId = parseInt(req.params.tramiteId)
    const etapaActual = parseInt(req.params.etapaActual)

    if (isNaN(tramiteId) || isNaN(etapaActual)) {
      return res.status(400).json({
        success: false,
        error: 'ID de trámite y etapa actual deben ser números válidos',
        code: 'INVALID_PARAMETERS'
      })
    }

    const observaciones = await ObservacionesService.getAllObservacionesByTramite(tramiteId, etapaActual)

    res.json({
      success: true,
      message: 'Observaciones obtenidas exitosamente',
      data: observaciones
    })
  } catch (error) {
    console.error('Error en getAllObservacionesByTramite controller:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      code: 'GET_ALL_OBSERVACIONES_ERROR'
    })
  }
}

/**
 * Obtener tipos de archivos requeridos para una etapa
 */
export const getTiposArchivosByEtapa = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const etapa = parseInt(req.params.etapa)
    const yaEnvioCorreccion = req.query.yaEnvioCorreccion === 'true'

    if (isNaN(etapa)) {
      return res.status(400).json({
        success: false,
        error: 'Etapa debe ser un número válido',
        code: 'INVALID_ETAPA'
      })
    }

    const tiposArchivos = await ObservacionesService.getTiposArchivosByEtapa(etapa, yaEnvioCorreccion)

    res.json({
      success: true,
      message: 'Tipos de archivos obtenidos exitosamente',
      data: tiposArchivos
    })
  } catch (error) {
    console.error('Error en getTiposArchivosByEtapa controller:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      code: 'GET_TIPOS_ARCHIVOS_ERROR'
    })
  }
}

/**
 * Enviar corrección con archivos y metadatos
 */
export const enviarCorreccion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Obtener datos del formulario
    const { tramiteId, etapa, codigoProyecto, metadatos } = req.body

    // Validar parámetros requeridos
    if (!tramiteId || !etapa || !codigoProyecto || !metadatos) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos: tramiteId, etapa, codigoProyecto, metadatos',
        code: 'MISSING_PARAMETERS'
      })
    }

    // Validar tipos
    const numericTramiteId = parseInt(tramiteId)
    const numericEtapa = parseInt(etapa)

    if (isNaN(numericTramiteId) || isNaN(numericEtapa)) {
      return res.status(400).json({
        success: false,
        error: 'tramiteId y etapa deben ser números válidos',
        code: 'INVALID_TYPES'
      })
    }


    // Parsear metadatos si vienen como string
    let parsedMetadatos
    try {
      parsedMetadatos = typeof metadatos === 'string' ? JSON.parse(metadatos) : metadatos
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Metadatos no tienen formato JSON válido',
        code: 'INVALID_METADATA_FORMAT'
      })
    }

    // Validar metadatos requeridos
    const { titulo, abstract, keywords, presupuesto } = parsedMetadatos
    if (!titulo || !abstract || !keywords || presupuesto === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Metadatos incompletos: se requieren titulo, abstract, keywords, presupuesto',
        code: 'INCOMPLETE_METADATA'
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

    // Procesar metadatosE13 si vienen (para etapa 14)
    let parsedMetadatosE13
    if (req.body.metadatosE13) {
      try {
        parsedMetadatosE13 = typeof req.body.metadatosE13 === 'string'
          ? JSON.parse(req.body.metadatosE13)
          : req.body.metadatosE13
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'metadatosE13 no tiene formato JSON válido',
          code: 'INVALID_METADATOS_E13_FORMAT'
        })
      }
    }

    // Procesar archivos si existen
    const archivos: { buffer: Buffer; filename: string; tipoId: number }[] = []

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        // El tipo de archivo debe venir en el campo 'tipoId' del FormData
        const tipoIdField = `tipoId_${file.fieldname}`
        const tipoId = req.body[tipoIdField]

        if (!tipoId) {
          return res.status(400).json({
            success: false,
            error: `Falta tipoId para el archivo ${file.originalname}`,
            code: 'MISSING_TIPO_ID'
          })
        }

        archivos.push({
          buffer: file.buffer,
          filename: file.originalname,
          tipoId: parseInt(tipoId)
        })
      }
    }

    // Ejecutar la corrección
    await ObservacionesService.enviarCorreccion(
      numericTramiteId,
      numericEtapa,
      codigoProyecto,
      userId,
      {
        metadatos: parsedMetadatos,
        archivos,
        ...(parsedMetadatosE13 && { metadatosE13: parsedMetadatosE13 })
      }
    )

    res.status(201).json({
      success: true,
      message: 'Corrección enviada exitosamente',
      data: {
        tramiteId: numericTramiteId,
        etapa: numericEtapa,
        archivosSubidos: archivos.length
      }
    })
  } catch (error) {
    console.error('Error en enviarCorreccion controller:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      code: 'ENVIAR_CORRECCION_ERROR'
    })
  }
}

/**
 * Verificar si ya hizo primera presentación E16
 */
export const yaHizoPrimeraE16 = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tramiteId = parseInt(req.params.tramiteId)

    if (isNaN(tramiteId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de trámite debe ser un número válido',
        code: 'INVALID_TRAMITE_ID'
      })
    }

    const yaHizo = await ObservacionesService.yaHizoPrimeraE16(tramiteId)

    res.json({
      success: true,
      message: 'Verificación completada',
      data: { yaHizoPrimeraE16: yaHizo }
    })
  } catch (error) {
    console.error('Error en yaHizoPrimeraE16 controller:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      code: 'YA_HIZO_PRIMERA_E16_ERROR'
    })
  }
}

/**
 * Completar primera presentación E16
 */
export const completarPrimeraE16 = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tramiteId, codigoProyecto, metadatos } = req.body

    if (!tramiteId || !codigoProyecto || !metadatos) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos: tramiteId, codigoProyecto, metadatos',
        code: 'MISSING_PARAMETERS'
      })
    }

    const numericTramiteId = parseInt(tramiteId)
    if (isNaN(numericTramiteId)) {
      return res.status(400).json({
        success: false,
        error: 'tramiteId debe ser un número válido',
        code: 'INVALID_TRAMITE_ID'
      })
    }

    const parsedMetadatos = typeof metadatos === 'string' ? JSON.parse(metadatos) : metadatos
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        code: 'USER_NOT_AUTHENTICATED'
      })
    }

    const archivos: { buffer: Buffer; filename: string; tipoId: number }[] = []

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const tipoIdField = `tipoId_${file.fieldname}`
        const tipoId = req.body[tipoIdField]

        if (!tipoId) {
          return res.status(400).json({
            success: false,
            error: `Falta tipoId para el archivo ${file.originalname}`,
            code: 'MISSING_TIPO_ID'
          })
        }

        archivos.push({
          buffer: file.buffer,
          filename: file.originalname,
          tipoId: parseInt(tipoId)
        })
      }
    }

    await ObservacionesService.completarPrimeraE16(
      numericTramiteId,
      codigoProyecto,
      userId,
      {
        metadatos: parsedMetadatos,
        archivos
      }
    )

    res.status(201).json({
      success: true,
      message: 'Primera presentación E16 completada exitosamente',
      data: {
        tramiteId: numericTramiteId,
        archivosSubidos: archivos.length
      }
    })
  } catch (error) {
    console.error('Error en completarPrimeraE16 controller:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      code: 'COMPLETAR_PRIMERA_E16_ERROR'
    })
  }
}