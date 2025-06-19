// frontend/app/types/map.ts
export interface Store {
    id: string
    suc_sap: string
    sucursal: string
    formato: string
    zona: string
    distrito: string
    estado: string
    municipio: string
    ciudad: string
    calle: string | null
    colonia: string | null
    cp: string | null                        // ← Agregado: Código postal
    lat: number | null
    lon: number | null
    revenue_growth_pct: number | null
    orders_growth_pct: number | null
    ticket_growth_pct: number | null
    year_comparison?: string
    metric_period?: string
    // Campos adicionales que pueden venir de la API
    ventas?: number | null                   // Para absolute metrics
    ordenes?: number | null                  // Para absolute metrics  
    tickets?: number | null                  // Para absolute metrics
    created_at?: string
    updated_at?: string
    first_seen?: string
    last_seen?: string
  }
  
  export interface MapFilters {
    estado?: string
    formato?: string
    zona?: string
    distrito?: string
    metricType?: 'growth' | 'absolute'
  }
  
  export interface StorePopupProps {
    store: Store
    onClose: () => void
  }
  
  export interface MapContainerProps {
    stores: Store[]
    onStoreClick: (store: Store) => void
    selectedStore: Store | null
  }
  
  export interface FilterSidebarProps {
    filters: MapFilters
    onFiltersChange: (filters: MapFilters) => void
    stores: Store[]
  }
  
  // Tipos para geocoding (futuro uso)
  export interface GeocodeRequest {
    id: string
    address: string
    store: Store
  }
  
  export interface GeocodeResponse {
    success: boolean
    lat?: number
    lon?: number
    error?: string
  }
  
  export interface MapboxGeocodeResult {
    features: Array<{
      center: [number, number]
      place_name: string
      relevance: number
    }>
  }
  
  // Tipos para estadísticas del mapa
  export interface MapStats {
    total: number
    withCoordinates: number
    withoutCoordinates: number
    coordinatesCoverage: number
  }
  
  // Tipos para regiones geográficas
  export type GeographicRegion = 'Norte' | 'Centro' | 'Sur' | 'Occidente'
  
  // Tipos para formato de colores
  export interface ColorMapping {
    [key: string]: string
  }