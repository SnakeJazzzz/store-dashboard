// app/api/stores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../lib/supabaseClient'


export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 401 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'growth' // 'growth' or 'absolute'
    const estado = url.searchParams.get('estado')
    const formato = url.searchParams.get('formato')
    const zona = url.searchParams.get('zona')
    const distrito = url.searchParams.get('distrito')

    let query = supabase
      .from(format === 'growth' ? 'stores_with_latest_growth' : 'stores_with_latest_absolute')
      .select('*')
      .eq('user_id', user.id)

    // Apply filters
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (formato) {
      query = query.eq('formato', formato)
    }
    if (zona) {
      query = query.eq('zona', zona)
    }
    if (distrito) {
      query = query.eq('distrito', distrito)
    }

    const { data: stores, error } = await query

    if (error) {
      console.error('Error fetching stores:', error)
      return NextResponse.json({ error: 'Error al obtener tiendas' }, { status: 500 })
    }

    // Transform data for map visualization
    const transformedStores = stores?.map(store => ({
      id: store.id,
      suc_sap: store.suc_sap,
      sucursal: store.sucursal,
      formato: store.formato,
      zona: store.zona,
      distrito: store.distrito,
      estado: store.estado,
      municipio: store.municipio,
      ciudad: store.ciudad,
      calle: store.calle,
      colonia: store.colonia,
      lat: store.lat,
      lon: store.lon,
      // Include metrics based on format
      ...(format === 'growth' ? {
        revenue_growth_pct: store.revenue_growth_pct,
        orders_growth_pct: store.orders_growth_pct,
        ticket_growth_pct: store.ticket_growth_pct,
        year_comparison: store.year_comparison,
        metric_period: store.metric_period
      } : {
        ventas: store.ventas,
        ordenes: store.ordenes,
        tickets: store.tickets,
        metric_period: store.metric_period
      })
    })) || []

    return NextResponse.json({
      stores: transformedStores,
      format,
      total: transformedStores.length
    })

  } catch (error) {
    console.error('Error in stores API:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}