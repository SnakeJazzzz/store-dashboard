// app/api/stores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Query stores with RLS automatically filtering by user
    let query = supabase
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

    // Apply filters
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (formato) {
      query = query.eq('format', formato)
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

    // Transform data for frontend
    const transformedStores = stores?.map(store => ({
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
      // Metrics set to null for now (will be added later)
      revenue_growth_pct: null,
      orders_growth_pct: null,
      ticket_growth_pct: null,
      year_comparison: null,
      metric_period: null,
      ventas: null,
      ordenes: null,
      tickets: null
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