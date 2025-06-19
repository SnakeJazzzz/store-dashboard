// app/api/import/growth-metrics/route.ts
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
  calle: string
  colonia: string
  estado: string
  municipio: string
  ciudad: string
  cp: string
}

interface ProcessedMetrics {
  revenue_growth_pct: number | null
  orders_growth_pct: number | null
  ticket_growth_pct: number | null
  year_comparison: string
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
      const index = headers.findIndex((header: string) => 
        searchTerms.some(term => 
          header.toLowerCase().trim().includes(term.toLowerCase())
        )
      )
      
      // Debug log para verificar detección
      console.log(`Searching for ${searchTerms.join('|')}: found at index ${index}`)
      if (index !== -1) {
        console.log(`  -> Header found: "${headers[index]}"`)
      }
      
      return index
    }

    const columnIndices = {
      formato: getColumnIndex(['formato']),
      zona: getColumnIndex(['zona']),
      distrito: getColumnIndex(['distrito']),
      suc_sap: getColumnIndex(['suc', 'sap']),
      sucursal: getColumnIndex(['sucursal']),
      calle: getColumnIndex(['calle', 'direccion', 'address']),
      colonia: getColumnIndex(['colonia', 'col']),
      municipio: getColumnIndex(['municipio']),
      estado: getColumnIndex(['estado']),
      ciudad: getColumnIndex(['ciudad']),
      cp: getColumnIndex(['cp']),
      revenue_growth: getColumnIndex(['$', 'crec', 'revenue']),
      orders_growth: getColumnIndex(['ordenes', 'crec', 'orders']),
      ticket_growth: getColumnIndex(['ticket', 'crec'])
    }

    // Debug: Verificar detección de columnas importantes
    console.log('=== COLUMN DETECTION DEBUG ===')
    console.log('Headers:', headers)
    console.log('columnIndices.calle:', columnIndices.calle)
    console.log('columnIndices.colonia:', columnIndices.colonia)
    console.log('columnIndices.suc_sap:', columnIndices.suc_sap)
    console.log('===============================')

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
        format_type: 'growth',
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
      calle: string;
      colonia: string;
      estado: string;
      municipio: string;
      ciudad: string;
      cp: string;
      first_seen: string;
      last_seen: string;
    }> = []
    const allProcessedRows: Array<{
      storeData: ProcessedStore,
      metricsData: ProcessedMetrics,
      rowIndex: number
    }> = []
    const csvSapCodes: string[] = []

    // Helper functions
    const parsePercentage = (value: string): number | null => {
      if (!value || value.trim() === '') return null
      const cleaned = value.replace('%', '').replace(',', '.').trim()
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? null : parsed
    }

    // Extract year comparison from headers
    const yearComparison = headers
      .find((h: string) => h.includes('vs') || h.includes('V'))
      ?.match(/\d{4}.*vs.*\d{4}/i)?.[0] || '2025 vs 2024'

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
          calle: safeTruncate(row[columnIndices.calle] || '', 255),
          colonia: safeTruncate(row[columnIndices.colonia] || '', 100),
          estado: safeTruncate(row[columnIndices.estado] || '', 50),
          municipio: safeTruncate(row[columnIndices.municipio] || '', 50),
          ciudad: safeTruncate(row[columnIndices.ciudad] || '', 50),
          cp: safeTruncate(row[columnIndices.cp] || '', 10) // Likely the 10-char limit field
        }

        // Debug: Verificar extracción de datos de las primeras filas
        if (i < 3) {
          console.log(`=== ROW ${i + 1} DATA EXTRACTION DEBUG ===`)
          console.log('Raw row data:', row)
          console.log('Row length:', row.length)
          console.log('columnIndices.calle:', columnIndices.calle)
          console.log('columnIndices.colonia:', columnIndices.colonia)
          console.log('Raw calle value:', `"${row[columnIndices.calle]}"`)
          console.log('Raw colonia value:', `"${row[columnIndices.colonia]}"`)
          console.log('Processed calle:', `"${storeData.calle}"`)
          console.log('Processed colonia:', `"${storeData.colonia}"`)
          console.log('storeData keys:', Object.keys(storeData))
          console.log('Full storeData:', storeData)
          console.log('=========================================')
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
            calle: storeData.calle,
            colonia: storeData.colonia,
            estado: storeData.estado,
            municipio: storeData.municipio,
            ciudad: storeData.ciudad,
            cp: storeData.cp,
            first_seen: currentDate,
            last_seen: currentDate
          })

          // Debug: Verificar datos antes de insertar (solo primera tienda)
          if (newStores.length === 1) {
            console.log('=== FIRST NEW STORE DEBUG ===')
            console.log('storeData.calle before push:', `"${storeData.calle}"`)
            console.log('storeData.colonia before push:', `"${storeData.colonia}"`)
            console.log('newStores[0] after push:', newStores[0])
            console.log('newStores[0].calle:', `"${newStores[0].calle}"`)
            console.log('newStores[0].colonia:', `"${newStores[0].colonia}"`)
            console.log('=============================')
          }
        }

        // Extract and process metrics
        const metricsData: ProcessedMetrics = {
          revenue_growth_pct: columnIndices.revenue_growth !== -1 
            ? parsePercentage(row[columnIndices.revenue_growth]) 
            : null,
          orders_growth_pct: columnIndices.orders_growth !== -1 
            ? parsePercentage(row[columnIndices.orders_growth]) 
            : null,
          ticket_growth_pct: columnIndices.ticket_growth !== -1 
            ? parsePercentage(row[columnIndices.ticket_growth]) 
            : null,
          year_comparison: yearComparison
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
      revenue_growth_pct: number | null;
      orders_growth_pct: number | null;
      ticket_growth_pct: number | null;
      year_comparison: string;
    }> = []

    allProcessedRows.forEach(({ storeData, metricsData, rowIndex }) => {
      const storeId = completeStoreMap.get(storeData.suc_sap)
      
      if (!storeId) {
        errors.push(`Fila ${rowIndex + 1}: No se encontró store_id para ${storeData.suc_sap}`)
        return
      }

      // Only add metrics if at least one KPI exists
      if (metricsData.revenue_growth_pct !== null || 
          metricsData.orders_growth_pct !== null || 
          metricsData.ticket_growth_pct !== null) {
        
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
        .from('growth_metrics')
        .upsert(allMetrics, {
          onConflict: 'store_id,period,year_comparison'
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
    console.error('Error importing growth metrics:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}