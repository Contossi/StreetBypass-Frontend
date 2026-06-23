import { ref } from 'vue'
import * as turf from '@turf/turf'
import { OBSTACLE_DISTANCE_KM, DETOUR_DISTANCES_KM } from '../constants/obstacles.js'
import { createLabelMarker, getObstacleDisplayName } from '../utils/mapUtils.js'

export function useRoute({ getMap, allObstacles, avoidTypes, visuals }) {
    const routeMode         = ref(false)
    const routePoints       = ref([])
    const routeMarkers      = ref([])
    const routeOptionsOpen  = ref(false)
    const routeMessage      = ref('')
    const routeHasObstacles = ref(false)

    function addRoutePointMarker(coords, label) {
        routeMarkers.value.push(createLabelMarker(getMap(), coords, label, 'route-point-marker'))
    }

    function clearRoute() {
        routeMarkers.value.forEach(m => m.remove())
        routeMarkers.value = []
        const map = getMap()
        if (map.getLayer('route'))  map.removeLayer('route')
        if (map.getSource('route')) map.removeSource('route')
    }

    function closeRouteMode() {
        clearRoute()
        visuals.resetRouteState()
        routeMode.value = false
        routePoints.value = []
        routeMessage.value = ''
        routeHasObstacles.value = false
    }

    function startRouteMode(opts = {}) {
        clearRoute()
        visuals.showAllObstacles()
        routeMessage.value = ''
        routeOptionsOpen.value = false
        routeMode.value = true
        routePoints.value = []
    }

    function drawRoute(geometry) {
        const map = getMap()
        const geojson = { type: 'Feature', properties: {}, geometry }
        if (map.getSource('route')) { map.getSource('route').setData(geojson); return }
        map.addSource('route', { type: 'geojson', data: geojson })
        map.addLayer({
            id: 'route', type: 'line', source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint:  { 'line-color': 'lightskyblue', 'line-width': 8 }
        })
    }

    function updateRouteMessage(obstacles) {
        if (obstacles.length === 0) {
            routeHasObstacles.value = false
            routeMessage.value = 'Ruta ne prolazi kroz nijednu odabranu prepreku.'
            return
        }
        const counts = {}
        obstacles.forEach(o => { counts[o.type] = (counts[o.type] || 0) + 1 })
        const summary = Object.entries(counts)
            .map(([type, count]) => `${count} x ${getObstacleDisplayName(type)}`)
            .join(', ')
        routeHasObstacles.value = true
        routeMessage.value = `Najbolje pronađena ruta i dalje prolazi kroz: ${summary}.`
    }

    function getObstacleFeature(obstacle) {
        if (obstacle.location.type === 'Point')      return turf.point(obstacle.location.coordinates)
        if (obstacle.location.type === 'LineString') return turf.lineString(obstacle.location.coordinates)
        return null
    }

    function scoreRoute(route) {
        const routeLine = turf.lineString(route.geometry.coordinates)
        const obstacles = allObstacles.value.filter(obstacle => {
            if (!avoidTypes.value.includes(obstacle.type)) return false
            const feature = getObstacleFeature(obstacle)
            if (!feature) return false
            return turf.booleanIntersects(routeLine, turf.buffer(feature, OBSTACLE_DISTANCE_KM, { units: 'kilometers' }))
        })
        return { route, obstacleCount: obstacles.length, obstacles }
    }

    function sortScoredRoutes(scored) {
        return scored.sort((a, b) =>
            a.obstacleCount !== b.obstacleCount
                ? a.obstacleCount - b.obstacleCount
                : a.route.duration - b.route.duration
        )
    }

    function getBestRoute(routes) {
        const scored = sortScoredRoutes(routes.map(scoreRoute))
        console.log('Route comparison', scored.map(r => ({
            obstacles: r.obstacleCount,
            durationSeconds: Math.round(r.route.duration),
            types: r.obstacles.map(o => o.type)
        })))
        return scored[0]
    }

    async function requestRoutes(coordinates) {
        const token    = import.meta.env.VITE_MAPBOX_TOKEN
        const coordStr = coordinates.map(c => `${c[0]},${c[1]}`).join(';')
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&alternatives=true&access_token=${token}`
        try {
            const response = await fetch(url)
            const data = await response.json()
            if (!response.ok || !data.routes?.length) { console.error('No route found:', data); return [] }
            return data.routes
        } catch (error) {
            console.error('Directions request error:', error)
            return []
        }
    }

    function getObstacleCenter(obstacle) {
        if (obstacle.location.type === 'Point') return obstacle.location.coordinates
        const coords = obstacle.location.coordinates
        return coords[Math.floor(coords.length / 2)]
    }

    function createDetourWaypoints(obstacle) {
        const center   = turf.point(getObstacleCenter(obstacle))
        const bearings = [0, 90, 180, -90]
        return DETOUR_DISTANCES_KM.flatMap(dist =>
            bearings.map(bearing =>
                turf.destination(center, dist, bearing, { units: 'kilometers' }).geometry.coordinates
            )
        )
    }

    async function getBestDetourRoute(start, end, obstacle) {
        const waypoints = createDetourWaypoints(obstacle)
        const allRoutes = (await Promise.all(waypoints.map(wp => requestRoutes([start, wp, end])))).flat()
        const scored    = sortScoredRoutes(allRoutes.map(scoreRoute))
        return scored.length > 0 ? scored[0] : null
    }

    async function getAndDrawRoute(start, end) {
        const directRoutes = await requestRoutes([start, end])
        if (directRoutes.length === 0) return

        const initialBest = getBestRoute(directRoutes)
        let chosenRoute   = initialBest

        if (initialBest.obstacleCount > 0) {
            const detour = await getBestDetourRoute(start, end, initialBest.obstacles[0])
            if (detour && detour.obstacleCount < initialBest.obstacleCount) {
                chosenRoute = detour
                console.log('Detour selected:', { prev: initialBest.obstacleCount, new: detour.obstacleCount })
            } else {
                console.log('No better detour found')
            }
        }

        drawRoute(chosenRoute.route.geometry)
        visuals.showOnlyRouteObstacles(chosenRoute.obstacles)
        updateRouteMessage(chosenRoute.obstacles)
    }

    return {
        routeMode, routePoints, routeMarkers, routeOptionsOpen, routeMessage, routeHasObstacles,
        addRoutePointMarker, clearRoute, closeRouteMode, startRouteMode, getAndDrawRoute,
    }
}
