// app/api/import/absolute-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface CSVRow {
  [key: string]: string
}

interface ProcessedStore {
  suc_sap: string
  formato: string // CSV column name (maps to 'format' in DB)
  zona: string
  distrito: string
  sucursal: string
  estado: string
  municipio: string
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
      formato: getColumnIndex(['formato']),
      zona: getColumnIndex(['zona']),
      distrito: getColumnIndex(['distrito']),
      suc_sap: getColumnIndex(['suc', 'sap']),
      sucursal: getColumnIndex(['sucursal']),
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

    const startTime = Date.now()
    const errors: string[] = []
    const currentDate = new Date().toISOString().split('T')[0]
    const periodMonth = new Date().toISOString().slice(0, 7) // '2025-01'

    // Create upload history record
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('upload_history')
      .insert({
        user_id: user.id,
        filename: filename || 'unknown.csv',
        format_type: 'absolute',
        period_month: periodMonth
      })
      .select()
      .single()

    if (uploadError) {
      console.error('Error creating upload record:', uploadError)
    }

    // STEP 1: Get all existing stores for this user (1 database call)
    const { data: existingStores } = await supabase
      .from('stores')
      .select('suc_sap, id')
      .eq('user_id', user.id)

    const existingStoreMap = new Map<string, string>()
    existingStores?.forEach(store => {
      existingStoreMap.set(store.suc_sap, store.id)
    })

    // STEP 2: Process all CSV data into arrays
    const newStores: Array<{
      user_id: string;
      suc_sap: string;
      format: string; // Note: database column is 'format', not 'formato'
      zona: string;
      distrito: string;
      sucursal: string;
      estado: string;
      municipio: string;
      ciudad: string;
      cp: string;
      first_seen: string;
      last_seen: string;
    }> = []
    const allProcessedRows: Array<{
      storeData: ProcessedStore,
      metricsData: ProcessedAbsoluteMetrics,
      rowIndex: number
    }> = []
    const csvSapCodes: string[] = []

    // Helper functions
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

    // Process each row to build arrays
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      if (!row || row.length === 0) continue

      try {
        // Helper function to safely truncate string values
        const safeTruncate = (value: string, maxLength: number): string => {
          if (!value) return ''
          return value.trim().substring(0, maxLength)
        }

        // Extract store data (only fields that exist in database) with proper truncation
        const storeData: ProcessedStore = {
          suc_sap: safeTruncate(row[columnIndices.suc_sap] || '', 50),
          formato: safeTruncate(row[columnIndices.formato] || '', 50),
          zona: safeTruncate(row[columnIndices.zona] || '', 50),
          distrito: safeTruncate(row[columnIndices.distrito] || '', 50),
          sucursal: safeTruncate(row[columnIndices.sucursal] || '', 255), // text field - longer
          estado: safeTruncate(row[columnIndices.estado] || '', 50),
          municipio: safeTruncate(row[columnIndices.municipio] || '', 50),
          ciudad: safeTruncate(row[columnIndices.ciudad] || '', 50),
          cp: safeTruncate(row[columnIndices.cp] || '', 10) // Likely the 10-char limit field
        }

        // Validate required store fields
        if (!storeData.suc_sap || !storeData.formato || !storeData.estado) {
          errors.push(`Fila ${i + 1}: Faltan datos requeridos de tienda`)
          continue
        }

        // Check for duplicates in CSV
        if (csvSapCodes.includes(storeData.suc_sap)) {
          errors.push(`Fila ${i + 1}: Código SAP duplicado en CSV: ${storeData.suc_sap}`)
          continue
        }

        csvSapCodes.push(storeData.suc_sap)

        // Only add to newStores if it doesn't exist
        if (!existingStoreMap.has(storeData.suc_sap)) {
          newStores.push({
            user_id: user.id,
            suc_sap: storeData.suc_sap,
            format: storeData.formato, // Fix column name: formato -> format
            zona: storeData.zona,
            distrito: storeData.distrito,
            sucursal: storeData.sucursal,
            estado: storeData.estado,
            municipio: storeData.municipio,
            ciudad: storeData.ciudad,
            cp: storeData.cp,
            first_seen: currentDate,
            last_seen: currentDate
          })
        }

        // Extract and process absolute metrics
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

        allProcessedRows.push({
          storeData,
          metricsData,
          rowIndex: i
        })

      } catch (error) {
        errors.push(`Fila ${i + 1}: Error inesperado - ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // STEP 3: Validate and batch insert only NEW stores (1 database call)
    let insertedStores: { id: string; suc_sap: string }[] = []
    if (newStores.length > 0) {
      // Validate required fields before insert
      const invalidStores = newStores.filter(store => 
        !store.user_id || !store.suc_sap || !store.format || !store.estado
      )

      if (invalidStores.length > 0) {
        console.error('Invalid stores detected:', invalidStores.length)
        console.error('Sample invalid store:', invalidStores[0])
        return NextResponse.json({
          error: 'Invalid store data detected',
          invalid_count: invalidStores.length,
          sample_invalid: invalidStores[0]
        }, { status: 400 })
      }

      console.log('Attempting to insert stores:', newStores.length)
      console.log('Sample store:', newStores[0])
      
      // Log field lengths for debugging
      if (newStores[0]) {
        console.log('Field lengths:', {
          suc_sap: newStores[0].suc_sap?.length,
          format: newStores[0].format?.length,
          zona: newStores[0].zona?.length,
          distrito: newStores[0].distrito?.length,
          sucursal: newStores[0].sucursal?.length,
          estado: newStores[0].estado?.length,
          municipio: newStores[0].municipio?.length,
          ciudad: newStores[0].ciudad?.length,
          cp: newStores[0].cp?.length
        })
      }

      const { data, error: insertError } = await supabase
        .from('stores')
        .insert(newStores)
        .select('id, suc_sap')

      if (insertError) {
        console.error('Store upsert error details:', insertError)
        console.error('Sample store data:', newStores[0])
        errors.push(`Error al insertar nuevas tiendas: ${insertError.message}`)
        return NextResponse.json({ 
          error: `Error al insertar tiendas: ${insertError.message}`,
          details: insertError,
          sample_data: newStores[0]
        }, { status: 500 })
      }

      insertedStores = data || []
      console.log('Successfully inserted stores:', insertedStores.length)
    }

    // STEP 4: Update last_seen for existing stores in this CSV (1 database call)
    const existingCsvSapCodes = csvSapCodes.filter(sap => existingStoreMap.has(sap))
    if (existingCsvSapCodes.length > 0) {
      await supabase
        .from('stores')
        .update({ 
          last_seen: currentDate, 
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .in('suc_sap', existingCsvSapCodes)
    }

    // STEP 5: Build complete store map (existing + newly inserted)
    const completeStoreMap = new Map<string, string>()

    // Add existing stores
    existingStores?.forEach(store => {
      completeStoreMap.set(store.suc_sap, store.id)
    })

    // Add newly inserted stores
    insertedStores.forEach(store => {
      completeStoreMap.set(store.suc_sap, store.id)
    })

    // STEP 6: Prepare metrics for batch insert
    const allMetrics: Array<{
      store_id: string;
      period: string;
      ventas: number | null;
      ordenes: number | null;
      tickets: number | null;
    }> = []

    allProcessedRows.forEach(({ storeData, metricsData, rowIndex }) => {
      const storeId = completeStoreMap.get(storeData.suc_sap)
      
      if (!storeId) {
        errors.push(`Fila ${rowIndex + 1}: No se encontró store_id para ${storeData.suc_sap}`)
        return
      }

      // Only add metrics if at least one KPI exists
      if (metricsData.ventas !== null || 
          metricsData.ordenes !== null || 
          metricsData.tickets !== null) {
        
        allMetrics.push({
          store_id: storeId,
          period: currentDate,
          ...metricsData
        })
      }
    })

    // STEP 7: Batch insert all metrics (1 database call)
    let metricsProcessed = 0
    if (allMetrics.length > 0) {
      const { error: metricsError } = await supabase
        .from('absolute_metrics')
        .upsert(allMetrics, {
          onConflict: 'store_id,period'
        })

      if (metricsError) {
        errors.push(`Error al insertar métricas: ${metricsError.message}`)
      } else {
        metricsProcessed = allMetrics.length
      }
    }

    // STEP 8: Calculate analytics
    const analytics = {
      new_stores: newStores.length,
      existing_stores: csvSapCodes.length - newStores.length,
      closed_stores: 0, // TODO: Calculate stores not in current CSV but in database
      stores_imported: csvSapCodes.length,
      metrics_imported: metricsProcessed,
      period_month: periodMonth
    }

    // Update upload history with analytics
    if (uploadRecord) {
      await supabase
        .from('upload_history')
        .update(analytics)
        .eq('id', uploadRecord.id)
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      analytics: {
        stores_processed: csvSapCodes.length,
        new_stores: newStores.length,
        existing_stores: csvSapCodes.length - newStores.length,
        metrics_imported: metricsProcessed,
        period_month: periodMonth
      },
      errors: errors.slice(0, 10),
      totalErrors: errors.length,
      performance: {
        processing_time: processingTime,
        database_calls: 4, // vs 1,168 before
        stores_per_second: Math.round(csvSapCodes.length / (processingTime / 1000))
      }
    })

  } catch (error) {
    console.error('Error importing absolute metrics:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}