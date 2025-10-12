// Tipos migrados desde ServiceObservaciones.ts
import { type MetadatosDictamenBorrador } from './serviceE13'

export interface ObservacionData {
    id: number
    id_tramite: number
    id_etapa: number
    id_usuario: number
    id_rol: number
    visto_bueno: number
    observacion: string | null
    fecha: string
    usuario: {
        id: number
        nombres: string | null
        apellidos: string | null
    }
    rol_servicio: {
        id: number
        servicio: {
            id: number
            nombre: string
            descripcion: string | null
        }
    }
}

export interface CorreccionFormData {
    metadatos: {
        titulo: string
        abstract: string
        keywords: string
        presupuesto: number
        conclusiones?: string
    }
    archivos: { file: File; tipoId: number }[]
    metadatosE13?: { tipoId: number; metadatos: MetadatosDictamenBorrador }[] // Para archivos 14,15,16 en E14
}

export interface EstadoObservaciones {
    tieneCorrecciones: boolean
    numeroCorrecciones: number
    yaEnvioCorrección: boolean
    observaciones: ObservacionData[]
}

export interface TipoArchivo {
    id: number
    nombre: string
    descripcion: string | null
    obligatorio: boolean
    max_size: number
}

export interface AllObservacionesResponse {
    observacionesPorEtapa: Record<number, any[]>
    totalObservaciones: number
    etapasConObservaciones: number[]
}

// Interfaces para requests de la API
export interface EnviarCorreccionRequest {
    tramiteId: number
    etapa: number
    codigoProyecto: string
    metadatos: {
        titulo: string
        abstract: string
        keywords: string
        presupuesto: number
        conclusiones?: string
    }
    // Los archivos se manejarán como FormData en el endpoint
}

export interface EstadoObservacionesRequest {
    tramiteId: number
    etapa: number
}

export interface TiposArchivoRequest {
    etapa: number
    yaEnvioCorreccion?: boolean
}