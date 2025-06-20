// frontend/app/lib/mapbox.ts - ENHANCED VERSION WITH BETTER COLORS
import type { Store } from '../types/map'

export const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

// Centro de México para el mapa inicial
export const MEXICO_CENTER: [number, number] = [-102.5528, 23.6345]
export const MEXICO_ZOOM = 5

// Convertir stores a GeoJSON
export const storesToGeoJSON = (stores: Store[]) => {
  return {
    type: 'FeatureCollection' as const,
    features: stores
      .filter(store => store.lat && store.lon) // Solo stores con coordenadas
      .map(store => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [store.lon!, store.lat!]
        },
        properties: {
          id: store.id,
          suc_sap: store.suc_sap,
          sucursal: store.sucursal,
          formato: store.formato,
          zona: store.zona,
          estado: store.estado,
          ciudad: store.ciudad,
          calle: store.calle,
          colonia: store.colonia,
          revenue_growth: store.revenue_growth_pct || 0,
          orders_growth: store.orders_growth_pct || 0,
          ticket_growth: store.ticket_growth_pct || 0
        }
      }))
  }
}

// ENHANCED: Better gradient color system for growth percentages
export const getGrowthColor = (growth: number): string => {
  // Enhanced red-to-green gradient with more nuanced colors
  if (growth > 15) return '#10b981'       // Emerald 500 (excellent)
  if (growth > 10) return '#22c55e'       // Green 500 (very good)
  if (growth > 5) return '#65a30d'        // Lime 600 (good)
  if (growth > 2) return '#84cc16'        // Lime 500 (positive)
  if (growth > 0) return '#eab308'        // Yellow 500 (neutral positive)
  if (growth > -2) return '#f59e0b'       // Amber 500 (neutral negative)
  if (growth > -5) return '#f97316'       // Orange 500 (concerning)
  if (growth > -10) return '#dc2626'      // Red 600 (bad)
  return '#991b1b'                        // Red 800 (critical)
}

// Enhanced format colors with brand-appropriate colors
export const getFormatColor = (formato: string): string => {
  const formatColors: Record<string, string> = {
    'Coppel': '#1e40af',        // Blue 800 (corporate blue)
    'Devlyn': '#059669',        // Emerald 600 (professional green)
    'Sears': '#dc2626',         // Red 600 (classic red)
    'Coppel Canada': '#7c3aed', // Violet 600 (purple variant)
    'Digital': '#8b5cf6',       // Purple 500 (tech purple)
    'Default': '#6b7280'        // Gray 500 (neutral)
  }
  
  return formatColors[formato] || formatColors['Default']
}

// Enhanced cluster colors with better visibility
export const CLUSTER_CONFIG = {
  maxZoom: 14,
  radius: 50,
  colors: {
    small: '#3b82f6',    // Blue 500 (< 10 stores)
    medium: '#8b5cf6',   // Purple 500 (10-30 stores)  
    large: '#ef4444'     // Red 500 (> 30 stores)
  }
}

// Función para calcular estadísticas de stores
export const getStoreStats = (stores: Store[]) => {
  const withCoords = stores.filter(s => s.lat && s.lon)
  const withoutCoords = stores.filter(s => !s.lat || !s.lon)
  
  return {
    total: stores.length,
    withCoordinates: withCoords.length,
    withoutCoordinates: withoutCoords.length,
    coordinatesCoverage: Math.round((withCoords.length / stores.length) * 100)
  }
}

// ENHANCED: Performance analysis functions
export const getPerformanceStats = (stores: Store[]) => {
  const validStores = stores.filter(s => s.revenue_growth_pct !== null)
  
  if (validStores.length === 0) return null
  
  const growthValues = validStores.map(s => s.revenue_growth_pct!)
  const avgGrowth = growthValues.reduce((sum, val) => sum + val, 0) / growthValues.length
  
  const performanceBuckets = {
    excellent: validStores.filter(s => s.revenue_growth_pct! > 10).length,
    good: validStores.filter(s => s.revenue_growth_pct! > 5 && s.revenue_growth_pct! <= 10).length,
    neutral: validStores.filter(s => s.revenue_growth_pct! > 0 && s.revenue_growth_pct! <= 5).length,
    poor: validStores.filter(s => s.revenue_growth_pct! <= 0).length
  }
  
  return {
    avgGrowth: Math.round(avgGrowth * 100) / 100,
    total: validStores.length,
    buckets: performanceBuckets,
    topPerformers: validStores
      .sort((a, b) => (b.revenue_growth_pct || 0) - (a.revenue_growth_pct || 0))
      .slice(0, 5),
    bottomPerformers: validStores
      .sort((a, b) => (a.revenue_growth_pct || 0) - (b.revenue_growth_pct || 0))
      .slice(0, 5)
  }
}

// Función para obtener el centro geográfico de un conjunto de stores
export const getStoresBounds = (stores: Store[]): [[number, number], [number, number]] | null => {
  const validStores = stores.filter(s => s.lat && s.lon)
  
  if (validStores.length === 0) return null
  
  const lats = validStores.map(s => s.lat!)
  const lons = validStores.map(s => s.lon!)
  
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  
  return [[minLon, minLat], [maxLon, maxLat]]
}

// Funciones para geocoding
export const needsGeocoding = (stores: Store[]): Store[] => {
  return stores.filter(store => 
    !store.lat || 
    !store.lon || 
    store.lat === null || 
    store.lon === null
  )
}

// Función para construir dirección completa para geocoding
export const buildFullAddress = (store: Store): string => {
  const parts = []
  
  if (store.calle) parts.push(store.calle)
  if (store.colonia) parts.push(store.colonia)
  if (store.ciudad) parts.push(store.ciudad)
  if (store.estado) parts.push(store.estado)
  if (store.cp) parts.push(store.cp)
  
  return parts.join(', ')
}

// ENHANCED: Regional analysis
export const filterStoresByRegion = (stores: Store[], region: string): Store[] => {
  const regionStates: Record<string, string[]> = {
    'Norte': ['Chihuahua', 'Coahuila', 'Nuevo León', 'Tamaulipas', 'Sonora', 'Sinaloa', 'Durango', 'Baja California', 'Baja California Sur'],
    'Centro': ['Ciudad de México', 'México', 'Morelos', 'Hidalgo', 'Tlaxcala', 'Puebla', 'Querétaro', 'Aguascalientes', 'Guanajuato'],
    'Sur': ['Oaxaca', 'Chiapas', 'Guerrero', 'Veracruz', 'Tabasco', 'Campeche', 'Yucatán', 'Quintana Roo'],
    'Occidente': ['Jalisco', 'Michoacán', 'Colima', 'Nayarit', 'Zacatecas', 'San Luis Potosí']
  }
  
  const states = regionStates[region] || []
  return stores.filter(store => states.includes(store.estado))
}

// ENHANCED: Format analysis
export const getFormatAnalysis = (stores: Store[]) => {
  const formatStats: Record<string, {
    count: number,
    avgGrowth: number,
    stores: Store[]
  }> = {}
  
  stores.forEach(store => {
    if (!formatStats[store.formato]) {
      formatStats[store.formato] = {
        count: 0,
        avgGrowth: 0,
        stores: []
      }
    }
    
    formatStats[store.formato].count++
    formatStats[store.formato].stores.push(store)
    
    if (store.revenue_growth_pct !== null) {
      formatStats[store.formato].avgGrowth += store.revenue_growth_pct
    }
  })
  
  // Calculate averages
  Object.keys(formatStats).forEach(format => {
    const validStores = formatStats[format].stores.filter(s => s.revenue_growth_pct !== null)
    if (validStores.length > 0) {
      formatStats[format].avgGrowth = formatStats[format].avgGrowth / validStores.length
    }
  })
  
  return formatStats
}

// Debug: Enhanced logging with performance insights
export const logMapInfo = (stores: Store[]) => {
  const stats = getStoreStats(stores)
  const performanceStats = getPerformanceStats(stores)
  const formatAnalysis = getFormatAnalysis(stores)
  
  console.group('🗺️ Enhanced Map Information')
  console.log(`📊 Store Overview:`)
  console.log(`  Total stores: ${stats.total}`)
  console.log(`  With coordinates: ${stats.withCoordinates} (${stats.coordinatesCoverage}%)`)
  console.log(`  Need geocoding: ${stats.withoutCoordinates}`)
  
  if (performanceStats) {
    console.log(`📈 Performance Overview:`)
    console.log(`  Average growth: ${performanceStats.avgGrowth}%`)
    console.log(`  Excellent (>10%): ${performanceStats.buckets.excellent}`)
    console.log(`  Good (5-10%): ${performanceStats.buckets.good}`)
    console.log(`  Neutral (0-5%): ${performanceStats.buckets.neutral}`)
    console.log(`  Poor (<0%): ${performanceStats.buckets.poor}`)
  }
  
  console.log(`🏢 Format Analysis:`)
  Object.entries(formatAnalysis).forEach(([format, stats]) => {
    console.log(`  ${format}: ${stats.count} stores (avg: ${stats.avgGrowth.toFixed(1)}%)`)
  })
  
  if (stats.withCoordinates > 0) {
    const bounds = getStoresBounds(stores)
    if (bounds) {
      console.log(`🌎 Geographic bounds:`, bounds)
    }
  }
  
  // Estados únicos
  const uniqueStates = [...new Set(stores.map(s => s.estado))].sort()
  console.log(`🏛️ States covered: ${uniqueStates.length}`, uniqueStates)
  
  console.groupEnd()
}