import { Router } from 'express'
import * as ObservacionesController from '@/controllers/ObservacionesController'
import { authenticateRequest } from '@/middleware/auth'
import { upload, handleMulterError } from '@/middleware/multer'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authenticateRequest)

/**
 * GET /api/observaciones/estado/:tramiteId/:etapa
 * Obtener estado de observaciones para una etapa específica
 */
router.get('/estado/:tramiteId/:etapa', ObservacionesController.getEstadoObservaciones)

/**
 * GET /api/observaciones/all/:tramiteId/:etapaActual
 * Obtener todas las observaciones de un trámite agrupadas por etapa
 */
router.get('/all/:tramiteId/:etapaActual', ObservacionesController.getAllObservacionesByTramite)

/**
 * GET /api/observaciones/tipos-archivos/:etapa
 * Obtener tipos de archivos requeridos para una etapa
 * Query params: yaEnvioCorreccion (boolean)
 */
router.get('/tipos-archivos/:etapa', ObservacionesController.getTiposArchivosByEtapa)

/**
 * POST /api/observaciones/enviar-correccion
 * Enviar corrección con archivos y metadatos
 *
 * Formato FormData:
 * - tramiteId: number
 * - etapa: number
 * - codigoProyecto: string
 * - metadatos: JSON string con {titulo, abstract, keywords, presupuesto, conclusiones?}
 * - files: archivos (fieldname será usado para identificar el tipo)
 * - tipoId_[fieldname]: ID del tipo de archivo para cada archivo
 */
router.post(
  '/enviar-correccion',
  upload.any(), // Acepta archivos con cualquier fieldname
  handleMulterError,
  ObservacionesController.enviarCorreccion
)

/**
 * GET /api/observaciones/ya-hizo-primera-e16/:tramiteId
 * Verificar si ya hizo primera presentación E16
 */
router.get('/ya-hizo-primera-e16/:tramiteId', ObservacionesController.yaHizoPrimeraE16)

/**
 * POST /api/observaciones/completar-primera-e16
 * Completar primera presentación E16
 *
 * Formato FormData:
 * - tramiteId: number
 * - codigoProyecto: string
 * - metadatos: JSON string con {titulo, abstract, keywords, presupuesto, conclusiones}
 * - files: archivos (fieldname será usado para identificar el tipo)
 * - tipoId_[fieldname]: ID del tipo de archivo para cada archivo
 */
router.post(
  '/completar-primera-e16',
  upload.any(),
  handleMulterError,
  ObservacionesController.completarPrimeraE16
)

export default router