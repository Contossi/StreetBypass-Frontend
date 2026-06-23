import { ref } from 'vue'
import mapboxgl from 'mapbox-gl'
import { OBSTACLE_META, POINT_TYPES, LINE_TYPES } from '../constants/obstacles.js'
import { createObstacleMarkerEl, buildObstaclePopup, getLineMarkerPosition } from '../utils/mapUtils.js'

export function useObstacleVisuals({ getMap, allObstacles, api }) {
    const obstacleVisuals        = new Map()
    const obstaclesVisible       = ref(true)
    const routeActive            = ref(false)
    const activeRouteObstacleIds = ref(new Set())

    function setObstacleVisibility(visual, visible) {
        if (visual.marker) visual.marker.getElement().style.display = visible ? '' : 'none'
        const map = getMap()
        if (visual.layerId && map.getLayer(visual.layerId)) {
            map.setLayoutProperty(visual.layerId, 'visibility', visible ? 'visible' : 'none')
        }
    }

    function removeObstacleVisual(id) {
        const visual = obstacleVisuals.get(String(id))
        if (!visual) return
        const map = getMap()
        if (visual.marker)  visual.marker.remove()
        if (visual.layerId  && map.getLayer(visual.layerId))   map.removeLayer(visual.layerId)
        if (visual.sourceId && map.getSource(visual.sourceId)) map.removeSource(visual.sourceId)
        obstacleVisuals.delete(String(id))
    }

    async function handleTypeChange(obstacle, newType, redrawFn) {
        if (newType === obstacle.type) return
        const updated = await api.updateObstacle(obstacle._id, newType, obstacle.location)
        if (!updated) return
        const idx = allObstacles.value.findIndex(o => String(o._id) === String(obstacle._id))
        if (idx !== -1) allObstacles.value[idx] = updated
        removeObstacleVisual(obstacle._id)
        redrawFn(updated)
    }

    async function deleteObstacleAndClean(id) {
        const success = await api.deleteObstacle(id)
        if (!success) return
        removeObstacleVisual(id)
        allObstacles.value = allObstacles.value.filter(o => String(o._id) !== String(id))
    }

    function addPointMarker(obstacle) {
        const el = createObstacleMarkerEl(obstacle.type)
        const popupContent = buildObstaclePopup(
            obstacle, POINT_TYPES,
            newType => handleTypeChange(obstacle, newType, addPointMarker),
            () => deleteObstacleAndClean(obstacle._id)
        )
        const popup  = new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent)
        const marker = new mapboxgl.Marker(el)
            .setLngLat(obstacle.location.coordinates)
            .setPopup(popup)
            .addTo(getMap())
        obstacleVisuals.set(String(obstacle._id), { marker })
    }

    function addLineObstacle(obstacle) {
        const map      = getMap()
        const sourceId = `line-obstacle-${obstacle._id}`
        const layerId  = `line-obstacle-layer-${obstacle._id}`
        const color    = OBSTACLE_META[obstacle.type]?.lineColor ?? 'dimgray'

        if (map.getLayer(layerId))   map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)

        map.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'Feature', properties: { obstacleId: obstacle._id, type: obstacle.type }, geometry: obstacle.location }
        })
        map.addLayer({
            id: layerId, type: 'line', source: sourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint:  { 'line-color': color, 'line-width': 10, 'line-opacity': 0.8 }
        })

        const iconEl = createObstacleMarkerEl(obstacle.type)
        const popupContent = buildObstaclePopup(
            obstacle, LINE_TYPES,
            newType => handleTypeChange(obstacle, newType, addLineObstacle),
            () => deleteObstacleAndClean(obstacle._id)
        )
        const popup  = new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent)
        const marker = new mapboxgl.Marker(iconEl)
            .setLngLat(getLineMarkerPosition(obstacle.location.coordinates))
            .setPopup(popup)
            .addTo(map)

        obstacleVisuals.set(String(obstacle._id), { marker, sourceId, layerId })
    }

    function showOnlyRouteObstacles(routeObstacles) {
        routeActive.value = true
        activeRouteObstacleIds.value = new Set(routeObstacles.map(o => String(o._id)))
        obstacleVisuals.forEach((visual, id) => {
            setObstacleVisibility(visual, activeRouteObstacleIds.value.has(id) || obstaclesVisible.value)
        })
    }

    function showAllObstacles() {
        obstacleVisuals.forEach(visual => setObstacleVisibility(visual, obstaclesVisible.value))
    }

    function resetRouteState() {
        routeActive.value = false
        activeRouteObstacleIds.value = new Set()
        showAllObstacles()
    }

    function toggleObstaclesVisibility() {
        obstaclesVisible.value = !obstaclesVisible.value
        obstacleVisuals.forEach((visual, id) => {
            const isOnRoute = routeActive.value && activeRouteObstacleIds.value.has(id)
            setObstacleVisibility(visual, isOnRoute || obstaclesVisible.value)
        })
    }

    return {
        obstacleVisuals, obstaclesVisible, routeActive, activeRouteObstacleIds,
        setObstacleVisibility, removeObstacleVisual,
        addPointMarker, addLineObstacle,
        showOnlyRouteObstacles, showAllObstacles, resetRouteState, toggleObstaclesVisibility,
    }
}
