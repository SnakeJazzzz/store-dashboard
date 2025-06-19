// app/dashboard/page.tsx
'use client'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import CSVUploadWizard from '../components/CSVUploadWizard'
import MapDashboard from '../components/map/MapDashboard'
import GeocodingInterface from '../components/map/GeocodingInterface'

type DashboardMode = 'map' | 'upload' | 'geocoding'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [mode, setMode] = useState<DashboardMode>('map')

  const handleSignOut = async () => {
    await signOut()
  }

  const renderContent = () => {
    switch (mode) {
      case 'upload':
        return (
          <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                📁 Importar Datos CSV
              </h2>
              <p className="text-gray-600 text-sm">
                Sube tu archivo CSV para actualizar los datos de las tiendas
              </p>
            </div>
            <CSVUploadWizard />
          </div>
        )
      
      case 'geocoding':
        return (
          <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <GeocodingInterface />
          </div>
        )
      
      default: // 'map'
        return (
          <div className="h-[calc(100vh-80px)]">
            <MapDashboard />
          </div>
        )
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Dashboard de Tiendas
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Bienvenido, {user?.email}
                </p>
              </div>
              
              {/* Navigation Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setMode('map')}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm ${
                    mode === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Mapa
                </button>
                
                <button
                  onClick={() => setMode('geocoding')}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm ${
                    mode === 'geocoding'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Geocoding
                </button>
                
                <button
                  onClick={() => setMode('upload')}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm ${
                    mode === 'upload'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Subir CSV
                </button>
                
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </ProtectedRoute>
  )
}
