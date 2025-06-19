// app/api/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface MapboxGeocodeResponse {
  features: Array<{
    center: [number, number]
    place_name: string
    relevance: number
    context?: Array<{
      id: string
      text: string
    }>
  }>
}

interface GeocodeResult {
  store_id: string
  suc_sap: string
  success: boolean
  lat?: number
  lon?: number
  address_used?: string
  mapbox_result?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Create authenticated Supabase client
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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { batchSize = 50, dryRun = false } = body

    console.log(`🗺️ Starting geocoding process for user: ${user.email}`)

    // STEP 1: Find stores without coordinates
    const { data: storesWithoutCoords, error: storesError } = await supabase
      .from('stores')
      .select('id, suc_sap, sucursal, calle, colonia, ciudad, estado, cp, lat, lon')
      .or('lat.is.null,lon.is.null')

    if (storesError) {
      console.error('Error fetching stores:', storesError)
      return NextResponse.json({ error: 'Error al obtener tiendas' }, { status: 500 })
    }

    const storesToGeocode = storesWithoutCoords || []
    console.log(`📍 Found ${storesToGeocode.length} stores without coordinates`)

    if (storesToGeocode.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All stores already have coordinates',
        processed: 0,
        errors: 0
      })
    }

    // Limit batch size to avoid rate limits and timeouts
    const processStores = storesToGeocode.slice(0, Math.min(batchSize, storesToGeocode.length))
    console.log(`🔄 Processing batch of ${processStores.length} stores`)

    if (dryRun) {
      // Return what would be processed without actually doing it
      return NextResponse.json({
        dryRun: true,
        totalStoresWithoutCoords: storesToGeocode.length,
        sampleStores: processStores.slice(0, 5).map(s => ({
          suc_sap: s.suc_sap,
          address: buildFullAddress(s),
          current_coords: { lat: s.lat, lon: s.lon }
        })),
        batchSize: processStores.length
      })
    }

    // STEP 2: Geocode each store
    const results: GeocodeResult[] = []
    const errors: string[] = []
    let successCount = 0

    for (const store of processStores) {
      try {
        console.log(`🏪 Processing: ${store.suc_sap} - ${store.sucursal}`)
        
        const address = buildFullAddress(store)
        console.log(`📍 Address: ${address}`)

        if (!address.trim()) {
          results.push({
            store_id: store.id,
            suc_sap: store.suc_sap,
            success: false,
            error: 'No address data available'
          })
          continue
        }

        // Call Mapbox Geocoding API
        const geocodeResult = await geocodeAddress(address)

        if (geocodeResult.success && geocodeResult.lat && geocodeResult.lon) {
          // Update store coordinates
          const { error: updateError } = await supabase
            .from('stores')
            .update({
              lat: geocodeResult.lat,
              lon: geocodeResult.lon,
              updated_at: new Date().toISOString()
            })
            .eq('id', store.id)

          if (updateError) {
            console.error(`Error updating store ${store.suc_sap}:`, updateError)
            results.push({
              store_id: store.id,
              suc_sap: store.suc_sap,
              success: false,
              error: `Database update failed: ${updateError.message}`
            })
          } else {
            results.push({
              store_id: store.id,
              suc_sap: store.suc_sap,
              success: true,
              lat: geocodeResult.lat,
              lon: geocodeResult.lon,
              address_used: address,
              mapbox_result: geocodeResult.place_name
            })
            successCount++
            console.log(`✅ Success: ${store.suc_sap} → ${geocodeResult.lat}, ${geocodeResult.lon}`)
          }
        } else {
          results.push({
            store_id: store.id,
            suc_sap: store.suc_sap,
            success: false,
            error: geocodeResult.error || 'Geocoding failed'
          })
          console.log(`❌ Failed: ${store.suc_sap} - ${geocodeResult.error}`)
        }

        // Rate limiting: 100ms between requests (10 requests/second)
        await sleep(100)

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          store_id: store.id,
          suc_sap: store.suc_sap,
          success: false,
          error: errorMsg
        })
        errors.push(`Store ${store.suc_sap}: ${errorMsg}`)
        console.error(`Error processing store ${store.suc_sap}:`, error)
      }
    }

    // STEP 3: Return summary
    const response = {
      success: true,
      processed: processStores.length,
      successful: successCount,
      failed: processStores.length - successCount,
      remaining: storesToGeocode.length - processStores.length,
      results: results,
      errors: errors.slice(0, 10), // Limit error list
      nextBatchRecommended: storesToGeocode.length > processStores.length
    }

    console.log(`🎯 Geocoding batch complete: ${successCount}/${processStores.length} successful`)
    
    return NextResponse.json(response)

  } catch (error) {
    console.error('Geocoding API error:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to build full address
function buildFullAddress(store: any): string {
  const parts = []
  
  if (store.calle) parts.push(store.calle)
  if (store.colonia) parts.push(store.colonia)
  if (store.ciudad) parts.push(store.ciudad)
  if (store.estado) parts.push(store.estado)
  if (store.cp) parts.push(store.cp)
  
  // Add "México" for better geocoding
  parts.push('México')
  
  return parts.join(', ')
}

// Geocode a single address using Mapbox
async function geocodeAddress(address: string): Promise<{
  success: boolean
  lat?: number
  lon?: number
  place_name?: string
  error?: string
}> {
  try {
    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!
    
    // URL encode the address
    const encodedAddress = encodeURIComponent(address)
    
    // Mapbox Geocoding API
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&country=mx&limit=1`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      return {
        success: false,
        error: `Mapbox API error: ${response.status} ${response.statusText}`
      }
    }
    
    const data: MapboxGeocodeResponse = await response.json()
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const [lon, lat] = feature.center
      
      // Verify it's a reasonable location (within Mexico bounds)
      if (lat >= 14.5 && lat <= 32.7 && lon >= -118.4 && lon <= -86.7) {
        return {
          success: true,
          lat: lat,
          lon: lon,
          place_name: feature.place_name
        }
      } else {
        return {
          success: false,
          error: `Location outside Mexico bounds: ${lat}, ${lon}`
        }
      }
    } else {
      return {
        success: false,
        error: 'No results found'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

// Simple sleep function for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}