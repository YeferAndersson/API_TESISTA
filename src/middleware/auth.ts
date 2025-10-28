import { Request, Response, NextFunction } from 'express'
import { supabase, supabaseAdmin } from '@/config/supabase'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number
    email?: string
    [key: string]: any
  }
}

/**
 * Middleware de autenticación JWT usando Supabase
 */
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
      code: 'AUTH_TOKEN_MISSING'
    })
  }

  try {
    console.log('🔐 Iniciando autenticación con token:', token.substring(0, 20) + '...')

    // Validar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.log('❌ Error validando token JWT:', error)
      return res.status(403).json({
        error: 'Token no válido o expirado',
        code: 'AUTH_TOKEN_INVALID'
      })
    }

    console.log('✅ Token JWT válido para usuario UUID:', user.id)

    // Obtener datos del usuario desde la tabla personalizada
    // Usar supabaseAdmin para bypass RLS en autenticación
    console.log('📋 Consultando tbl_usuarios con supabaseAdmin...')
    const { data: userData, error: userError } = await supabaseAdmin
      .from('tbl_usuarios')
      .select('id, nombres, apellidos, correo')
      .eq('uuid', user.id)
      .eq('estado', 1)
      .single()

    if (userError || !userData) {
      console.log('❌ Error consultando tbl_usuarios:', userError)
      console.log('❌ Datos usuario obtenidos:', userData)
      return res.status(403).json({
        error: 'Usuario no encontrado en el sistema',
        code: 'USER_NOT_FOUND'
      })
    }

    console.log('✅ Usuario encontrado en tbl_usuarios:', userData.id, userData.correo)

    // Agregar información del usuario al request
    req.user = {
      id: userData.id,
      email: userData.correo,
      supabaseId: user.id,
      nombres: userData.nombres,
      apellidos: userData.apellidos
    }

    next()
  } catch (error) {
    console.error('Error validando token:', error)
    return res.status(500).json({
      error: 'Error interno del servidor',
      code: 'AUTH_SERVER_ERROR'
    })
  }
}

/**
 * Middleware de validación de API Key (para comunicación interna)
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key']

  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key requerida',
      code: 'API_KEY_MISSING'
    })
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({
      error: 'API Key no válida',
      code: 'API_KEY_INVALID'
    })
  }

  // Para API Key interno - sin user info por defecto
  // El cliente debe enviar la información necesaria

  next()
}

/**
 * Middleware combinado: JWT o API Key
 */
export const authenticateRequest = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key']

  // Si tiene API key, validar solo eso
  if (apiKey) {
    return validateApiKey(req, res, next)
  }

  // Si no, validar JWT
  return authenticateToken(req, res, next)
}