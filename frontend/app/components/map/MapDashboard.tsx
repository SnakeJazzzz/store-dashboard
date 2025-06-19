'use client'
import { useState, useEffect } from 'react'
import type { Store, MapFilters } from '../../types/map'
import MapContainer from './MapContainer'
import FilterSidebar from './FilterSidebar'
import StorePopup from './StorePopup'

export default function MapDashboard() {
  const [stores, setStores] = useState<Store[]>([])
  const [filteredStores, setFilteredStores] = useState<Store[]>([])
  const [filters, setFilters] = useState<MapFilters>({ metricType: 'growth' })
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load stores data
  useEffect(() => {
    loadStores()
  }, [filters.metricType])

  // Apply filters to stores
  useEffect(() => {
    applyFilters()
  }, [stores, filters])

  const loadStores = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get auth token
      const { data: { session } } = await (await import('../../lib/supabaseClient')).supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No hay sesión activa')
      }

      // Build query params
      const params = new URLSearchParams({
        format: filters.metricType || 'growth'
      })

      // Fetch stores
      const response = await fetch(`/api/stores?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al cargar tiendas')
      }

      const data = await response.json()
      setStores(data.stores || [])
      
      console.log(`📍 Loaded ${data.stores?.length || 0} stores from API`)
      
    } catch (err) {
      console.error('Error loading stores:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
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
    console.log(`🔍 Applied filters: ${filtered.length}/${stores.length} stores`)
  }

  const handleStoreClick = (store: Store) => {
    setSelectedStore(store)
  }

  const handleClosePopup = () => {
    setSelectedStore(null)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa...</p>
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
      <FilterSidebar
        filters={filters}
        onFiltersChange={setFilters}
        stores={stores}
      />
      
      <div className="flex-1">
        <MapContainer
          stores={filteredStores}
          onStoreClick={handleStoreClick}
          selectedStore={selectedStore}
        />
      </div>

      {selectedStore && (
        <StorePopup
          store={selectedStore}
          onClose={handleClosePopup}
        />
      )}
    </div>
  )
}