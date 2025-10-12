import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'

/**
 * Middleware de validación usando Joi
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false })

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))

      return res.status(400).json({
        error: 'Datos de entrada no válidos',
        code: 'VALIDATION_ERROR',
        details: errors
      })
    }

    next()
  }
}

/**
 * Esquemas de validación para la API
 */
export const userIdSchema = Joi.object({
  userId: Joi.number().integer().positive().required()
})