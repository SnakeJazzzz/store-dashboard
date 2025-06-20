// frontend/app/api/stores/route.ts - FIXED DECIMAL TO PERCENTAGE CONVERSION
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface Store {
  id: string
  suc_sap: string
  sucursal: string
  format: string
  zona: string
  distrito: string
  estado: string
  municipio: string
  ciudad: string
  calle: string | null
  colonia: string | null
  cp: string | null
  lat: number | null
  lon: number | null
  created_at: string
}

interface GrowthMetric {
  store_id: string
  revenue_growth_pct: string | null
  orders_growth_pct: string | null
  ticket_growth_pct: string | null
  year_comparison: string | null
  period: string
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Create Supabase client with user's token for RLS
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

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken)

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 401 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'growth'
    const estado = url.searchParams.get('estado')
    const formato = url.searchParams.get('formato')
    const zona = url.searchParams.get('zona')
    const distrito = url.searchParams.get('distrito')
    const period = url.searchParams.get('period') // Period filter for timeline

    console.log(`🔍 API Request:`, { format, estado, formato, zona, distrito, period })

    // STEP 1: Get all stores with filters
    let storeQuery = supabase
      .from('stores')
      .select(`
        id,
        suc_sap,
        sucursal,
        format,
        zona,
        distrito,
        estado,
        municipio,
        ciudad,
        calle,
        colonia,
        cp,
        lat,
        lon,
        created_at
      `)

    // Apply store filters
    if (estado) storeQuery = storeQuery.eq('estado', estado)
    if (formato) storeQuery = storeQuery.eq('format', formato)
    if (zona) storeQuery = storeQuery.eq('zona', zona)
    if (distrito) storeQuery = storeQuery.eq('distrito', distrito)

    const { data: storesData, error: storesError } = await storeQuery

    if (storesError) {
      console.error('Error fetching stores:', storesError)
      return NextResponse.json({ error: 'Error al obtener tiendas' }, { status: 500 })
    }

    if (!storesData || storesData.length === 0) {
      return NextResponse.json({
        stores: [],
        format,
        total: 0,
        available_periods: []
      })
    }

    console.log(`📊 Fetched ${storesData.length} stores`)

    // STEP 2: Get growth metrics for these stores
    const storeIds = storesData.map((s: Store) => s.id)
    
    let metricsQuery = supabase
      .from('growth_metrics')
      .select('store_id, revenue_growth_pct, orders_growth_pct, ticket_growth_pct, year_comparison, period, created_at')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })

    // Apply period filter if specified
    if (period) {
      metricsQuery = metricsQuery.eq('period', period)
    }

    const { data: metricsData, error: metricsError } = await metricsQuery

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError)
      return NextResponse.json({ error: 'Error al obtener métricas' }, { status: 500 })
    }

    console.log(`📈 Fetched ${metricsData?.length || 0} growth metrics`)

    // STEP 3: Get available periods for timeline (with better grouping)
    const { data: availablePeriods } = await supabase
      .from('growth_metrics')
      .select('period, year_comparison, created_at')
      .in('store_id', storeIds)
      .order('period', { ascending: false })

    // Group periods and get unique ones with metadata
    const periodMap = new Map<string, { year_comparison: string | null; latest_upload: string }>()
    
    availablePeriods?.forEach((p: any) => {
      if (!periodMap.has(p.period) || new Date(p.created_at) > new Date(periodMap.get(p.period)!.latest_upload)) {
        periodMap.set(p.period, {
          year_comparison: p.year_comparison,
          latest_upload: p.created_at
        })
      }
    })

    const uniquePeriods = Array.from(periodMap.entries())
      .map(([periodDate, metadata]) => ({
        period: periodDate,
        year_comparison: metadata.year_comparison,
        display_name: formatPeriodDisplayName(periodDate, metadata.year_comparison),
        latest_upload: metadata.latest_upload
      }))
      .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())

    console.log(`📅 Available periods:`, uniquePeriods)

    // STEP 4: Join stores with their metrics (latest for each store if no period filter)
    const storeMetricsMap = new Map<string, GrowthMetric>()
    
    if (metricsData) {
      // Group metrics by store_id and get the latest for each
      const metricsByStore = new Map<string, GrowthMetric[]>()
      
      metricsData.forEach((metric: GrowthMetric) => {
        const storeId = metric.store_id
        if (!metricsByStore.has(storeId)) {
          metricsByStore.set(storeId, [])
        }
        metricsByStore.get(storeId)!.push(metric)
      })
      
      // For each store, get the latest metric
      metricsByStore.forEach((metrics, storeId) => {
        // Sort by created_at desc and take the first one
        const latestMetric = metrics.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        
        storeMetricsMap.set(storeId, latestMetric)
      })
    }

    // STEP 5: Helper function to safely convert decimal to percentage
    const convertToPercentage = (value: string | null | undefined): number | null => {
      if (!value || value === null || value === 'null' || value === undefined) return null
      
      try {
        const numericValue = parseFloat(value)
        if (isNaN(numericValue)) return null
        
        // MAIN FIX: Convert decimal to percentage
        // 0.157 becomes 15.7%, -0.109 becomes -10.9%
        return Math.round(numericValue * 100 * 100) / 100 // Round to 2 decimal places
      } catch {
        return null
      }
    }

    // STEP 6: Combine stores with their metrics
    const transformedStores = storesData.map((store: Store) => {
      const metric = storeMetricsMap.get(store.id)
      
      // Convert decimal metrics to percentages
      const revenueGrowthPct = convertToPercentage(metric?.revenue_growth_pct)
      const ordersGrowthPct = convertToPercentage(metric?.orders_growth_pct)
      const ticketGrowthPct = convertToPercentage(metric?.ticket_growth_pct)
      
      return {
        id: store.id,
        suc_sap: store.suc_sap,
        sucursal: store.sucursal,
        formato: store.format,           // DB 'format' → Frontend 'formato'
        zona: store.zona,
        distrito: store.distrito,
        estado: store.estado,
        municipio: store.municipio,
        ciudad: store.ciudad,
        calle: store.calle,
        colonia: store.colonia,
        cp: store.cp,
        lat: store.lat,
        lon: store.lon,
        created_at: store.created_at,
        // FIXED: Convert decimals to percentages
        revenue_growth_pct: revenueGrowthPct,
        orders_growth_pct: ordersGrowthPct,
        ticket_growth_pct: ticketGrowthPct,
        year_comparison: metric?.year_comparison || null,
        metric_period: metric?.period || null,
        // Absolute metrics (set to null for growth format)
        ventas: null,
        ordenes: null,
        tickets: null,
        // Debug info
        _debug: {
          raw_revenue: metric?.revenue_growth_pct,
          converted_revenue: revenueGrowthPct,
          has_metric: !!metric
        }
      }
    })

    // STEP 7: Enhanced debugging
    const storesWithKPIs = transformedStores.filter((s: any) => s.revenue_growth_pct !== null)
    console.log(`✅ Final result: ${storesWithKPIs.length}/${transformedStores.length} stores with KPIs`)

    // Debug A828 specifically
    const storeA828 = transformedStores.find((s: any) => s.suc_sap === 'A828')
    if (storeA828) {
      console.log('🎯 Store A828 final data:', {
        revenue_growth_pct: storeA828.revenue_growth_pct,
        orders_growth_pct: storeA828.orders_growth_pct,
        ticket_growth_pct: storeA828.ticket_growth_pct,
        year_comparison: storeA828.year_comparison,
        metric_period: storeA828.metric_period,
        debug: storeA828._debug
      })
    }

    // Sample different stores to check for variety
    const sampleStores = transformedStores
      .filter((s: any) => s.revenue_growth_pct !== null)
      .slice(0, 10)
      .map((s: any) => ({
        suc_sap: s.suc_sap,
        revenue_growth_pct: s.revenue_growth_pct,
        raw_value: s._debug?.raw_revenue
      }))
    
    console.log('📊 Sample stores with converted percentages:', sampleStores)

    // Check for suspicious patterns (too many similar values)
    const growthValues = storesWithKPIs.map((s: any) => s.revenue_growth_pct)
    const uniqueGrowthValues = [...new Set(growthValues)]
    
    if (uniqueGrowthValues.length < growthValues.length * 0.1) {
      console.warn('⚠️ WARNING: Suspiciously few unique growth values detected:', {
        total_stores: growthValues.length,
        unique_values: uniqueGrowthValues.length,
        sample_values: uniqueGrowthValues.slice(0, 10)
      })
    }

    // Clean up debug info for production
    const cleanedStores = transformedStores.map((store: any) => {
      const { _debug, ...cleanStore } = store
      return cleanStore
    })

    return NextResponse.json({
      stores: cleanedStores,
      format,
      total: cleanedStores.length,
      available_periods: uniquePeriods,
      selected_period: period,
      debug: {
        stores_with_kpis: storesWithKPIs.length,
        total_metrics_found: metricsData?.length || 0,
        unique_growth_values: uniqueGrowthValues.length,
        sample_conversions: sampleStores.slice(0, 5),
        a828_store: storeA828 ? {
          suc_sap: storeA828.suc_sap,
          revenue_growth_pct: storeA828.revenue_growth_pct,
          raw_value: storeA828._debug?.raw_revenue
        } : null
      }
    })

  } catch (error) {
    console.error('Error in stores API:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to format period display names
function formatPeriodDisplayName(period: string, yearComparison: string | null): string {
  try {
    const date = new Date(period)
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    
    if (yearComparison) {
      return `${month} ${year} (${yearComparison})`
    }
    
    return `${month} ${year}`
  } catch {
    return period
  }
}