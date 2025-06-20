// frontend/app/components/map/StorePopup.tsx - ENHANCED VERSION
'use client'
import type { StorePopupProps } from '../../types/map'
import { getGrowthColor, getFormatColor } from '../../lib/mapbox'

export default function StorePopup({ store, onClose }: StorePopupProps) {
  const revenueGrowth = store.revenue_growth_pct || 0
  const ordersGrowth = store.orders_growth_pct || 0
  const ticketGrowth = store.ticket_growth_pct || 0

  // Get performance status based on revenue growth
  const getPerformanceStatus = (growth: number) => {
    if (growth > 10) return { status: 'Excelente', color: 'text-green-700', bg: 'bg-green-100', emoji: '🚀' }
    if (growth > 5) return { status: 'Bueno', color: 'text-blue-700', bg: 'bg-blue-100', emoji: '📈' }
    if (growth > 0) return { status: 'Neutral', color: 'text-yellow-700', bg: 'bg-yellow-100', emoji: '➡️' }
    if (growth > -5) return { status: 'Bajo', color: 'text-orange-700', bg: 'bg-orange-100', emoji: '📉' }
    return { status: 'Crítico', color: 'text-red-700', bg: 'bg-red-100', emoji: '⚠️' }
  }

  const performance = getPerformanceStatus(revenueGrowth)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-96 overflow-y-auto">
        {/* Header with Store Info */}
        <div className="flex justify-between items-start p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getFormatColor(store.formato) }}
              ></div>
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {store.formato}
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs font-mono text-gray-600">
                {store.suc_sap}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              {store.sucursal}
            </h3>
            
            {/* Performance Badge */}
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${performance.bg} ${performance.color}`}>
              <span className="mr-1">{performance.emoji}</span>
              {performance.status}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Location Info */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
              <span className="mr-2">📍</span>
              Ubicación
            </h4>
            <div className="text-sm text-gray-700 space-y-1 bg-gray-50 p-3 rounded-md">
              {store.calle && (
                <p className="font-medium">{store.calle}</p>
              )}
              {store.colonia && (
                <p>Col. {store.colonia}</p>
              )}
              <p className="text-blue-600 font-medium">
                {store.ciudad}, {store.estado}
              </p>
              {store.cp && (
                <p className="text-xs text-gray-500">CP: {store.cp}</p>
              )}
            </div>
          </div>

          {/* Business Details */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
              <span className="mr-2">🏢</span>
              Detalles del Negocio
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-blue-50 p-2 rounded">
                <p className="text-xs text-blue-600 font-medium">ZONA</p>
                <p className="font-semibold text-blue-800">{store.zona}</p>
              </div>
              <div className="bg-purple-50 p-2 rounded">
                <p className="text-xs text-purple-600 font-medium">DISTRITO</p>
                <p className="font-semibold text-purple-800">{store.distrito}</p>
              </div>
            </div>
          </div>

          {/* KPI Metrics */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">📊</span>
              Métricas de Rendimiento
            </h4>
            <div className="space-y-3">
              {/* Revenue Growth */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                <div className="flex items-center">
                  <span className="text-lg mr-2">💰</span>
                  <span className="text-sm font-medium text-gray-700">Crecimiento en Ventas</span>
                </div>
                <div className="text-right">
                  <div 
                    className="text-lg font-bold px-3 py-1 rounded-full"
                    style={{ 
                      backgroundColor: getGrowthColor(revenueGrowth) + '20',
                      color: getGrowthColor(revenueGrowth)
                    }}
                  >
                    {revenueGrowth > 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              {/* Orders Growth */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div className="flex items-center">
                  <span className="text-lg mr-2">📦</span>
                  <span className="text-sm font-medium text-gray-700">Crecimiento en Órdenes</span>
                </div>
                <div className="text-right">
                  <div 
                    className="text-lg font-bold px-3 py-1 rounded-full"
                    style={{ 
                      backgroundColor: getGrowthColor(ordersGrowth) + '20',
                      color: getGrowthColor(ordersGrowth)
                    }}
                  >
                    {ordersGrowth > 0 ? '+' : ''}{ordersGrowth.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              {/* Ticket Growth */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🎫</span>
                  <span className="text-sm font-medium text-gray-700">Crecimiento en Ticket Promedio</span>
                </div>
                <div className="text-right">
                  <div 
                    className="text-lg font-bold px-3 py-1 rounded-full"
                    style={{ 
                      backgroundColor: getGrowthColor(ticketGrowth) + '20',
                      color: getGrowthColor(ticketGrowth)
                    }}
                  >
                    {ticketGrowth > 0 ? '+' : ''}{ticketGrowth.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Store Info */}
          {(store.ventas || store.ordenes || store.tickets) && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                <span className="mr-2">📈</span>
                Métricas Absolutas
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {store.ventas && (
                  <div className="bg-green-50 p-2 rounded text-center">
                    <p className="text-green-600 font-medium">VENTAS</p>
                    <p className="font-bold text-green-800">${store.ventas.toLocaleString()}</p>
                  </div>
                )}
                {store.ordenes && (
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <p className="text-blue-600 font-medium">ÓRDENES</p>
                    <p className="font-bold text-blue-800">{store.ordenes.toLocaleString()}</p>
                  </div>
                )}
                {store.tickets && (
                  <div className="bg-purple-50 p-2 rounded text-center">
                    <p className="text-purple-600 font-medium">TICKETS</p>
                    <p className="font-bold text-purple-800">{store.tickets.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coordinates (for debugging) */}
          {store.lat && store.lon && (
            <div className="text-xs text-gray-500 text-center bg-gray-50 p-2 rounded">
              📐 {store.lat.toFixed(6)}, {store.lon.toFixed(6)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}