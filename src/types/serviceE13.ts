// Tipos migrados desde ServiceE13.ts para funcionalidad E14

export interface MetadatosDictamenBorrador {
    id_tipo_archivo: number
    fecha_documento: string
    hora_reunion?: string | null // Solo para ID 15 (Acta)
    lugar_reunion?: string | null // Solo para ID 15 (Acta)
}

// Interfaz para requests de actualización de metadatos E13
export interface ActualizarMetadatosE13Request {
    tipoId: number
    metadatos: MetadatosDictamenBorrador
}