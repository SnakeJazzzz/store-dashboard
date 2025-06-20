// frontend/app/components/map/MapDashboard.tsx - OPTIMIZED (Fewer API Calls)
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Store, MapFilters } from '../../types/map'
import MapContainer from './MapContainer'
import FilterSidebar from './FilterSidebar'
import StorePopup from './StorePopup'
import TimelineFilter from './TimelineFilter'

interface Period {
  period: string
  year_comparison: string | null
  display_name: string
}

interface APIResponse {
  stores: Store[]
  format: string
  total: number
  available_periods: Period[]
  selected_period: string | null
  debug?: any
}

export default function MapDashboard() {
  const [stores, setStores] = useState<Store[]>([])
  const [filteredStores, setFilteredStores] = useState<Store[]>([])
  const [filters, setFilters] = useState<MapFilters>({ metricType: 'growth' })
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [availablePeriods, setAvailablePeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Refs to prevent multiple simultaneous API calls
  const isLoadingRef = useRef(false)
  const lastLoadParamsRef = useRef<string>('')

  // Memoized load function to prevent unnecessary re-renders
  const loadStores = useCallback(async () => {
    // Create a unique key for current load parameters
    const loadKey = JSON.stringify({
      metricType: filters.metricType,
      period: selectedPeriod
    })

    // Prevent duplicate calls
    if (isLoadingRef.current || lastLoadParamsRef.current === loadKey) {
      console.log('⏭️ Skipping duplicate API call for:', loadKey)
      return
    }

    try {
      isLoadingRef.current = true
      lastLoadParamsRef.current = loadKey
      setLoading(true)
      setError(null)

      console.log(`🔄 Loading stores with:`, { 
        format: filters.metricType, 
        period: selectedPeriod 
      })

      // Get auth token
      const { data: { session } } = await (await import('../../lib/supabaseClient')).supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No hay sesión activa')
      }

      // Build query params including period
      const params = new URLSearchParams({
        format: filters.metricType || 'growth'
      })

      if (selectedPeriod) {
        params.append('period', selectedPeriod)
      }

      // Fetch stores
      const response = await fetch(`/api/stores?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al cargar tiendas')
      }

      const data: APIResponse = await response.json()
      
      console.log(`✅ API Response received:`, {
        stores_count: data.stores?.length || 0,
        available_periods: data.available_periods?.length || 0,
        selected_period: data.selected_period,
        stores_with_kpis: data.stores?.filter(s => s.revenue_growth_pct !== null)?.length || 0
      })

      // Update state
      setStores(data.stores || [])
      setAvailablePeriods(data.available_periods || [])
      
      // Debug: Check conversion results
      const storeA828 = data.stores?.find(s => s.suc_sap === 'A828')
      if (storeA828) {
        console.log(`🎯 Store A828 converted:`, {
          revenue_growth_pct: storeA828.revenue_growth_pct,
          should_be_15_7: storeA828.revenue_growth_pct === 15.7,
          metric_period: storeA828.metric_period
        })
      }

      // Debug: Check for value variety
      const growthValues = data.stores?.map(s => s.revenue_growth_pct).filter(v => v !== null) || []
      const uniqueValues = [...new Set(growthValues)]
      console.log(`📊 Growth value variety:`, {
        total_values: growthValues.length,
        unique_values: uniqueValues.length,
        variety_ratio: Math.round((uniqueValues.length / growthValues.length) * 100),
        sample_values: uniqueValues.slice(0, 10)
      })
      
    } catch (err) {
      console.error('Error loading stores:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [filters.metricType, selectedPeriod])

  // Load stores when dependencies change
  useEffect(() => {
    loadStores()
  }, [loadStores])

  // Apply client-side filters to stores (memoized)
  const applyFilters = useCallback(() => {
    let filtered = [...stores]

    // Filter by estado
    if (filters.estado) {
      filtered = filtered.filter(store => store.estado === filters.estado)
    }

    // Filter by formato
    if (filters.formato) {
      filtered = filtered.filter(store => store.formato === filters.formato)
    }

    // Filter by zona
    if (filters.zona) {
      filtered = filtered.filter(store => store.zona === filters.zona)
    }

    // Only show stores with coordinates
    filtered = filtered.filter(store => store.lat && store.lon)

    setFilteredStores(filtered)
    
    console.log(`🔍 Filters applied:`, {
      total_stores: stores.length,
      filtered_stores: filtered.length,
      with_coordinates: filtered.length,
      with_kpis: filtered.filter(s => s.revenue_growth_pct !== null).length,
      filters_active: Object.keys(filters).filter(k => filters[k as keyof MapFilters] && k !== 'metricType').length
    })
  }, [stores, filters])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleStoreClick = useCallback((store: Store) => {
    setSelectedStore(store)
  }, [])

  const handleClosePopup = useCallback(() => {
    setSelectedStore(null)
  }, [])

  const handlePeriodChange = useCallback((period: string | null) => {
    console.log(`📅 Period changing from "${selectedPeriod}" to "${period}"`)
    setSelectedPeriod(period)
    // loadStores will be called automatically by useEffect
  }, [selectedPeriod])

  const handleFiltersChange = useCallback((newFilters: MapFilters) => {
    console.log(`🔍 Filters changing:`, newFilters)
    setFilters(newFilters)
    // loadStores will be called automatically by useEffect if metricType changed
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa y datos...</p>
          {selectedPeriod && (
            <p className="text-sm text-gray-500 mt-2">Período: {selectedPeriod}</p>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={() => loadStores()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      {/* Left Sidebar: Filters + Timeline */}
      <div className="w-80 bg-gray-50 border-r overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Timeline Filter */}
          <TimelineFilter
            availablePeriods={availablePeriods}
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            loading={loading}
          />
          
          {/* Regular Filters */}
          <FilterSidebar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            stores={stores}
          />
        </div>
      </div>
      
      {/* Main Map Area */}
      <div className="flex-1 relative">
        {/* Period Info Banner */}
        {selectedPeriod && availablePeriods.length > 0 && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-blue-200 px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-600">📊</span>
                  <span className="text-sm font-medium text-blue-900">
                    Visualizando: {availablePeriods.find(p => p.period === selectedPeriod)?.display_name}
                  </span>
                </div>
                <div className="text-xs text-blue-600">
                  {filteredStores.filter(s => s.revenue_growth_pct !== null).length} tiendas con KPIs
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map Container */}
        <MapContainer
          stores={filteredStores}
          onStoreClick={handleStoreClick}
          selectedStore={selectedStore}
        />

        {/* Enhanced Stats Overlay */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-3 py-2">
          <div className="text-xs text-gray-600 space-y-1">
            <div className="font-medium">📍 {filteredStores.length} tiendas visibles</div>
            <div>📊 {filteredStores.filter(s => s.revenue_growth_pct !== null).length} con métricas</div>
            {selectedPeriod && (
              <div>📅 {availablePeriods.length} períodos disponibles</div>
            )}
            {/* Debug info */}
            <div className="text-xs text-gray-400 border-t pt-1 mt-1">
              {[...new Set(filteredStores.map(s => s.revenue_growth_pct).filter(v => v !== null))].length} valores únicos
            </div>
          </div>
        </div>
      </div>

      {/* Store Popup */}
      {selectedStore && (
        <StorePopup
          store={selectedStore}
          onClose={handleClosePopup}
        />
      )}
    </div>
  )
}