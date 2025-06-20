// frontend/app/components/map/GeocodingInterface.tsx - IMPROVED VERSION
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface GeocodingResult {
  success: boolean
  mode: string
  processed: number
  successful: number
  failed: number
  remaining: number
  total_without_coords: number
  completion_percentage: number
  isComplete: boolean
  nextBatchRecommended: boolean
  performance?: {
    total_time_seconds: number
    rate_per_second: number
    mapbox_calls_used: number
  }
  recommendations?: string[]
  results?: Array<{
    suc_sap: string
    success: boolean
    lat?: number
    lon?: number
    error?: string
  }>
  errors?: string[]
}

interface GeocodingStats {
  totalStores: number
  withCoords: number
  withoutCoords: number
  percentage: number
}

type GeocodingMode = 'smart' | 'all' | 'batch'

export default function GeocodingInterface() {
  const [stats, setStats] = useState<GeocodingStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<any>(null)
  const [geocodingResult, setGeocodingResult] = useState<GeocodingResult | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<GeocodingMode>('smart')
  const [batchSize, setBatchSize] = useState(100)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auto-load stats on component mount
  useEffect(() => {
    loadStats()
  }, [])

  // Load current geocoding stats
  const loadStats = async () => {
    try {
      setLoading(true)
      setError('')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('No hay sesión activa')
        return
      }

      const response = await fetch('/api/stores?format=growth', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al cargar estadísticas')
      }

      const data = await response.json()
      const stores = data.stores || []
      
      const withCoords = stores.filter((s: any) => s.lat && s.lon).length
      const withoutCoords = stores.length - withCoords
      
      const statsData: GeocodingStats = {
        totalStores: stores.length,
        withCoords,
        withoutCoords,
        percentage: stores.length > 0 ? Math.round((withCoords / stores.length) * 100) : 0
      }
      
      setStats(statsData)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Run dry run
  const runDryRun = async () => {
    try {
      setLoading(true)
      setError('')
      setDryRunResult(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('No hay sesión activa')
        return
      }

      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dryRun: true,
          mode,
          batchSize
        })
      })

      if (!response.ok) {
        throw new Error('Error en dry run')
      }

      const result = await response.json()
      setDryRunResult(result)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en dry run')
    } finally {
      setLoading(false)
    }
  }

  // Run actual geocoding
  const runGeocoding = async () => {
    try {
      setLoading(true)
      setError('')
      setGeocodingResult(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('No hay sesión activa')
        return
      }

      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode,
          batchSize
        })
      })

      if (!response.ok) {
        throw new Error('Error en geocoding')
      }

      const result: GeocodingResult = await response.json()
      setGeocodingResult(result)
      
      // Reload stats after successful geocoding
      if (result.successful > 0) {
        setTimeout(loadStats, 1000)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en geocoding')
    } finally {
      setLoading(false)
    }
  }

  const getModeDescription = (selectedMode: GeocodingMode) => {
    switch (selectedMode) {
      case 'smart':
        return 'Automático: Procesa todas las tiendas si es la primera vez (<600), o usa lotes para actualizaciones incrementales'
      case 'all':
        return 'Procesar todas las tiendas sin coordenadas de una vez (recomendado para configuración inicial)'
      case 'batch':
        return 'Procesar en lotes del tamaño especificado (útil para actualizaciones grandes)'
    }
  }

  const getStatusColor = (percentage: number) => {
    if (percentage === 100) return 'text-green-700'
    if (percentage >= 80) return 'text-blue-700'
    if (percentage >= 50) return 'text-yellow-700'
    return 'text-red-700'
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            🗺️ Geocoding de Tiendas
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Convierte direcciones en coordenadas para mostrar tiendas en el mapa
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-md">
          <div className="flex items-center">
            <span className="text-lg mr-2">❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Current Stats Dashboard */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900">Total Tiendas</h3>
              <p className="text-2xl font-bold text-blue-700">{stats.totalStores}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-medium text-green-900">Con Coordenadas</h3>
              <p className="text-2xl font-bold text-green-700">{stats.withCoords}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-medium text-yellow-900">Sin Coordenadas</h3>
              <p className="text-2xl font-bold text-yellow-700">{stats.withoutCoords}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-medium text-purple-900">Completado</h3>
              <p className={`text-2xl font-bold ${getStatusColor(stats.percentage)}`}>
                {stats.percentage}%
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progreso de Geocoding</span>
              <span>{stats.percentage}% ({stats.withCoords}/{stats.totalStores})</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  stats.percentage === 100 ? 'bg-green-500' :
                  stats.percentage >= 80 ? 'bg-blue-500' :
                  stats.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${stats.percentage}%` }}
              ></div>
            </div>
          </div>

          {/* Status Messages */}
          {stats.withoutCoords === 0 ? (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🎉</span>
                <div>
                  <h3 className="font-medium text-green-900">¡Geocoding Completo!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Todas las tiendas tienen coordenadas. Tu mapa debería mostrar todas las {stats.withCoords} tiendas.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center">
                <span className="text-2xl mr-3">⚠️</span>
                <div>
                  <h3 className="font-medium text-yellow-900">Geocoding Pendiente</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    {stats.withoutCoords} tiendas necesitan coordenadas para aparecer en el mapa.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Only show controls if there are stores that need geocoding */}
      {stats && stats.withoutCoords > 0 && (
        <>
          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Modo de Procesamiento
            </label>
            <div className="space-y-3">
              {(['smart', 'all', 'batch'] as GeocodingMode[]).map((modeOption) => (
                <label key={modeOption} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value={modeOption}
                    checked={mode === modeOption}
                    onChange={(e) => setMode(e.target.value as GeocodingMode)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 capitalize flex items-center">
                      {modeOption === 'smart' && '🤖 Smart (Recomendado)'}
                      {modeOption === 'all' && '🚀 Todas las Tiendas'}
                      {modeOption === 'batch' && '📦 Por Lotes'}
                      {modeOption === mode && <span className="ml-2 text-blue-600">●</span>}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {getModeDescription(modeOption)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          {mode === 'batch' && (
            <div className="mb-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 hover:text-blue-800 mb-3"
              >
                {showAdvanced ? '⬆️ Ocultar' : '⬇️ Mostrar'} configuración avanzada
              </button>
              
              {showAdvanced && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tamaño del Lote
                  </label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={25}>25 tiendas (Lento y seguro)</option>
                    <option value={50}>50 tiendas (Equilibrado)</option>
                    <option value={100}>100 tiendas (Recomendado)</option>
                    <option value={200}>200 tiendas (Rápido)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Tiendas a procesar por lote. Lotes más grandes son más rápidos pero usan más API calls.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={runDryRun}
              disabled={loading}
              className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              <span className="mr-2">🔍</span>
              {loading ? 'Analizando...' : 'Vista Previa (Dry Run)'}
            </button>
            
            <button
              onClick={runGeocoding}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              <span className="mr-2">🚀</span>
              {loading ? 'Procesando...' : 'Ejecutar Geocoding'}
            </button>
          </div>
        </>
      )}

      {/* Dry Run Results */}
      {dryRunResult && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-medium text-blue-900 mb-3 flex items-center">
            <span className="mr-2">📋</span>
            Vista Previa del Procesamiento
          </h3>
          <div className="space-y-2 text-sm text-blue-700">
            <p><strong>Modo:</strong> {dryRunResult.mode}</p>
            <p><strong>Se procesarían:</strong> {dryRunResult.willProcess} de {dryRunResult.totalStoresWithoutCoords} tiendas</p>
            <p><strong>Tiempo estimado:</strong> {dryRunResult.estimatedTime}</p>
            <p><strong>Costo estimado:</strong> {dryRunResult.costEstimate}</p>
          </div>
          
          {dryRunResult.sampleStores && dryRunResult.sampleStores.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-blue-800">Ejemplos de direcciones:</p>
              <div className="mt-2 space-y-1">
                {dryRunResult.sampleStores.slice(0, 3).map((store: any, index: number) => (
                  <p key={index} className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                    <strong>{store.suc_sap}:</strong> {store.address}
                  </p>
                ))}
              </div>
            </div>
          )}
          
          {dryRunResult.recommendations && (
            <div className="mt-3">
              <p className="text-sm font-medium text-blue-800">Recomendaciones:</p>
              <ul className="mt-1 text-xs text-blue-600 space-y-1">
                {dryRunResult.recommendations.map((rec: string, index: number) => (
                  <li key={index}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Geocoding Results */}
      {geocodingResult && (
        <div className={`p-4 border rounded-md ${
          geocodingResult.isComplete 
            ? 'bg-green-50 border-green-200' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <h3 className="font-medium mb-3 flex items-center">
            <span className="mr-2">{geocodingResult.isComplete ? '🎉' : '📊'}</span>
            {geocodingResult.isComplete ? 'Geocoding Completado' : 'Resultado del Procesamiento'}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
            <div>
              <span className="font-medium">Procesadas:</span>
              <div className="text-lg font-bold">{geocodingResult.processed}</div>
            </div>
            <div>
              <span className="font-medium">Exitosas:</span>
              <div className="text-lg font-bold text-green-600">{geocodingResult.successful}</div>
            </div>
            <div>
              <span className="font-medium">Fallidas:</span>
              <div className="text-lg font-bold text-red-600">{geocodingResult.failed}</div>
            </div>
            <div>
              <span className="font-medium">Restantes:</span>
              <div className="text-lg font-bold text-yellow-600">{geocodingResult.remaining}</div>
            </div>
            <div>
              <span className="font-medium">Progreso:</span>
              <div className="text-lg font-bold text-blue-600">{geocodingResult.completion_percentage}%</div>
            </div>
          </div>

          {geocodingResult.performance && (
            <div className="text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded">
              <strong>Performance:</strong> {geocodingResult.performance.total_time_seconds}s total | 
              {geocodingResult.performance.rate_per_second}/s rate | 
              {geocodingResult.performance.mapbox_calls_used} API calls
            </div>
          )}
          
          {geocodingResult.recommendations && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-800">💡 Recomendaciones:</p>
              <ul className="mt-1 text-sm text-gray-600 space-y-1">
                {geocodingResult.recommendations.map((rec: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {geocodingResult.errors && geocodingResult.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-600">❌ Errores:</p>
              <div className="mt-1 text-xs text-red-500 space-y-1 max-h-32 overflow-y-auto">
                {geocodingResult.errors.slice(0, 5).map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
                {geocodingResult.errors.length > 5 && (
                  <p className="text-gray-500">... y {geocodingResult.errors.length - 5} errores más</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
        <h3 className="font-medium text-gray-900 mb-2 flex items-center">
          <span className="mr-2">ℹ️</span>
          Información del Geocoding
        </h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Vista Previa:</strong> Muestra qué se procesaría sin hacer cambios reales</li>
          <li>• <strong>Modo Smart:</strong> Recomendado para la primera configuración (procesa todas las tiendas)</li>
          <li>• <strong>Rate Limit:</strong> 10 requests/segundo (dentro del límite gratuito de Mapbox)</li>
          <li>• <strong>Costo:</strong> ~534 requests iniciales = 0.5% del límite mensual gratuito</li>
          <li>• <strong>Futuro:</strong> Solo se geocodificarán tiendas nuevas de los CSVs</li>
        </ul>
      </div>
    </div>
  )
}