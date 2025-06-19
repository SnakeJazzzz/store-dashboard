'use client'
import type { FilterSidebarProps } from '../../types/map'

export default function FilterSidebar({ filters, onFiltersChange, stores }: FilterSidebarProps) {
  // Get unique values for filters
  const uniqueEstados = [...new Set(stores.map(s => s.estado))].sort()
  const uniqueFormatos = [...new Set(stores.map(s => s.formato))].sort()
  const uniqueZonas = [...new Set(stores.map(s => s.zona))].sort()

  // Analyze coordinates
  const storesWithCoords = stores.filter(s => s.lat && s.lon && s.lat !== null && s.lon !== null)
  const storesWithoutCoords = stores.filter(s => !s.lat || !s.lon || s.lat === null || s.lon === null)

  // Sample stores for debugging
  const sampleStores = stores.slice(0, 3)

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value
    })
  }

  return (
    <div className="w-80 bg-white shadow-lg border-r h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          🗺️ Filtros del Mapa
        </h2>
        
        {/* Stores count */}
        <div className="mb-6 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{stores.length}</span> tiendas encontradas
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Con coordenadas: {storesWithCoords.length} | Sin coordenadas: {storesWithoutCoords.length}
          </p>
        </div>

        {/* Metric Type Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Métrica
          </label>
          <select
            value={filters.metricType || 'growth'}
            onChange={(e) => handleFilterChange('metricType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option key="growth" value="growth">Crecimiento (%)</option>
            <option key="absolute" value="absolute">Valores Absolutos</option>
          </select>
        </div>

        {/* Estado de Tienda Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Estado de Tienda
          </label>
          <select
            value={filters.estado || 'all'}
            onChange={(e) => handleFilterChange('estado', e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              filters.estado ? 'text-gray-900 font-medium' : 'text-gray-500'
            }`}
          >
            <option key="all-estados" value="all">Todos los Estados</option>
            {uniqueEstados.map(estado => (
              <option key={`estado-${estado}`} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>

        {/* Formato Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Formato
          </label>
          <select
            value={filters.formato || 'all'}
            onChange={(e) => handleFilterChange('formato', e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              filters.formato ? 'text-gray-900 font-medium' : 'text-gray-500'
            }`}
          >
            <option key="all-formatos" value="all">Todos los Formatos</option>
            {uniqueFormatos.map(formato => (
              <option key={`formato-${formato}`} value={formato}>
                {formato}
              </option>
            ))}
          </select>
        </div>

        {/* Zona Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Zona
          </label>
          <select
            value={filters.zona || 'all'}
            onChange={(e) => handleFilterChange('zona', e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              filters.zona ? 'text-gray-900 font-medium' : 'text-gray-500'
            }`}
          >
            <option key="all-zonas" value="all">Todas las Zonas</option>
            {uniqueZonas.map(zona => (
              <option key={`zona-${zona}`} value={zona}>
                {zona}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={() => onFiltersChange({})}
          className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
        >
          Limpiar Filtros
        </button>

        {/* Enhanced Debug info */}
        <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600 space-y-2">
          <p><strong>📊 Debug Info:</strong></p>
          <p>Total stores: {stores.length}</p>
          <p>Con coordenadas: {storesWithCoords.length}</p>
          <p>Sin coordenadas: {storesWithoutCoords.length}</p>
          <p>Estados únicos: {uniqueEstados.length} - {uniqueEstados.join(', ')}</p>
          <p>Formatos únicos: {uniqueFormatos.length} - {uniqueFormatos.join(', ')}</p>
          <p>Zonas únicas: {uniqueZonas.length}</p>
          
          {/* Sample data */}
          <div className="mt-3 border-t pt-2">
            <p><strong>🔍 Muestra de datos:</strong></p>
            {sampleStores.map((store, index) => (
              <div key={`sample-${index}`} className="mt-1 p-2 bg-white rounded text-xs">
                <p><strong>Store {index + 1}:</strong></p>
                <p>SAP: {store.suc_sap}</p>
                <p>Formato: "{store.formato}"</p>
                <p>Estado: "{store.estado}"</p>
                <p>Lat: {store.lat}</p>
                <p>Lon: {store.lon}</p>
                <p>Calle: {store.calle || 'null'}</p>
                <p>Colonia: {store.colonia || 'null'}</p>
              </div>
            ))}
          </div>
          
          {/* Coordinate analysis */}
          {storesWithoutCoords.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <p className="text-red-600"><strong>⚠️ Problema de Coordenadas:</strong></p>
              <p>Las {storesWithoutCoords.length} tiendas sin coordenadas no aparecen en el mapa.</p>
              <p className="text-blue-600">Necesitas geocoding para estas tiendas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}