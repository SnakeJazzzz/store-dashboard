// frontend/app/dashboard/page.tsx
"use client";
import { useAuth } from "../contexts/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";

export default function DashboardPage() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Dashboard de Tiendas
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Bienvenido, {user?.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-8">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  ¡Tu Dashboard está Listo!
                </h2>
                <p className="text-gray-600 mb-8">
                  La autenticación está funcionando. Los próximos pasos serán:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      📁 Subir CSV
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Wizard para mapear columnas y subir datos de tiendas
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      🗺️ Mapa Interactivo
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Visualización con clusters y colores por KPI
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      📊 Gráficos y Filtros
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Panel lateral con filtros y gráficos de Top/Bottom 5
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
