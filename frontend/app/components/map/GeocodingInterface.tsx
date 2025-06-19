'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface GeocodingResult {
  success: boolean
  processed: number
  successful: number
  failed: number
  remaining: number
  nextBatchRecommended: boolean
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

export default function GeocodingInterface() {
  const [stats, setStats] = useState<GeocodingStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<any>(null)
  const [geocodingResult, setGeocodingResult] = useState<GeocodingResult | null>(null)
  const [error, setError] = useState('')
  const [batchSize, setBatchSize] = useState(50)
  const [currentBatch, setCurrentBatch] = useState(1)
  const [totalBatches, setTotalBatches] = useState(0)

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
      
      if (withoutCoords > 0) {
        setTotalBatches(Math.ceil(withoutCoords / batchSize))
      }

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
          batchSize
        })
      })

      if (!response.ok) {
        throw new Error('Error en geocoding')
      }

      const result: GeocodingResult = await response.json()
      setGeocodingResult(result)
      
      // Update current batch
      if (result.nextBatchRecommended) {
        setCurrentBatch(prev => prev + 1)
      }
      
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

  // Run multiple batches automatically
  const runAllBatches = async () => {
    if (!stats || stats.withoutCoords === 0) return

    const totalNeeded = Math.ceil(stats.withoutCoords / batchSize)
    
    for (let i = 0; i < totalNeeded; i++) {
      console.log(`🔄 Running batch ${i + 1} of ${totalNeeded}`)
      await runGeocoding()
      
      // Wait 2 seconds between batches
      if (i < totalNeeded - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          🗺️ Geocoding de Tiendas
        </h2>
        <button
          onClick={loadStats}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Cargando...' : 'Actualizar Stats'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-md">
          {error}
        </div>
      )}

      {/* Current Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900">Total Tiendas</h3>
            <p className="text-2xl font-bold text-blue-700">{stats.totalStores}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-900">Con Coordenadas</h3>
            <p className="text-2xl font-bold text-green-700">{stats.withCoords}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium text-yellow-900">Sin Coordenadas</h3>
            <p className="text-2xl font-bold text-yellow-700">{stats.withoutCoords}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium text-purple-900">Completado</h3>
            <p className="text-2xl font-bold text-purple-700">{stats.percentage}%</p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {stats && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progreso de Geocoding</span>
            <span>{stats.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${stats.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Batch Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamaño del Batch
          </label>
          <select
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10 tiendas (Prueba)</option>
            <option value={25}>25 tiendas</option>
            <option value={50}>50 tiendas (Recomendado)</option>
            <option value={100}>100 tiendas (Rápido)</option>
          </select>
        </div>
        
        {totalBatches > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Progreso de Batches
            </label>
            <div className="px-3 py-2 bg-gray-50 border rounded-md">
              Batch {currentBatch} de {totalBatches}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={runDryRun}
          disabled={loading || !stats}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          🔍 Dry Run
        </button>
        
        <button
          onClick={runGeocoding}
          disabled={loading || !stats || stats.withoutCoords === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          ▶️ Ejecutar Batch
        </button>
        
        <button
          onClick={runAllBatches}
          disabled={loading || !stats || stats.withoutCoords === 0}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          🚀 Ejecutar Todo
        </button>
      </div>

      {/* Dry Run Results */}
      {dryRunResult && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-medium text-blue-900 mb-2">📋 Resultado Dry Run</h3>
          <p className="text-sm text-blue-700">
            Se procesarían {dryRunResult.batchSize} tiendas de {dryRunResult.totalStoresWithoutCoords} sin coordenadas.
          </p>
          {dryRunResult.sampleStores && (
            <div className="mt-3">
              <p className="text-sm font-medium text-blue-800">Ejemplos de direcciones:</p>
              {dryRunResult.sampleStores.slice(0, 3).map((store: any, index: number) => (
                <p key={index} className="text-xs text-blue-600 mt-1">
                  {store.suc_sap}: {store.address}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Geocoding Results */}
      {geocodingResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="font-medium text-green-900 mb-2">✅ Resultado del Geocoding</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Procesadas:</span> {geocodingResult.processed}
            </div>
            <div>
              <span className="font-medium">Exitosas:</span> {geocodingResult.successful}
            </div>
            <div>
              <span className="font-medium">Fallidas:</span> {geocodingResult.failed}
            </div>
            <div>
              <span className="font-medium">Restantes:</span> {geocodingResult.remaining}
            </div>
          </div>
          
          {geocodingResult.errors && geocodingResult.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-600">Errores:</p>
              {geocodingResult.errors.slice(0, 3).map((error, index) => (
                <p key={index} className="text-xs text-red-500 mt-1">{error}</p>
              ))}
            </div>
          )}
          
          {geocodingResult.nextBatchRecommended && (
            <p className="mt-3 text-sm text-green-700">
              💡 Se recomienda ejecutar el siguiente batch.
            </p>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
        <h3 className="font-medium text-gray-900 mb-2">ℹ️ Información</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Dry Run:</strong> Muestra qué se procesaría sin hacer cambios</li>
          <li>• <strong>Ejecutar Batch:</strong> Procesa un lote de tiendas</li>
          <li>• <strong>Ejecutar Todo:</strong> Procesa todas las tiendas automáticamente</li>
          <li>• <strong>Rate Limit:</strong> 10 requests/segundo (dentro del límite gratuito)</li>
        </ul>
      </div>
    </div>
  )
}