// app/api/import/absolute-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface CSVRow {
  [key: string]: string
}

interface ProcessedStore {
  suc_sap: string
  mes: string
  formato: string
  zona: string
  distrito: string
  sucursal: string
  calle: string
  colonia: string
  municipio: string
  estado: string
  ciudad: string
  cp: string
}

interface ProcessedAbsoluteMetrics {
  ventas: number | null
  ordenes: number | null
  tickets: number | null
}

export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Create Supabase client with user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    })

    // Now get user with the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken)

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { csvData, filename, detectedFormat } = body

    if (!csvData || !csvData.headers || !csvData.fullData) {
      return NextResponse.json({ error: 'Datos CSV inválidos' }, { status: 400 })
    }

    const headers = csvData.headers
    const rows = csvData.fullData

    // Find column indices
    const getColumnIndex = (searchTerms: string[]) => {
      return headers.findIndex((header: string) => 
        searchTerms.some(term => 
          header.toLowerCase().includes(term.toLowerCase())
        )
      )
    }

    const columnIndices = {
      mes: getColumnIndex(['mes']),
      formato: getColumnIndex(['formato']),
      zona: getColumnIndex(['zona']),
      distrito: getColumnIndex(['distrito']),
      suc_sap: getColumnIndex(['suc', 'sap']),
      sucursal: getColumnIndex(['sucursal']),
      calle: getColumnIndex(['calle']),
      colonia: getColumnIndex(['colonia']),
      municipio: getColumnIndex(['municipio']),
      estado: getColumnIndex(['estado']),
      ciudad: getColumnIndex(['ciudad']),
      cp: getColumnIndex(['cp']),
      ventas: getColumnIndex(['ventas', 'sales']),
      ordenes: getColumnIndex(['ordenes', 'orders']),
      tickets: getColumnIndex(['tickets', 'ticket'])
    }

    // Validate required columns exist
    const requiredColumns = ['suc_sap', 'formato', 'estado', 'sucursal']
    const missingColumns = requiredColumns.filter(col => columnIndices[col as keyof typeof columnIndices] === -1)
    
    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: `Columnas requeridas faltantes: ${missingColumns.join(', ')}`
      }, { status: 400 })
    }

    let storesProcessed = 0
    let metricsProcessed = 0
    const errors: string[] = []

    // Create upload history record
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('upload_history')
      .insert({
        user_id: user.id,
        filename: filename || 'unknown.csv',
        format_type: 'absolute'
      })
      .select()
      .single()

    if (uploadError) {
      console.error('Error creating upload record:', uploadError)
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      if (!row || row.length === 0) continue

      try {
        // Extract store data
        const storeData: ProcessedStore = {
          suc_sap: row[columnIndices.suc_sap]?.trim() || '',
          mes: row[columnIndices.mes]?.trim() || '',
          formato: row[columnIndices.formato]?.trim() || '',
          zona: row[columnIndices.zona]?.trim() || '',
          distrito: row[columnIndices.distrito]?.trim() || '',
          sucursal: row[columnIndices.sucursal]?.trim() || '',
          calle: row[columnIndices.calle]?.trim() || '',
          colonia: row[columnIndices.colonia]?.trim() || '',
          municipio: row[columnIndices.municipio]?.trim() || '',
          estado: row[columnIndices.estado]?.trim() || '',
          ciudad: row[columnIndices.ciudad]?.trim() || '',
          cp: row[columnIndices.cp]?.trim() || ''
        }

        // Validate required store fields
        if (!storeData.suc_sap || !storeData.formato || !storeData.estado) {
          errors.push(`Fila ${i + 1}: Faltan datos requeridos de tienda`)
          continue
        }

        // Upsert store
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .upsert({
            user_id: user.id,
            ...storeData
          }, {
            onConflict: 'user_id,suc_sap,mes'
          })
          .select()
          .single()

        if (storeError) {
          errors.push(`Fila ${i + 1}: Error al guardar tienda - ${storeError.message}`)
          continue
        }

        storesProcessed++

        // Extract and process absolute metrics
        const parseNumber = (value: string): number | null => {
          if (!value || value.trim() === '') return null
          const cleaned = value.replace(/,/g, '').trim()
          const parsed = parseFloat(cleaned)
          return isNaN(parsed) ? null : parsed
        }

        const parseInteger = (value: string): number | null => {
          if (!value || value.trim() === '') return null
          const cleaned = value.replace(/,/g, '').trim()
          const parsed = parseInt(cleaned)
          return isNaN(parsed) ? null : parsed
        }

        const metricsData: ProcessedAbsoluteMetrics = {
          ventas: columnIndices.ventas !== -1 
            ? parseNumber(row[columnIndices.ventas]) 
            : null,
          ordenes: columnIndices.ordenes !== -1 
            ? parseInteger(row[columnIndices.ordenes]) 
            : null,
          tickets: columnIndices.tickets !== -1 
            ? parseInteger(row[columnIndices.tickets]) 
            : null
        }

        // Only insert metrics if at least one KPI exists
        if (metricsData.ventas !== null || 
            metricsData.ordenes !== null || 
            metricsData.tickets !== null) {
          
          const currentDate = new Date().toISOString().split('T')[0]
          
          const { error: metricsError } = await supabase
            .from('absolute_metrics')
            .upsert({
              store_id: store.id,
              period: currentDate,
              ...metricsData
            }, {
              onConflict: 'store_id,period'
            })

          if (metricsError) {
            errors.push(`Fila ${i + 1}: Error al guardar métricas - ${metricsError.message}`)
            continue
          }

          metricsProcessed++
        }

      } catch (error) {
        errors.push(`Fila ${i + 1}: Error inesperado - ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Update upload history with results
    if (uploadRecord) {
      await supabase
        .from('upload_history')
        .update({
          stores_imported: storesProcessed,
          metrics_imported: metricsProcessed
        })
        .eq('id', uploadRecord.id)
    }

    return NextResponse.json({
      success: true,
      storesProcessed,
      metricsProcessed,
      errors: errors.slice(0, 10), // Limit to first 10 errors
      totalErrors: errors.length
    })

  } catch (error) {
    console.error('Error importing absolute metrics:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}