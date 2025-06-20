// frontend/app/api/geocode/route.ts - OPTIMIZED VERSION
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
    const { 
      batchSize = 100,  // Increased default batch size
      dryRun = false,
      mode = 'smart'    // New: 'smart', 'all', or 'batch'
    } = body

    console.log(`🗺️ Starting geocoding process for user: ${user.email}`)

    // STEP 1: Find stores without coordinates
    const { data: storesWithoutCoords, error: storesError } = await supabase
      .from('stores')
      .select('id, suc_sap, sucursal, calle, colonia, ciudad, estado, cp, lat, lon')
      .or('lat.is.null,lon.is.null')
      .eq('user_id', user.id)

    if (storesError) {
      console.error('Error fetching stores:', storesError)
      return NextResponse.json({ error: 'Error al obtener tiendas' }, { status: 500 })
    }

    const storesToGeocode = storesWithoutCoords || []
    console.log(`📍 Found ${storesToGeocode.length} stores without coordinates`)

    if (storesToGeocode.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All stores already have coordinates! 🎉',
        processed: 0,
        errors: 0,
        recommendations: [
          'Your map should now display all stores',
          'Future CSV uploads will only geocode new stores',
          'Geocoding setup is complete!'
        ]
      })
    }

    // SMART MODE: Process all stores if it's the first time (< 600 stores)
    // or use batch mode for incremental updates
    let processStores = storesToGeocode
    if (mode === 'smart') {
      if (storesToGeocode.length <= 600) {
        // First-time setup: process all stores
        processStores = storesToGeocode
        console.log(`🚀 SMART MODE: Processing all ${storesToGeocode.length} stores (first-time setup)`)
      } else {
        // Incremental mode: use batch size
        processStores = storesToGeocode.slice(0, batchSize)
        console.log(`🔄 SMART MODE: Processing batch of ${processStores.length} stores`)
      }
    } else if (mode === 'batch') {
      processStores = storesToGeocode.slice(0, batchSize)
    }
    // mode === 'all': processStores = storesToGeocode (already set)

    console.log(`🔄 Processing ${processStores.length} stores`)

    if (dryRun) {
      // Return what would be processed without actually doing it
      return NextResponse.json({
        dryRun: true,
        mode: mode,
        totalStoresWithoutCoords: storesToGeocode.length,
        willProcess: processStores.length,
        estimatedTime: `${Math.ceil(processStores.length / 10)} seconds`,
        costEstimate: `${processStores.length} API calls (${Math.round(processStores.length / 1000 * 100) / 100}% of free tier)`,
        sampleStores: processStores.slice(0, 5).map(s => ({
          suc_sap: s.suc_sap,
          address: buildFullAddress(s),
          current_coords: { lat: s.lat, lon: s.lon }
        })),
        recommendations: storesToGeocode.length <= 600 ? 
          ['Use mode: "smart" to process all stores at once (recommended for first setup)'] :
          ['Large dataset detected. Consider using batch mode for incremental processing.']
      })
    }

    // STEP 2: Geocode each store
    const results: GeocodeResult[] = []
    const errors: string[] = []
    let successCount = 0

    console.log(`🔍 Starting geocoding of ${processStores.length} stores...`)
    const startTime = Date.now()

    for (let i = 0; i < processStores.length; i++) {
      const store = processStores[i]
      
      try {
        console.log(`🏪 [${i + 1}/${processStores.length}] Processing: ${store.suc_sap} - ${store.sucursal}`)
        
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
          // Update store coordinates - NOW WITH PROPER updated_at COLUMN
          const { error: updateError } = await supabase
            .from('stores')
            .update({
              lat: geocodeResult.lat,
              lon: geocodeResult.lon,
              updated_at: new Date().toISOString()
            })
            .eq('id', store.id)

          if (updateError) {
            console.error(`❌ Error updating store ${store.suc_sap}:`, updateError)
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
            console.log(`✅ [${i + 1}/${processStores.length}] Success: ${store.suc_sap} → ${geocodeResult.lat}, ${geocodeResult.lon}`)
          }
        } else {
          results.push({
            store_id: store.id,
            suc_sap: store.suc_sap,
            success: false,
            error: geocodeResult.error || 'Geocoding failed'
          })
          console.log(`❌ [${i + 1}/${processStores.length}] Failed: ${store.suc_sap} - ${geocodeResult.error}`)
        }

        // Rate limiting: 100ms between requests (10 requests/second)
        await sleep(100)

        // Progress update every 50 stores
        if ((i + 1) % 50 === 0) {
          const elapsed = Date.now() - startTime
          const rate = (i + 1) / (elapsed / 1000)
          const eta = (processStores.length - i - 1) / rate
          console.log(`📊 Progress: ${i + 1}/${processStores.length} (${Math.round((i + 1) / processStores.length * 100)}%) | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta)}s`)
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          store_id: store.id,
          suc_sap: store.suc_sap,
          success: false,
          error: errorMsg
        })
        errors.push(`Store ${store.suc_sap}: ${errorMsg}`)
        console.error(`💥 Error processing store ${store.suc_sap}:`, error)
      }
    }

    // STEP 3: Calculate final statistics
    const totalTime = Date.now() - startTime
    const remaining = storesToGeocode.length - processStores.length
    const isComplete = remaining === 0

    const response = {
      success: true,
      mode: mode,
      processed: processStores.length,
      successful: successCount,
      failed: processStores.length - successCount,
      remaining: remaining,
      total_without_coords: storesToGeocode.length,
      completion_percentage: Math.round((successCount / storesToGeocode.length) * 100),
      results: results,
      errors: errors.slice(0, 10), // Limit error list
      performance: {
        total_time_seconds: Math.round(totalTime / 1000),
        rate_per_second: Math.round((processStores.length / totalTime) * 1000),
        mapbox_calls_used: processStores.length
      },
      nextBatchRecommended: !isComplete && mode !== 'all',
      isComplete: isComplete,
      recommendations: isComplete ? [
        '🎉 Geocoding complete! All stores now have coordinates.',
        '🗺️ Your map should display all stores.',
        '📊 Future CSV uploads will only geocode new stores.',
        '🔄 Refresh your dashboard to see the updated map.'
      ] : [
        `⏭️ ${remaining} stores remaining to geocode.`,
        '🔄 Run geocoding again to process remaining stores.',
        `📊 ${Math.round((successCount / storesToGeocode.length) * 100)}% complete.`
      ]
    }

    console.log(`🎯 Geocoding batch complete: ${successCount}/${processStores.length} successful`)
    if (isComplete) {
      console.log(`🏆 ALL GEOCODING COMPLETE! ${successCount} stores now have coordinates.`)
    }
    
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