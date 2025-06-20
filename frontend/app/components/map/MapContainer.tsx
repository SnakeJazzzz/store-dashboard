// frontend/app/components/map/MapContainer.tsx - ENHANCED VERSION
'use client'
import { useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { LayerSpecification } from 'mapbox-gl'
import type { MapContainerProps } from '../../types/map'
import { 
  MAPBOX_ACCESS_TOKEN, 
  MEXICO_CENTER, 
  MEXICO_ZOOM,
  storesToGeoJSON,
  CLUSTER_CONFIG,
  getGrowthColor
} from '../../lib/mapbox'

// Set Mapbox access token
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN

export default function MapContainer({ stores, onStoreClick, selectedStore }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11', // Clean light theme
      center: MEXICO_CENTER,
      zoom: MEXICO_ZOOM
    })

    // Setup map when loaded
    map.current.on('load', () => {
      console.log('🗺️ Mapbox map loaded successfully')
      setupMapLayers()
      setupMapInteractions()
    })

    return () => {
      map.current?.remove()
    }
  }, [])

  // Update stores data when stores change
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded() && stores.length > 0) {
      updateStoresData()
    }
  }, [stores])

  const setupMapLayers = () => {
    if (!map.current) return

    // Add stores source
    map.current.addSource('stores', {
      type: 'geojson',
      data: storesToGeoJSON(stores),
      cluster: true,
      clusterMaxZoom: CLUSTER_CONFIG.maxZoom,
      clusterRadius: CLUSTER_CONFIG.radius
    })

    // ENHANCED: Better cluster layer with improved colors
    const clusterLayer: LayerSpecification = {
      id: 'clusters',
      type: 'circle',
      source: 'stores',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          CLUSTER_CONFIG.colors.small,   // < 10 stores: Blue
          10,
          CLUSTER_CONFIG.colors.medium,  // 10-30 stores: Purple  
          30,
          CLUSTER_CONFIG.colors.large    // > 30 stores: Red
        ] as any,
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,             // < 10 stores: radius 18
          10,
          28,             // 10-30 stores: radius 28
          30,
          38              // > 30 stores: radius 38
        ] as any,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    }

    // ENHANCED: Better cluster count styling
    const clusterCountLayer: LayerSpecification = {
      id: 'cluster-count',
      type: 'symbol',
      source: 'stores',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 13
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.3)',
        'text-halo-width': 1
      }
    }

    // ENHANCED: Individual stores with better gradient colors
    const unclusteredPointLayer: LayerSpecification = {
      id: 'unclustered-point',
      type: 'circle',
      source: 'stores',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['>', ['get', 'revenue_growth'], 15], '#10b981',  // Emerald (excellent)
          ['>', ['get', 'revenue_growth'], 10], '#22c55e',  // Green (very good)
          ['>', ['get', 'revenue_growth'], 5], '#65a30d',   // Lime 600 (good)
          ['>', ['get', 'revenue_growth'], 2], '#84cc16',   // Lime 500 (positive)
          ['>', ['get', 'revenue_growth'], 0], '#eab308',   // Yellow (neutral +)
          ['>', ['get', 'revenue_growth'], -2], '#f59e0b',  // Amber (neutral -)
          ['>', ['get', 'revenue_growth'], -5], '#f97316',  // Orange (concerning)
          ['>', ['get', 'revenue_growth'], -10], '#dc2626', // Red (bad)
          '#991b1b'                                         // Red 800 (critical)
        ] as any,
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5, 4,    // At zoom 5: radius 4
          10, 8,   // At zoom 10: radius 8
          15, 12   // At zoom 15: radius 12
        ] as any,
        'circle-stroke-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5, 1,    // At zoom 5: stroke 1
          10, 2,   // At zoom 10: stroke 2
          15, 3    // At zoom 15: stroke 3
        ] as any,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
        'circle-stroke-opacity': 0.8
      }
    }

    // ENHANCED: Add hover effect layer
    const hoverLayer: LayerSpecification = {
      id: 'store-hover',
      type: 'circle',
      source: 'stores',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 15,
        'circle-opacity': 0,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#3b82f6',
        'circle-stroke-opacity': 0.8
      }
    }

    // Add all layers to map in correct order
    map.current.addLayer(clusterLayer)
    map.current.addLayer(clusterCountLayer)
    map.current.addLayer(unclusteredPointLayer)
    map.current.addLayer(hoverLayer)

    console.log(`✅ Added ${stores.length} stores to map with enhanced styling`)
  }

  const setupMapInteractions = () => {
    if (!map.current) return

    // ENHANCED: Click on individual stores with better feedback
    map.current.on('click', 'unclustered-point', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0]
        const storeId = feature.properties?.id
        const store = stores.find(s => s.id === storeId)
        
        if (store) {
          onStoreClick(store)
          
          // Add visual feedback
          map.current?.setFilter('store-hover', ['==', ['get', 'id'], storeId])
          setTimeout(() => {
            map.current?.setFilter('store-hover', ['==', ['get', 'id'], ''])
          }, 2000)
        }
      }
    })

    // ENHANCED: Click on clusters with smooth zoom animation
    map.current.on('click', 'clusters', (e) => {
      if (!map.current || !e.features?.[0]) return
      
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      })
      
      if (features[0] && features[0].properties) {
        const clusterId = features[0].properties.cluster_id
        const source = map.current.getSource('stores') as mapboxgl.GeoJSONSource
        
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !map.current || zoom === null || zoom === undefined) return
          
          const center = (features[0].geometry as any).coordinates
          map.current.easeTo({
            center: center,
            zoom: zoom + 1, // Zoom in a bit more for better view
            duration: 1000  // Smooth 1-second animation
          })
        })
      }
    })

    // ENHANCED: Hover effects with better visual feedback
    map.current.on('mouseenter', 'unclustered-point', (e) => {
      if (map.current) {
        map.current.getCanvas().style.cursor = 'pointer'
        
        // Show store info on hover
        if (e.features && e.features[0]) {
          const props = e.features[0].properties
          const coordinates = (e.features[0].geometry as any).coordinates.slice()
          
          // Create popup with store info
          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
          })
          .setLngLat(coordinates)
          .setHTML(`
            <div class="text-sm">
              <div class="font-semibold text-gray-900">${props?.sucursal}</div>
              <div class="text-xs text-gray-600">${props?.formato} • ${props?.suc_sap}</div>
              <div class="text-xs mt-1">
                <span class="font-medium" style="color: ${getGrowthColor(props?.revenue_growth || 0)}">
                  ${props?.revenue_growth > 0 ? '+' : ''}${(props?.revenue_growth || 0).toFixed(1)}%
                </span>
                <span class="text-gray-500 ml-1">crecimiento</span>
              </div>
            </div>
          `)
          .addTo(map.current)
          
          // Store popup reference for cleanup
          ;(map.current as any)._hoverPopup = popup
        }
      }
    })

    map.current.on('mouseleave', 'unclustered-point', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = ''
        
        // Remove hover popup
        if ((map.current as any)._hoverPopup) {
          ;(map.current as any)._hoverPopup.remove()
          ;(map.current as any)._hoverPopup = null
        }
      }
    })

    // ENHANCED: Cluster hover effects
    map.current.on('mouseenter', 'clusters', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer'
    })

    map.current.on('mouseleave', 'clusters', () => {
      if (map.current) map.current.getCanvas().style.cursor = ''
    })

    // ENHANCED: Keyboard accessibility
    map.current.getCanvas().addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const center = map.current?.getCenter()
        if (center) {
          // Simulate click at map center
          const point = map.current?.project(center)
          if (point) {
            const features = map.current?.queryRenderedFeatures(point, {
              layers: ['unclustered-point']
            })
            if (features && features[0]) {
              const storeId = features[0].properties?.id
              const store = stores.find(s => s.id === storeId)
              if (store) onStoreClick(store)
            }
          }
        }
      }
    })
  }

  const updateStoresData = () => {
    if (!map.current) return

    const source = map.current.getSource('stores') as mapboxgl.GeoJSONSource
    if (source) {
      source.setData(storesToGeoJSON(stores))
      console.log(`🔄 Updated map with ${stores.length} stores using enhanced styling`)
    }
  }

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
      role="application"
      aria-label="Mapa interactivo de tiendas"
      tabIndex={0}
    />
  )
}