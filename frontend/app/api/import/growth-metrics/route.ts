// app/api/import/growth-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'

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

interface ProcessedMetrics {
  revenue_growth_pct: number | null
  orders_growth_pct: number | null
  ticket_growth_pct: number | null
  year_comparison: string
}

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { csvData, filename, detectedFormat } = body

    if (!csvData || !csvData.headers || !csvData.fullData) {
      return NextResponse.json({ error: 'Datos CSV inválidos' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 401 })
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
      revenue_growth: getColumnIndex(['$', 'crec', 'revenue']),
      orders_growth: getColumnIndex(['ordenes', 'crec', 'orders']),
      ticket_growth: getColumnIndex(['ticket', 'crec'])
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
        format_type: 'growth'
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

        // Extract and process metrics
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

        // Only insert metrics if at least one KPI exists
        if (metricsData.revenue_growth_pct !== null || 
            metricsData.orders_growth_pct !== null || 
            metricsData.ticket_growth_pct !== null) {
          
          const currentDate = new Date().toISOString().split('T')[0]
          
          const { error: metricsError } = await supabase
            .from('growth_metrics')
            .upsert({
              store_id: store.id,
              period: currentDate,
              ...metricsData
            }, {
              onConflict: 'store_id,period,year_comparison'
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
    console.error('Error importing growth metrics:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}