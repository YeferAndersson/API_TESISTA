import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import routes from '@/routes'

// Cargar variables de entorno
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware de seguridad
app.use(helmet())

// CORS configurado
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}))

// Logging
app.use(morgan('combined'))

// Parseo de JSON
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rutas principales
app.use('/api', routes)

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API VRI Backend - Sistema de Trámites',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      observaciones: '/api/observaciones'
    }
  })
})

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    code: 'NOT_FOUND',
    path: req.originalUrl
  })
})

// Manejo global de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error global:', err)

  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API VRI Backend ejecutándose en puerto ${PORT}`)
  console.log(`📍 URL: http://localhost:${PORT}`)
  console.log(`🌍 CORS habilitado para: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
  console.log(`�� Entorno: ${process.env.NODE_ENV || 'development'}`)
})

export default app