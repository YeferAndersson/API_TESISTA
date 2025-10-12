import { Router } from 'express'
import observacionesRoutes from './observaciones'

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

export default router