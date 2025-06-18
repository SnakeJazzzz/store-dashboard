// app/components/CSVUploadWizard.tsx
'use client'
import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabaseClient'

interface CSVData {
  headers: string[]
  preview: any[]
  fullData: any[]
}

interface DetectedFormat {
  type: 'growth' | 'absolute' | 'unknown'
  confidence: number
  description: string
  kpiColumns: string[]
}

const FORMAT_PATTERNS = {
  growth: {
    patterns: ['crec%', '%', 'growth', 'crecimiento'],
    description: 'Formato de Crecimiento (Porcentajes)'
  },
  absolute: {
    patterns: ['ventas', 'ordenes', 'tickets'],
    description: 'Formato de Valores Absolutos'
  }
}

export default function CSVUploadWizard() {
  const [step, setStep] = useState(1)
  const [csvData, setCsvData] = useState<CSVData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile: File) => {
    setError('')
    setFile(selectedFile)
    setLoading(true)

    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor selecciona un archivo CSV válido')
      setLoading(false)
      return
    }

    // Parse CSV
    Papa.parse(selectedFile, {
      complete: (result) => {
        if (result.errors.length > 0) {
          setError(`Error al leer el archivo: ${result.errors[0].message}`)
          setLoading(false)
          return
        }

        const headers = result.data[0] as string[]
        const dataRows = result.data.slice(1)
        const preview = dataRows.slice(0, 5) // First 5 rows for preview

        setCsvData({
          headers: headers.map(h => h.trim()),
          preview,
          fullData: dataRows
        })

        // Auto-detect format based on last 3 columns
        const lastThreeHeaders = headers.slice(-3).map(h => h.trim().toLowerCase())
        const format = detectFormat(lastThreeHeaders)
        setDetectedFormat(format)

        setLoading(false)
        // Skip to step 2 (confirmation) or directly to processing
        setStep(2)
      },
      header: false,
      skipEmptyLines: true,
      encoding: 'UTF-8'
    })
  }, [])

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [handleFileSelect])

  // Auto-detect CSV format based on column headers
  const detectFormat = (lastThreeHeaders: string[]): DetectedFormat => {
    let growthScore = 0
    let absoluteScore = 0
    const kpiColumns: string[] = []
    
    // Check last 3 columns for growth patterns
    lastThreeHeaders.forEach(header => {
      FORMAT_PATTERNS.growth.patterns.forEach(pattern => {
        if (header.includes(pattern)) {
          growthScore++
          kpiColumns.push(header)
        }
      })
    })
    
    // Check for absolute value patterns
    lastThreeHeaders.forEach(header => {
      FORMAT_PATTERNS.absolute.patterns.forEach(pattern => {
        if (header.includes(pattern)) {
          absoluteScore++
          kpiColumns.push(header)
        }
      })
    })
    
    if (growthScore >= 2) {
      return {
        type: 'growth',
        confidence: Math.min(growthScore / 3, 1),
        description: FORMAT_PATTERNS.growth.description,
        kpiColumns
      }
    } else if (absoluteScore >= 2) {
      return {
        type: 'absolute', 
        confidence: Math.min(absoluteScore / 3, 1),
        description: FORMAT_PATTERNS.absolute.description,
        kpiColumns
      }
    } else {
      return {
        type: 'unknown',
        confidence: 0,
        description: 'Formato no reconocido - Requiere revisión manual',
        kpiColumns: lastThreeHeaders
      }
    }
  }

  // Process and submit data
  const handleSubmit = async () => {
    if (!detectedFormat || detectedFormat.type === 'unknown') {
      setError('No se pudo detectar el formato del archivo automáticamente')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        setError('No hay sesión activa. Por favor inicia sesión de nuevo.')
        setLoading(false)
        return
      }

      // Determine endpoint based on detected format
      const endpoint = detectedFormat.type === 'growth' 
        ? '/api/import/growth-metrics'
        : '/api/import/absolute-metrics'
      
      console.log('Submitting to:', endpoint)

      // Submit data to API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          csvData,
          filename: file?.name || 'unknown.csv',
          detectedFormat
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar el archivo')
      }

      console.log('Import result:', result)
      setStep(3) // Success step
      
    } catch (err) {
      console.error('Import error:', err)
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Reset wizard
  const reset = () => {
    setStep(1)
    setCsvData(null)
    setFile(null)
    setDetectedFormat(null)
    setError('')
  }

  // Step 1: File Upload
  if (step === 1) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          📁 Subir Archivo CSV
        </h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-4xl mb-4">📊</div>
          <p className="text-lg text-gray-600 mb-4">
            Arrastra tu archivo CSV aquí o haz clic para seleccionar
          </p>
          
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
            id="csv-upload"
          />
          
          <label
            htmlFor="csv-upload"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md cursor-pointer hover:bg-blue-700 transition-colors"
          >
            Seleccionar Archivo
          </label>
          
          <p className="text-sm text-gray-500 mt-4">
            Formato esperado: CSV con encabezados. Máximo 5MB.
          </p>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Procesando archivo...</p>
          </div>
        )}
      </div>
    )
  }

  // Step 2: Format Confirmation
  if (step === 2 && csvData && detectedFormat) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          🤖 Formato Detectado Automáticamente
        </h2>
        
        {/* Format Detection Results */}
        <div className="mb-6">
          <div className={`p-4 rounded-lg border ${
            detectedFormat.type === 'unknown' 
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center space-x-3 mb-3">
              <div className="text-2xl">
                {detectedFormat.type === 'growth' && '📈'}
                {detectedFormat.type === 'absolute' && '🔢'}
                {detectedFormat.type === 'unknown' && '❓'}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{detectedFormat.description}</h3>
                <p className="text-sm text-gray-600">
                  Confianza: {Math.round(detectedFormat.confidence * 100)}%
                </p>
              </div>
            </div>
            
            {detectedFormat.type !== 'unknown' && (
              <div className="text-sm text-gray-700">
                <p className="mb-2"><strong>Columnas KPI detectadas:</strong></p>
                <div className="flex flex-wrap gap-2">
                  {detectedFormat.kpiColumns.map((col, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Table */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Vista previa (primeras 5 filas):</h3>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {csvData.headers.map((header, index) => {
                    const isKPI = detectedFormat.kpiColumns.includes(header.toLowerCase())
                    return (
                      <th key={index} className={`px-3 py-2 text-left font-medium border-r ${
                        isKPI ? 'text-blue-900 bg-blue-50' : 'text-gray-900'
                      }`}>
                        {header}
                        {isKPI && <span className="ml-1 text-blue-500">📊</span>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {csvData.preview.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t">
                    {csvData.headers.map((header, colIndex) => {
                      const isKPI = detectedFormat.kpiColumns.includes(header.toLowerCase())
                      return (
                        <td key={colIndex} className={`px-3 py-2 border-r ${
                          isKPI ? 'text-blue-700 bg-blue-25' : 'text-gray-700'
                        }`}>
                          {row[colIndex] || '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {detectedFormat.type === 'unknown' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Formato no reconocido</h4>
            <p className="text-sm text-yellow-700">
              No se pudo detectar automáticamente el formato. Por favor revisa que:
            </p>
            <ul className="text-sm text-yellow-700 mt-2 ml-4 list-disc">
              <li>Las últimas 3 columnas contengan métricas KPI</li>
              <li>Para crecimiento: columnas con "Crec%" o "%"</li>
              <li>Para valores absolutos: "Ventas", "Ordenes", "Tickets"</li>
            </ul>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ← Atrás
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={loading || detectedFormat.type === 'unknown'}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Confirmar e Importar'}
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Success
  if (step === 3) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          ¡Datos Importados Exitosamente!
        </h2>
        <p className="text-gray-600 mb-6">
          Tu archivo CSV ha sido procesado y los datos han sido guardados en la base de datos.
        </p>
        
        <div className="space-x-4">
          <button
            onClick={reset}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Subir Otro Archivo
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Ver Dashboard
          </button>
        </div>
      </div>
    )
  }

  return null
}