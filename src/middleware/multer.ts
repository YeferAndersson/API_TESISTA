import multer from 'multer'
import { Request } from 'express'

// Configuración de multer para manejo de archivos en memoria
const storage = multer.memoryStorage()

// Filtro de archivos permitidos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Extensiones permitidas
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg']
  const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase()

  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true)
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${fileExtension}. Permitidos: ${allowedExtensions.join(', ')}`))
  }
}

// Configuración de multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB por archivo
    files: 10 // Máximo 10 archivos por request
  }
})

// Middleware para manejar errores de multer
export const handleMulterError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'El archivo excede el tamaño máximo permitido (4MB)',
        code: 'FILE_TOO_LARGE'
      })
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Demasiados archivos. Máximo 10 archivos por envío',
        code: 'TOO_MANY_FILES'
      })
    }
  }

  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    })
  }

  // Error genérico de multer
  return res.status(400).json({
    success: false,
    error: 'Error procesando archivos',
    code: 'FILE_PROCESSING_ERROR'
  })
}