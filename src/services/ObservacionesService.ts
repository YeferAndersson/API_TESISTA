// Servicio migrado desde ServiceObservaciones.ts
import { supabase } from '@/config/supabase'
import type {
    ObservacionData,
    EstadoObservaciones,
    TipoArchivo,
    AllObservacionesResponse
} from '@/types/observaciones'

/**
 * Obtiene el estado de observaciones para etapas 2, 3, 4, 11, 14, 16 - LÓGICA CORREGIDA
 */
export async function getEstadoObservaciones(tramiteId: number, etapa: number): Promise<EstadoObservaciones> {
    // Validar que sea etapa 2, 3, 4, 11, 14, o 16
    if (![2, 3, 4, 11, 14, 16].includes(etapa)) {
        throw new Error(`Etapa ${etapa} no soportada en ServiceObservaciones`)
    }

    try {
        console.log(`🔍 Verificando observaciones para trámite ${tramiteId} en etapa ${etapa}`)

        // 1. Obtener todas las observaciones de la etapa
        const { data: observaciones, error } = await supabase
            .from('tbl_observaciones')
            .select(`
                id,
                id_tramite,
                id_etapa,
                id_usuario,
                id_rol,
                visto_bueno,
                observacion,
                fecha,
                usuario:id_usuario(
                    id,
                    nombres,
                    apellidos
                ),
                rol_servicio:id_rol(
                    id,
                    servicio:id_servicio(
                        id,
                        nombre,
                        descripcion
                    )
                )
            `)
            .eq('id_tramite', tramiteId)
            .eq('id_etapa', etapa)
            .order('fecha', { ascending: false })

        if (error) {
            console.error('Error obteniendo observaciones:', error)
            throw new Error('Error al obtener las observaciones')
        }

        // 2. Contar observaciones pendientes (visto_bueno = 0)
        const observacionesPendientes = observaciones?.filter(obs => obs.visto_bueno === 0) || []
        const numeroObservaciones = observacionesPendientes.length

        console.log(`📋 Observaciones pendientes encontradas: ${numeroObservaciones}`)

        // 3. Contar correcciones enviadas (logs con id_accion dinámico según etapa)
        const idAccion = getIdAccionCorrecion(etapa)
        const { data: logCorrecciones, error: logError } = await supabase
            .from('log_acciones')
            .select('id, fecha, mensaje')
            .eq('id_tramite', tramiteId)
            .eq('id_etapa', etapa)
            .eq('id_accion', idAccion) // Dinámico según etapa
            .order('fecha', { ascending: false })

        if (logError) {
            console.error('Error obteniendo logs de correcciones:', logError)
            throw new Error('Error al verificar el historial de correcciones')
        }

        const numeroCorrecciones = logCorrecciones?.length || 0
        console.log(`📝 Correcciones enviadas encontradas: ${numeroCorrecciones}`)

        // 4. LÓGICA ESPECIAL PARA ETAPAS 14 Y 16
        let tieneCorrecciones: boolean
        let yaEnvioCorrección: boolean

        if (etapa === 14 || etapa === 16) {
            // Para E14 y E16: también verificar primera presentación
            let totalEnvios = numeroCorrecciones

            if (etapa === 14) {
                const { data: logPrimera, error: primeraError } = await supabase
                    .from('log_acciones')
                    .select('id')
                    .eq('id_tramite', tramiteId)
                    .eq('id_etapa', 14)
                    .eq('id_accion', 49) // Primera presentación E14
                    .limit(1)

                if (!primeraError && logPrimera && logPrimera.length > 0) {
                    totalEnvios += 1 // Sumar primera presentación al total
                }
            }

            if (etapa === 16) {
                const { data: logPrimera, error: primeraError } = await supabase
                    .from('log_acciones')
                    .select('id')
                    .eq('id_tramite', tramiteId)
                    .eq('id_etapa', 16)
                    .eq('id_accion', 63) // Primera presentación E16
                    .limit(1)

                if (!primeraError && logPrimera && logPrimera.length > 0) {
                    totalEnvios += 1 // Sumar primera presentación al total
                }
            }

            // ETAPAS 14 Y 16: Lógica unificada basada en envíos totales
            if (numeroObservaciones === 0) {
                // No hay observaciones del coordinador todavía
                if (totalEnvios === 0) {
                    // Primera subida: debe subir archivos obligatorios
                    tieneCorrecciones = false // No hay observaciones que corregir
                    yaEnvioCorrección = false // No ha enviado su primera subida
                } else {
                    // Ya envió al menos una vez, esperando observaciones del coordinador
                    tieneCorrecciones = false // No hay observaciones pendientes
                    yaEnvioCorrección = true // Ya envió su primera subida
                }
            } else {
                // Hay observaciones del coordinador
                tieneCorrecciones = true
                yaEnvioCorrección = totalEnvios > numeroObservaciones
            }
        } else {
            // OTRAS ETAPAS: Lógica original
            tieneCorrecciones = numeroObservaciones > 0
            yaEnvioCorrección = numeroCorrecciones >= numeroObservaciones
        }

        console.log(`✅ Lógica de estados (Etapa ${etapa}):`)
        console.log(`   - Observaciones pendientes: ${numeroObservaciones}`)
        console.log(`   - Correcciones enviadas: ${numeroCorrecciones}`)
        console.log(`   - Tiene correcciones: ${tieneCorrecciones}`)
        console.log(`   - Ya envió corrección: ${yaEnvioCorrección}`)

        const estado: EstadoObservaciones = {
            tieneCorrecciones,
            numeroCorrecciones: numeroObservaciones, // El número que importa para la UI
            yaEnvioCorrección,
            observaciones: (observaciones as unknown as ObservacionData[]) || []
        }

        return estado
    } catch (error) {
        console.error('❌ Error en getEstadoObservaciones:', error)
        throw error
    }
}

/**
 * Obtiene TODAS las observaciones del trámite, agrupadas por etapas (2-4, 11, 16)
 */
export async function getAllObservacionesByTramite(tramiteId: number, etapaActual: number): Promise<AllObservacionesResponse> {
    try {
        console.log(`🔍 Obteniendo todas las observaciones para trámite ${tramiteId} hasta etapa ${etapaActual}`)

        // Obtener todas las observaciones del trámite hasta la etapa actual (solo 2-4, 11, 14, 16)
        const etapasPermitidas = [2, 3, 4, 11, 14, 16].filter(etapa => etapa <= etapaActual)

        const { data: observaciones, error } = await supabase
            .from('tbl_observaciones')
            .select(`
                id,
                id_tramite,
                id_etapa,
                id_usuario,
                id_rol,
                visto_bueno,
                observacion,
                fecha,
                usuario:id_usuario(
                    id,
                    nombres,
                    apellidos
                ),
                rol_servicio:id_rol(
                    id,
                    servicio:id_servicio(
                        id,
                        nombre,
                        descripcion
                    )
                ),
                etapa:id_etapa(
                    id,
                    nombre,
                    descripcion
                )
            `)
            .eq('id_tramite', tramiteId)
            .in('id_etapa', etapasPermitidas) // Solo etapas 2-4, 11, 14, 16
            .order('fecha', { ascending: false })

        if (error) {
            console.error('Error obteniendo todas las observaciones:', error)
            throw new Error('Error al obtener las observaciones del trámite')
        }

        // Agrupar observaciones por etapa
        const observacionesPorEtapa: Record<number, any[]> = {}
        const etapasConObservaciones: number[] = []

        if (observaciones && observaciones.length > 0) {
            (observaciones as any[]).forEach((obs: any) => {
                const etapa = obs.id_etapa

                if (!observacionesPorEtapa[etapa]) {
                    observacionesPorEtapa[etapa] = []
                    if (!etapasConObservaciones.includes(etapa)) {
                        etapasConObservaciones.push(etapa)
                    }
                }

                observacionesPorEtapa[etapa].push(obs)
            })
        }

        // Ordenar etapas
        etapasConObservaciones.sort((a, b) => a - b)

        const totalObservaciones = observaciones?.length || 0

        console.log(`✅ Observaciones obtenidas:`)
        console.log(`   - Total observaciones: ${totalObservaciones}`)
        console.log(`   - Etapas con observaciones: ${etapasConObservaciones.join(', ')}`)
        console.log(`   - Observaciones por etapa:`, Object.entries(observacionesPorEtapa).map(([etapa, obs]) => `Etapa ${etapa}: ${obs.length}`).join(', '))

        return {
            observacionesPorEtapa,
            totalObservaciones,
            etapasConObservaciones
        }
    } catch (error) {
        console.error('❌ Error en getAllObservacionesByTramite:', error)
        throw error
    }
}

/**
 * Obtiene los tipos de archivos requeridos para etapas 2, 3, 4, 11, 14, 16
 */
export async function getTiposArchivosByEtapa(etapa: number, yaEnvioCorreccion = false): Promise<TipoArchivo[]> {
    // Validar que sea etapa 2, 3, 4, 11, 14, o 16
    if (![2, 3, 4, 11, 14, 16].includes(etapa)) {
        throw new Error(`Etapa ${etapa} no soportada en ServiceObservaciones`)
    }

    try {
        // Para etapas 2, 3, 4 usamos los mismos tipos que etapa 1
        // Para etapa 11 usamos los tipos de borrador + constancias de bachiller
        // Para etapa 14 usamos archivos de pre-sustentación (primera vez solo 17,18 / correcciones incluye 16,14,15)
        // Para etapa 16 usamos los tipos de tesis final post-sustentación
        const tiposIds = etapa === 16
            ? [20, 21] // Tesis final + observaciones sustentación
            : etapa === 14
                ? (yaEnvioCorreccion ? [14, 15, 16, 17, 18] : [17, 18]) // E14: primera vez solo 17,18 / correcciones incluye E13 (14,15,16)
                : etapa === 11
                    ? [7, 8, 10, 11, 12, 13] // Constancias + borrador de tesis (sin ID 9)
                    : [1, 2, 3, 4, 5] // Proyecto original

        const { data, error } = await supabase
            .from('dic_tipo_archivo')
            .select('*')
            .in('id', tiposIds)
            .order('id')

        if (error) {
            console.error('Error obteniendo tipos de archivo:', error)
            throw new Error('Error al obtener los tipos de archivo')
        }

        const tiposArchivo: TipoArchivo[] = data.map(tipo => ({
            id: tipo.id,
            nombre: tipo.nombre,
            descripcion: tipo.descripcion,
            // Configurar obligatorios según la etapa
            obligatorio: etapa === 16
                ? (yaEnvioCorreccion ? false : true) // En E16: obligatorio en primera subida, opcional después
                : etapa === 14
                    ? (yaEnvioCorreccion ? false : [17, 18].includes(tipo.id)) // E14: primera vez 17,18 obligatorios / correcciones opcionales
                    : etapa === 11
                        ? tipo.id === 10 // Solo Turnitin borrador es obligatorio en E11 (ID 11 ahora opcional)
                        : [1, 2, 3].includes(tipo.id), // Proyecto, Turnitin, IA son obligatorios en E2-E4
            max_size: 4, // Default 4MB
        }))

        console.log(`📁 Tipos de archivo para etapa ${etapa}:`, tiposArchivo.length)
        return tiposArchivo
    } catch (error) {
        console.error('❌ Error en getTiposArchivosByEtapa:', error)
        throw error
    }
}

/**
 * Envía correcciones para etapas 2, 3, 4, 11, 14, 16
 * NOTA: Esta función será adaptada para trabajar con FormData desde la API
 */
export async function enviarCorreccion(
    tramiteId: number,
    etapa: number,
    codigoProyecto: string,
    userId: number,
    correccionData: {
        metadatos: {
            titulo: string
            abstract: string
            keywords: string
            presupuesto: number
            conclusiones?: string
        }
        archivos: { buffer: Buffer; filename: string; tipoId: number }[]
        metadatosE13?: { tipoId: number; metadatos: any }[]
    }
): Promise<void> {
    // Validar que sea etapa 2, 3, 4, 11, 14, o 16
    if (![2, 3, 4, 11, 14, 16].includes(etapa)) {
        throw new Error(`Etapa ${etapa} no soportada en ServiceObservaciones`)
    }

    try {
        console.log(`🚀 Enviando corrección para trámite ${tramiteId} en etapa ${etapa}`)

        // 1. Desactivar metadatos anteriores
        const { error: updateMetadatosError } = await supabase
            .from('tbl_tramites_metadatos')
            .update({ estado_tm: 0 })
            .eq('id_tramite', tramiteId)
            .eq('estado_tm', 1)

        if (updateMetadatosError) {
            console.error('Error desactivando metadatos anteriores:', updateMetadatosError)
            throw new Error('Error al actualizar metadatos anteriores')
        }

        // 2. Insertar nuevos metadatos
        const metadatosInsert = {
            id_tramite: tramiteId,
            id_etapa: etapa,
            titulo: correccionData.metadatos.titulo,
            abstract: correccionData.metadatos.abstract,
            keywords: correccionData.metadatos.keywords,
            presupuesto: correccionData.metadatos.presupuesto,
            estado_tm: 1,
            // Solo incluir conclusiones para etapas 11, 14 y 16
            ...((etapa === 11 || etapa === 14 || etapa === 16) && correccionData.metadatos.conclusiones && {
                conclusiones: correccionData.metadatos.conclusiones
            }),
            // Para etapas 2-4, conclusiones es null
            ...([2, 3, 4].includes(etapa) && { conclusiones: null })
        }

        const { data: nuevosMetadatos, error: metadatosError } = await supabase
            .from('tbl_tramites_metadatos')
            .insert([metadatosInsert])
            .select('id')
            .single()

        if (metadatosError || !nuevosMetadatos) {
            console.error('Error creando nuevos metadatos:', metadatosError)
            throw new Error('Error al guardar los metadatos corregidos')
        }

        console.log(`✅ Nuevos metadatos creados con ID: ${nuevosMetadatos.id}`)

        // 2.5. Actualizar metadatos de E13 si es etapa 14 y se proporcionaron
        if (etapa === 14 && correccionData.metadatosE13 && correccionData.metadatosE13.length > 0) {
            console.log(`📋 Actualizando metadatos E13 para etapa 14`)
            await actualizarMetadatosE13(tramiteId, correccionData.metadatosE13)
        }

        // 3. Procesar archivos (solo los enviados)
        for (const archivo of correccionData.archivos) {
            // Obtener archivos existentes del mismo tipo para calcular la siguiente letra
            const { data: archivosExistentes } = await supabase
                .from('tbl_archivos_tramites')
                .select('nombre_archivo')
                .eq('id_tramite', tramiteId)
                .eq('id_tipo_archivo', archivo.tipoId)

            // Calcular siguiente letra (A, B, C, ...)
            let letra = 'A'
            if (archivosExistentes && archivosExistentes.length > 0) {
                letra = String.fromCharCode(65 + archivosExistentes.length) // A=65, B=66, etc.
            }

            // Desactivar archivos anteriores del mismo tipo
            await supabase
                .from('tbl_archivos_tramites')
                .update({ estado_archivo: 0 })
                .eq('id_tramite', tramiteId)
                .eq('id_tipo_archivo', archivo.tipoId)
                .eq('estado_archivo', 1)

            // Determinar extensión
            const extension = archivo.filename.split('.').pop()?.toLowerCase()
            if (!extension) {
                throw new Error('No se pudo determinar la extensión del archivo')
            }

            // Generar nombre del archivo según la etapa
            const nombreArchivo = `${letra}${archivo.tipoId}-${codigoProyecto}.${extension}`
            const storagePath = `tramite-${tramiteId}/${nombreArchivo}`

            console.log(`📁 Subiendo archivo: ${storagePath}`)

            // Subir archivo a storage
            const { error: uploadError } = await supabase.storage
                .from('tramites-documentos')
                .upload(storagePath, archivo.buffer, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: `application/${extension}`,
                })

            if (uploadError) {
                console.error('Error subiendo archivo:', uploadError)
                throw new Error(`Error al subir el archivo: ${uploadError.message}`)
            }

            // Registrar en base de datos
            const { error: dbError } = await supabase.from('tbl_archivos_tramites').insert([
                {
                    id_tramite: tramiteId,
                    id_tipo_archivo: archivo.tipoId,
                    nombre_archivo: nombreArchivo,
                    storage: 'supabase',
                    bucket: 'tramites-documentos',
                    id_etapa: etapa,
                    id_tramites_metadatos: nuevosMetadatos.id,
                    estado_archivo: 1,
                    max_size: 4,
                },
            ])

            if (dbError) {
                console.error('Error registrando archivo en BD:', dbError)
                // Intentar limpiar archivo subido
                await supabase.storage.from('tramites-documentos').remove([storagePath])
                throw new Error('Error al registrar el archivo en la base de datos')
            }

            console.log(`✅ Archivo registrado: ${nombreArchivo}`)
        }

        // 4. Actualizar id_tramites_metadatos de archivos que no fueron modificados
        const tiposReemplazados = correccionData.archivos.map(a => a.tipoId)

        if (tiposReemplazados.length > 0) {
            // Actualizar archivos activos que NO fueron reemplazados
            const { error: updateOtherFilesError } = await supabase
                .from('tbl_archivos_tramites')
                .update({ id_tramites_metadatos: nuevosMetadatos.id })
                .eq('id_tramite', tramiteId)
                .eq('estado_archivo', 1)
                .not('id_tipo_archivo', 'in', `(${tiposReemplazados.join(',')})`)

            if (updateOtherFilesError) {
                console.error('Error actualizando metadatos de archivos no modificados:', updateOtherFilesError)
            } else {
                console.log(`✅ Archivos no modificados actualizados con nuevo id_tramites_metadatos: ${nuevosMetadatos.id}`)
            }
        } else {
            // Si no se reemplazó ningún archivo, actualizar todos los archivos activos
            const { error: updateAllFilesError } = await supabase
                .from('tbl_archivos_tramites')
                .update({ id_tramites_metadatos: nuevosMetadatos.id })
                .eq('id_tramite', tramiteId)
                .eq('estado_archivo', 1)

            if (updateAllFilesError) {
                console.error('Error actualizando metadatos de todos los archivos:', updateAllFilesError)
            } else {
                console.log(`✅ Todos los archivos activos actualizados con nuevo id_tramites_metadatos: ${nuevosMetadatos.id}`)
            }
        }

        // 5. Registrar en log de acciones
        const numeroCorreccion = await getNumeroCorreccion(tramiteId, etapa)
        const idAccion = getIdAccionCorrecion(etapa)

        const { error: logError } = await supabase.from('log_acciones').insert([
            {
                id_tramite: tramiteId,
                id_accion: idAccion, // Dinámico según etapa
                id_etapa: etapa,
                id_usuario: userId,
                mensaje: `Corrección ${numeroCorreccion} enviada`,
            },
        ])

        if (logError) {
            console.error('Error registrando log de acción:', logError)
            // No lanzar error, es información de auditoría
        }

        console.log(`🎉 Corrección enviada exitosamente para trámite ${tramiteId} en etapa ${etapa}`)
    } catch (error) {
        console.error('❌ Error en enviarCorreccion:', error)
        throw error
    }
}

// ================================
// FUNCIONES AUXILIARES INTERNAS
// ================================

/**
 * Procesa archivos y metadatos SIN registrar logs de acciones
 * (Para primera presentación E16 donde solo necesitamos procesar archivos)
 */
async function procesarArchivosYMetadatos(
    tramiteId: number,
    etapa: number,
    userId: number,
    correccionData: {
        metadatos: {
            titulo: string
            abstract: string
            keywords: string
            presupuesto: number
            conclusiones?: string
        }
        archivos: { buffer: Buffer; filename: string; tipoId: number }[]
        metadatosE13?: { tipoId: number; metadatos: any }[]
    },
    codigoProyecto: string
): Promise<{ metadatosId: number }> {
    // 1. Desactivar metadatos anteriores
    const { error: updateMetadatosError } = await supabase
        .from('tbl_tramites_metadatos')
        .update({ estado_tm: 0 })
        .eq('id_tramite', tramiteId)
        .eq('estado_tm', 1)

    if (updateMetadatosError) {
        console.error('Error desactivando metadatos anteriores:', updateMetadatosError)
        throw new Error('Error al actualizar metadatos anteriores')
    }

    // 2. Insertar nuevos metadatos
    const metadatosInsert = {
        id_tramite: tramiteId,
        id_etapa: etapa,
        titulo: correccionData.metadatos.titulo,
        abstract: correccionData.metadatos.abstract,
        keywords: correccionData.metadatos.keywords,
        presupuesto: correccionData.metadatos.presupuesto,
        estado_tm: 1,
        // Solo incluir conclusiones para etapas 11, 14 y 16
        ...((etapa === 11 || etapa === 14 || etapa === 16) && correccionData.metadatos.conclusiones && {
            conclusiones: correccionData.metadatos.conclusiones
        }),
        // Para etapas 2-4, conclusiones es null
        ...([2, 3, 4].includes(etapa) && { conclusiones: null })
    }

    const { data: nuevosMetadatos, error: metadatosError } = await supabase
        .from('tbl_tramites_metadatos')
        .insert([metadatosInsert])
        .select('id')
        .single()

    if (metadatosError || !nuevosMetadatos) {
        console.error('Error creando nuevos metadatos:', metadatosError)
        throw new Error('Error al guardar los metadatos')
    }

    console.log(`✅ Nuevos metadatos creados con ID: ${nuevosMetadatos.id}`)

    // 2.5. Actualizar metadatos de E13 si es etapa 14 y se proporcionaron
    if (etapa === 14 && correccionData.metadatosE13 && correccionData.metadatosE13.length > 0) {
        console.log(`📋 Actualizando metadatos E13 para etapa 14`)
        await actualizarMetadatosE13(tramiteId, correccionData.metadatosE13)
    }

    // 3. Procesar archivos (solo los enviados)
    for (const archivo of correccionData.archivos) {
        // Obtener archivos existentes del mismo tipo para calcular la siguiente letra
        const { data: archivosExistentes } = await supabase
            .from('tbl_archivos_tramites')
            .select('nombre_archivo')
            .eq('id_tramite', tramiteId)
            .eq('id_tipo_archivo', archivo.tipoId)

        // Calcular siguiente letra (A, B, C, ...)
        let letra = 'A'
        if (archivosExistentes && archivosExistentes.length > 0) {
            letra = String.fromCharCode(65 + archivosExistentes.length) // A=65, B=66, etc.
        }

        // Desactivar archivos anteriores del mismo tipo
        await supabase
            .from('tbl_archivos_tramites')
            .update({ estado_archivo: 0 })
            .eq('id_tramite', tramiteId)
            .eq('id_tipo_archivo', archivo.tipoId)
            .eq('estado_archivo', 1)

        // Determinar extensión
        const extension = archivo.filename.split('.').pop()?.toLowerCase()
        if (!extension) {
            throw new Error('No se pudo determinar la extensión del archivo')
        }

        // Generar nombre del archivo según la etapa
        const nombreArchivo = `${letra}${archivo.tipoId}-${codigoProyecto}.${extension}`
        const storagePath = `tramite-${tramiteId}/${nombreArchivo}`

        console.log(`📁 Subiendo archivo: ${storagePath}`)

        // Subir archivo a storage
        const { error: uploadError } = await supabase.storage
            .from('tramites-documentos')
            .upload(storagePath, archivo.buffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: `application/${extension}`,
            })

        if (uploadError) {
            console.error('Error subiendo archivo:', uploadError)
            throw new Error(`Error al subir el archivo: ${uploadError.message}`)
        }

        // Registrar en base de datos
        const { error: dbError } = await supabase.from('tbl_archivos_tramites').insert([
            {
                id_tramite: tramiteId,
                id_tipo_archivo: archivo.tipoId,
                nombre_archivo: nombreArchivo,
                storage: 'supabase',
                bucket: 'tramites-documentos',
                id_etapa: etapa,
                id_tramites_metadatos: nuevosMetadatos.id,
                estado_archivo: 1,
                max_size: 4,
            },
        ])

        if (dbError) {
            console.error('Error registrando archivo en BD:', dbError)
            // Intentar limpiar archivo subido
            await supabase.storage.from('tramites-documentos').remove([storagePath])
            throw new Error('Error al registrar el archivo en la base de datos')
        }

        console.log(`✅ Archivo registrado: ${nombreArchivo}`)
    }

    // 4. Actualizar id_tramites_metadatos de archivos que no fueron modificados
    const tiposReemplazados = correccionData.archivos.map(a => a.tipoId)

    if (tiposReemplazados.length > 0) {
        // Actualizar archivos activos que NO fueron reemplazados
        const { error: updateOtherFilesError } = await supabase
            .from('tbl_archivos_tramites')
            .update({ id_tramites_metadatos: nuevosMetadatos.id })
            .eq('id_tramite', tramiteId)
            .eq('estado_archivo', 1)
            .not('id_tipo_archivo', 'in', `(${tiposReemplazados.join(',')})`)

        if (updateOtherFilesError) {
            console.error('Error actualizando metadatos de archivos no modificados:', updateOtherFilesError)
        } else {
            console.log(`✅ Archivos no modificados actualizados con nuevo id_tramites_metadatos: ${nuevosMetadatos.id}`)
        }
    } else {
        // Si no se reemplazó ningún archivo, actualizar todos los archivos activos
        const { error: updateAllFilesError } = await supabase
            .from('tbl_archivos_tramites')
            .update({ id_tramites_metadatos: nuevosMetadatos.id })
            .eq('id_tramite', tramiteId)
            .eq('estado_archivo', 1)

        if (updateAllFilesError) {
            console.error('Error actualizando metadatos de todos los archivos:', updateAllFilesError)
        } else {
            console.log(`✅ Todos los archivos activos actualizados con nuevo id_tramites_metadatos: ${nuevosMetadatos.id}`)
        }
    }

    return { metadatosId: nuevosMetadatos.id }
}

/**
 * Obtiene el id_accion correcto para envío de correcciones según la etapa (solo 2, 3, 4, 11, 14, 16)
 */
function getIdAccionCorrecion(etapa: number): number {
    const etapaToIdAccion: Record<number, number> = {
        2: 7,   // Etapa 2: "envio de correcciones etapa 2"
        3: 12,  // Etapa 3: "envio de correcciones etapa 3"
        4: 16,  // Etapa 4: "envio de correcciones etapa 4"
        11: 40, // Etapa 11: "envio de correcciones etapa 11"
        14: 52, // Etapa 14: "envio de correcciones etapa 14"
        16: 66, // Etapa 16: "envio de correcciones etapa 16" - CORREGIDO
    }

    const idAccion = etapaToIdAccion[etapa]
    if (!idAccion) {
        throw new Error(`No se encontró id_accion para la etapa ${etapa} en ServiceObservaciones`)
    }

    return idAccion
}

/**
 * Calcula el número de corrección basado en los logs de acciones (etapas 2, 3, 4, 11, 16)
 */
async function getNumeroCorreccion(tramiteId: number, etapa: number): Promise<number> {
    try {
        const idAccion = getIdAccionCorrecion(etapa)

        const { data, error } = await supabase
            .from('log_acciones')
            .select('id')
            .eq('id_tramite', tramiteId)
            .eq('id_etapa', etapa)
            .eq('id_accion', idAccion)

        if (error) {
            console.error('Error contando correcciones:', error)
            return 1
        }

        return (data?.length || 0) + 1
    } catch (error) {
        console.error('Error en getNumeroCorreccion:', error)
        return 1
    }
}

/**
 * Actualiza metadatos de archivos de E13 (para correcciones de E14)
 */
async function actualizarMetadatosE13(
    tramiteId: number,
    metadatosE13: { tipoId: number; metadatos: any }[]
): Promise<void> {
    try {
        for (const item of metadatosE13) {
            console.log(`💾 Actualizando metadatos E13 para tipo archivo ${item.tipoId}`)

            // Desactivar metadatos anteriores del mismo tipo
            const { error: deactivateError } = await supabase
                .from('tabla_metadatos_dictamen_borrador')
                .update({ estado: 0 })
                .eq('id_tramite', tramiteId)
                .eq('id_tipo_archivo', item.tipoId)
                .eq('estado', 1)

            if (deactivateError) {
                console.error('Error desactivando metadatos E13:', deactivateError)
                throw new Error('Error al desactivar metadatos anteriores de E13')
            }

            // Insertar nuevos metadatos
            const insertData: any = {
                id_tramite: tramiteId,
                id_tipo_archivo: item.tipoId,
                etapa: 14, // Se actualiza desde E14
                fecha_documento: item.metadatos.fecha_documento,
                estado: 1
            }

            // Agregar campos específicos para el Acta (ID 15)
            if (item.tipoId === 15) {
                insertData.hora_reunion = item.metadatos.hora_reunion
                insertData.lugar_reunion = item.metadatos.lugar_reunion
            }

            const { error: insertError } = await supabase
                .from('tabla_metadatos_dictamen_borrador')
                .insert([insertData])

            if (insertError) {
                console.error('Error insertando metadatos E13:', insertError)
                throw new Error('Error al guardar metadatos E13')
            }

            console.log(`✅ Metadatos E13 actualizados para tipo ${item.tipoId}`)
        }
    } catch (error) {
        console.error('❌ Error en actualizarMetadatosE13:', error)
        throw error
    }
}

/**
 * Verifica si ya se hizo la primera presentación de E16
 */
export async function yaHizoPrimeraE16(tramiteId: number): Promise<boolean> {
    try {
        const { data: primeraVez, error } = await supabase
            .from('log_acciones')
            .select('id')
            .eq('id_tramite', tramiteId)
            .eq('id_accion', 63) // Primera presentación específica de E16
            .eq('id_etapa', 16)
            .limit(1)

        if (error) {
            console.error('Error verificando primera presentación E16:', error)
            return false
        }

        return !!(primeraVez && primeraVez.length > 0)
    } catch (error) {
        console.error('❌ Error en yaHizoPrimeraE16:', error)
        return false
    }
}

/**
 * Completa la primera subida de E16 (sustentación) con id_accion = 63
 */
export async function completarPrimeraE16(
    tramiteId: number,
    codigoProyecto: string,
    userId: number,
    data: {
        metadatos: {
            titulo: string
            abstract: string
            keywords: string
            presupuesto: number
            conclusiones?: string
        }
        archivos: { buffer: Buffer; filename: string; tipoId: number }[]
    }
): Promise<void> {
    try {
        console.log(`🚀 Completando primera subida E16 para trámite ${tramiteId}`)

        // Verificar si ya hizo la primera presentación
        const yaHizo = await yaHizoPrimeraE16(tramiteId)
        if (yaHizo) {
            throw new Error('Ya se realizó la primera presentación para E16')
        }

        // Procesar archivos y metadatos SIN registrar log de corrección
        await procesarArchivosYMetadatos(tramiteId, 16, userId, data, codigoProyecto)

        // Registrar en log como primera presentación E16
        const { error: logError } = await supabase.from('log_acciones').insert([
            {
                id_tramite: tramiteId,
                id_accion: 63, // Primera presentación E16
                id_etapa: 16,
                id_usuario: userId,
                mensaje: 'Primera presentación E16 completada',
            },
        ])

        if (logError) {
            console.error('Error registrando log de primera presentación E16:', logError)
            // No lanzar error, es información de auditoría
        }

        console.log(`🎉 Primera presentación E16 completada para trámite ${tramiteId}`)
    } catch (error) {
        console.error('❌ Error en completarPrimeraE16:', error)
        throw error
    }
}