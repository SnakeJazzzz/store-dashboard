// frontend/app/components/map/TimelineFilter.tsx
'use client'
import { useState, useEffect } from 'react'

interface Period {
  period: string
  year_comparison: string | null
  display_name: string
}

interface TimelineFilterProps {
  availablePeriods: Period[]
  selectedPeriod: string | null
  onPeriodChange: (period: string | null) => void
  loading?: boolean
}

export default function TimelineFilter({ 
  availablePeriods, 
  selectedPeriod, 
  onPeriodChange,
  loading = false 
}: TimelineFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Auto-select latest period if none selected
  useEffect(() => {
    if (!selectedPeriod && availablePeriods.length > 0) {
      onPeriodChange(availablePeriods[0].period)
    }
  }, [availablePeriods, selectedPeriod, onPeriodChange])

  const selectedPeriodData = availablePeriods.find(p => p.period === selectedPeriod)

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📅</span>
            <h3 className="text-white font-semibold text-sm">Período de Análisis</h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:text-blue-200 transition-colors"
            disabled={loading}
          >
            <span className="text-sm">
              {isExpanded ? '⬆️' : '⬇️'}
            </span>
          </button>
        </div>
      </div>

      {/* Current Selection Display */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-600">Cargando períodos...</span>
          </div>
        ) : selectedPeriodData ? (
          <div>
            <div className="text-sm font-medium text-blue-900">
              {selectedPeriodData.display_name}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {availablePeriods.length} períodos disponibles
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Selecciona un período
          </div>
        )}
      </div>

      {/* Timeline Selection (Expandable) */}
      {isExpanded && (
        <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
          {/* Show All / Latest Option */}
          <button
            onClick={() => onPeriodChange(null)}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedPeriod === null
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  📊 Datos Más Recientes
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Muestra las métricas más actuales de cada tienda
                </div>
              </div>
              {selectedPeriod === null && (
                <span className="text-blue-500 text-sm">✓</span>
              )}
            </div>
          </button>

          {/* Individual Period Options */}
          {availablePeriods.map((period, index) => (
            <button
              key={period.period}
              onClick={() => onPeriodChange(period.period)}
              className={`w-full text-left p-3 rounded-md border transition-colors ${
                selectedPeriod === period.period
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">
                    {period.display_name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {index === 0 && '🆕 Más reciente'}
                    {index > 0 && `📈 Comparación histórica`}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {index === 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      Actual
                    </span>
                  )}
                  {selectedPeriod === period.period && (
                    <span className="text-blue-500 text-sm">✓</span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {availablePeriods.length === 0 && !loading && (
            <div className="text-center py-6 text-gray-500">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm">No hay períodos disponibles</div>
              <div className="text-xs mt-1">Sube un archivo CSV para ver datos</div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Stats */}
      {!isExpanded && availablePeriods.length > 1 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">
              Períodos históricos: {availablePeriods.length - 1}
            </span>
            <button
              onClick={() => setIsExpanded(true)}
              className="text-blue-600 hover:text-blue-800"
            >
              Ver histórico →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}