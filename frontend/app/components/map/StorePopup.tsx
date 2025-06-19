'use client'
import type { StorePopupProps } from '../../types/map'
import { getGrowthColor } from '../../lib/mapbox'

export default function StorePopup({ store, onClose }: StorePopupProps) {
  const revenueGrowth = store.revenue_growth_pct || 0
  const ordersGrowth = store.orders_growth_pct || 0
  const ticketGrowth = store.ticket_growth_pct || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {store.sucursal}
            </h3>
            <p className="text-sm text-gray-600">
              {store.suc_sap} • {store.formato}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Address */}
          <div>
            <h4 className="font-medium text-gray-900 mb-1">📍 Ubicación</h4>
            <div className="text-sm text-gray-600 space-y-1">
              {store.calle && <p>{store.calle}</p>}
              {store.colonia && <p>{store.colonia}</p>}
              <p>{store.ciudad}, {store.estado}</p>
            </div>
          </div>

          {/* Location Details */}
          <div>
            <h4 className="font-medium text-gray-900 mb-1">🏢 Detalles</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Zona:</span> {store.zona}</p>
              <p><span className="font-medium">Distrito:</span> {store.distrito}</p>
            </div>
          </div>

          {/* Growth Metrics */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">📊 Métricas de Crecimiento</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Revenue Growth:</span>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: getGrowthColor(revenueGrowth) + '20',
                    color: getGrowthColor(revenueGrowth)
                  }}
                >
                  {revenueGrowth > 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Orders Growth:</span>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: getGrowthColor(ordersGrowth) + '20',
                    color: getGrowthColor(ordersGrowth)
                  }}
                >
                  {ordersGrowth > 0 ? '+' : ''}{ordersGrowth.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Ticket Growth:</span>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: getGrowthColor(ticketGrowth) + '20',
                    color: getGrowthColor(ticketGrowth)
                  }}
                >
                  {ticketGrowth > 0 ? '+' : ''}{ticketGrowth.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}