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
  CLUSTER_CONFIG
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

    // Add cluster layer
    const clusterLayer: LayerSpecification = {
      id: 'clusters',
      type: 'circle',
      source: 'stores',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6',      // < 10 stores
          10,
          '#f1f075',      // 10-30 stores  
          30,
          '#f28cb1'       // > 30 stores
        ] as any,
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,             // < 10 stores: radius 20
          10,
          30,             // 10-30 stores: radius 30
          30,
          40              // > 30 stores: radius 40
        ] as any
      }
    }

    // Add cluster count layer
    const clusterCountLayer: LayerSpecification = {
      id: 'cluster-count',
      type: 'symbol',
      source: 'stores',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#fff'
      }
    }

    // Add individual stores layer
    const unclusteredPointLayer: LayerSpecification = {
      id: 'unclustered-point',
      type: 'circle',
      source: 'stores',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['>', ['get', 'revenue_growth'], 10], '#22c55e',  // Excelente
          ['>', ['get', 'revenue_growth'], 5], '#84cc16',   // Bueno
          ['>', ['get', 'revenue_growth'], 0], '#eab308',   // Neutro
          ['>', ['get', 'revenue_growth'], -5], '#f97316',  // Malo
          '#ef4444'                                         // Muy malo
        ] as any,
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    }

    // Add all layers to map
    map.current.addLayer(clusterLayer)
    map.current.addLayer(clusterCountLayer)
    map.current.addLayer(unclusteredPointLayer)

    console.log(`✅ Added ${stores.length} stores to map`)
  }

  const setupMapInteractions = () => {
    if (!map.current) return

    // Click on individual stores
    map.current.on('click', 'unclustered-point', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0]
        const storeId = feature.properties?.id
        const store = stores.find(s => s.id === storeId)
        
        if (store) {
          onStoreClick(store)
        }
      }
    })

    // Click on clusters to zoom in
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
            zoom: zoom
          })
        })
      }
    })

    // Change cursor on hover
    map.current.on('mouseenter', 'unclustered-point', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer'
    })

    map.current.on('mouseleave', 'unclustered-point', () => {
      if (map.current) map.current.getCanvas().style.cursor = ''
    })

    map.current.on('mouseenter', 'clusters', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer'
    })

    map.current.on('mouseleave', 'clusters', () => {
      if (map.current) map.current.getCanvas().style.cursor = ''
    })
  }

  const updateStoresData = () => {
    if (!map.current) return

    const source = map.current.getSource('stores') as mapboxgl.GeoJSONSource
    if (source) {
      source.setData(storesToGeoJSON(stores))
      console.log(`🔄 Updated map with ${stores.length} stores`)
    }
  }

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  )
}