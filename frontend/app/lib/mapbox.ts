// frontend/app/lib/mapbox.ts
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

// Obtener color basado en growth percentage
export const getGrowthColor = (growth: number): string => {
  if (growth > 10) return '#22c55e'      // Verde fuerte (excelente)
  if (growth > 5) return '#84cc16'       // Verde claro (bueno) 
  if (growth > 0) return '#eab308'       // Amarillo (neutro)
  if (growth > -5) return '#f97316'      // Naranja (malo)
  return '#ef4444'                       // Rojo (muy malo)
}

// Configuración de clustering
export const CLUSTER_CONFIG = {
  maxZoom: 14,
  radius: 50
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

// Funciones para geocoding (futuro uso)
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

// Colores para diferentes tipos de formato
export const getFormatColor = (formato: string): string => {
  const formatColors: Record<string, string> = {
    'Coppel': '#3b82f6',      // Azul
    'Devlyn': '#10b981',      // Verde
    'Coppel Canada': '#f59e0b', // Amarillo
    'Digital': '#8b5cf6',     // Púrpura
  }
  
  return formatColors[formato] || '#6b7280' // Gris por defecto
}

// Función para filtrar stores por región geográfica
export const filterStoresByRegion = (stores: Store[], region: string): Store[] => {
  const regionStates: Record<string, string[]> = {
    'Norte': ['Chihuahua', 'Coahuila', 'Nuevo León', 'Tamaulipas', 'Sonora', 'Sinaloa'],
    'Centro': ['Ciudad de México', 'México', 'Morelos', 'Hidalgo', 'Tlaxcala', 'Puebla'],
    'Sur': ['Oaxaca', 'Chiapas', 'Guerrero', 'Veracruz', 'Tabasco', 'Campeche'],
    'Occidente': ['Jalisco', 'Michoacán', 'Colima', 'Nayarit', 'Aguascalientes', 'Zacatecas']
  }
  
  const states = regionStates[region] || []
  return stores.filter(store => states.includes(store.estado))
}

// Debug: Log información útil del mapa
export const logMapInfo = (stores: Store[]) => {
  const stats = getStoreStats(stores)
  
  console.group('🗺️ Map Information')
  console.log(`Total stores: ${stats.total}`)
  console.log(`With coordinates: ${stats.withCoordinates} (${stats.coordinatesCoverage}%)`)
  console.log(`Need geocoding: ${stats.withoutCoordinates}`)
  
  if (stats.withCoordinates > 0) {
    const bounds = getStoresBounds(stores)
    if (bounds) {
      console.log(`Geographic bounds:`, bounds)
    }
  }
  
  // Estados únicos
  const uniqueStates = [...new Set(stores.map(s => s.estado))].sort()
  console.log(`States covered: ${uniqueStates.length}`, uniqueStates)
  
  // Formatos únicos
  const uniqueFormatos = [...new Set(stores.map(s => s.formato))].sort()
  console.log(`Formats: ${uniqueFormatos.length}`, uniqueFormatos)
  
  console.groupEnd()
}