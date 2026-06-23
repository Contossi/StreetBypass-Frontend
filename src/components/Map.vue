<template>
    <div class="map-Container">
        <div ref="mapContainer" class="map-container"></div>

        <button class="add-button" @click="toggleMenu">+</button>
        <button class="logout-button" @click="handleUnauthorized">Odjava</button>
        <button class="route-button" @click="startRouteMode">Kreni s navigacijom</button>

        <div
            v-if="routeMessage"
            class="route-message"
            :class="routeHasObstacles ? 'route-message-warning' : 'route-message-clear'"
        >
            <span>{{ routeMessage }}</span>
            <button class="route-message-close" @click="closeRouteMode" aria-label="Zatvori navigaciju">x</button>
        </div>

        <button class="route-options-button" @click="routeOptionsOpen = !routeOptionsOpen">Prepreke</button>
        <div v-if="routeOptionsOpen" class="route-options">
            <div class="route-options-title">Izbjegavaj</div>
            <label v-for="opt in ALL_OBSTACLE_TYPES" :key="opt.value">
                <input v-model="avoidTypes" type="checkbox" :value="opt.value">
                {{ opt.label }}
            </label>
        </div>

        <button
            class="toggle-obstacles-button"
            :class="obstaclesVisible ? 'toggle-obstacles-on' : 'toggle-obstacles-off'"
            @click="toggleObstaclesVisibility"
        >
            {{ obstaclesVisible ? 'Sakrij prepreke' : 'Prikaži prepreke' }}
        </button>

        <div v-if="menuOpen" class="add-menu">
            <button @click="toggleLpMenu">Ležeći policajac</button>
            <div v-if="lpMenuOpen" class="lpMenu">
                <button v-for="lp in LP_TYPES" :key="lp.type" @click="selectObstacle(lp.type)" class="lp-button">
                    <img :src="lp.icon" :alt="lp.type" class="lp-icon">
                    <span>{{ lp.type.toUpperCase() }}</span>
                </button>
            </div>
            <button @click="selectObstacle('semafor')">Semafor</button>
            <button @click="selectObstacle('kamera')">Kamera</button>
            <button @click="selectObstacle('stara-cesta')">Stara cesta</button>
            <button @click="selectObstacle('sljunak')">Šljunak</button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

import { LP_TYPES, ALL_OBSTACLE_TYPES } from '../constants/obstacles.js'
import { isLineObstacle, createLabelMarker } from '../utils/mapUtils.js'
import { useObstacleApi } from '../composables/useObstacleApi.js'
import { useObstacleVisuals } from '../composables/useObstacleVisuals.js'
import { useRoute } from '../composables/useRoute.js'


const emit = defineEmits(['logout'])

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem('jwt_token')}` } }
function handleUnauthorized() { localStorage.removeItem('jwt_token'); emit('logout') }


const mapContainer = ref(null)
const menuOpen     = ref(false)
const lpMenuOpen   = ref(false)
const selectedType = ref(null)
const avoidTypes   = ref([])
const allObstacles = ref([])

const lineObstaclePoints  = ref([])
const lineObstacleMarkers = ref([])

let viewportRequestId = 0
let map = null


const api     = useObstacleApi(authHeader, handleUnauthorized)
const visuals = useObstacleVisuals({ getMap: () => map, allObstacles, api })
const route   = useRoute({ getMap: () => map, allObstacles, avoidTypes, visuals })

const {
    obstaclesVisible, toggleObstaclesVisibility,
    addPointMarker, addLineObstacle,
    removeObstacleVisual, setObstacleVisibility,
    obstacleVisuals, routeActive, activeRouteObstacleIds,
} = visuals

const {
    routeMode, routePoints, routeOptionsOpen, routeMessage, routeHasObstacles,
    addRoutePointMarker, closeRouteMode, startRouteMode, getAndDrawRoute,
} = route


function toggleMenu()   { menuOpen.value = !menuOpen.value }
function toggleLpMenu() { lpMenuOpen.value = !lpMenuOpen.value }
function selectObstacle(type) { selectedType.value = type; menuOpen.value = false; lpMenuOpen.value = false }


async function loadObstacles() {
    if (!map) return
    const bounds    = map.getBounds()
    const requestId = ++viewportRequestId
    const params    = new URLSearchParams({
        west: String(bounds.getWest()), south: String(bounds.getSouth()),
        east: String(bounds.getEast()), north: String(bounds.getNorth()),
    })

    try {
        const response = await fetch(`https://streetbypass-backend.onrender.com/api/obstacles?${params}`)
        if (!response.ok) { console.error('Backend error:', await response.json()); return }

        const obstacles = await response.json()
        if (requestId !== viewportRequestId) return

        const visibleIds = new Set(obstacles.map(o => String(o._id)))
        obstacleVisuals.forEach((_, id) => { if (!visibleIds.has(id)) removeObstacleVisual(id) })

        obstacles.forEach(obstacle => {
            const id = String(obstacle._id)
            if (obstacleVisuals.has(id)) return
            if (obstacle.location.type === 'Point')      addPointMarker(obstacle)
            if (obstacle.location.type === 'LineString') addLineObstacle(obstacle)
        })

        if (!obstaclesVisible.value || routeActive.value) {
            obstacleVisuals.forEach((visual, id) => {
                const isOnRoute = routeActive.value && activeRouteObstacleIds.value.has(id)
                setObstacleVisibility(visual, isOnRoute || obstaclesVisible.value)
            })
        }

        allObstacles.value = obstacles
    } catch (error) {
        console.error('Fetch error:', error)
    }
}



function clearLineObstaclePoints() {
    lineObstacleMarkers.value.forEach(m => m.remove())
    lineObstacleMarkers.value = []
    lineObstaclePoints.value  = []
}

async function getRoadGeometry(start, end) {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&access_token=${token}`
    try {
        const response = await fetch(url)
        const data = await response.json()
        if (!response.ok || !data.routes?.length) { console.error('No road route:', data); return null }
        return data.routes[0].geometry
    } catch (error) {
        console.error('Road geometry error:', error)
        return null
    }
}

async function handleLineObstaclePoint(coords) {
    lineObstaclePoints.value.push(coords)
    const label = lineObstaclePoints.value.length === 1 ? 'A' : 'B'
    lineObstacleMarkers.value.push(createLabelMarker(map, coords, label, 'line-obstacle-point-marker'))

    if (lineObstaclePoints.value.length !== 2) return

    const type         = selectedType.value
    const [start, end] = lineObstaclePoints.value
    const roadGeometry = await getRoadGeometry(start, end)

    clearLineObstaclePoints()
    selectedType.value = null
    if (!roadGeometry) return

    const saved = await api.saveObstacle({ type, location: roadGeometry })
    if (saved) { allObstacles.value.push(saved); addLineObstacle(saved) }
}


onMounted(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
    map = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [13.8496, 44.8683],
        zoom: 13,
    })

    map.on('load', () => {
        loadObstacles()
        map.on('moveend', loadObstacles)
    })

    map.on('click', async event => {
        const coords = [event.lngLat.lng, event.lngLat.lat]

        if (routeMode.value) {
            routePoints.value.push(coords)
            if (routePoints.value.length === 1) addRoutePointMarker(coords, 'A')
            if (routePoints.value.length === 2) {
                addRoutePointMarker(coords, 'B')
                await getAndDrawRoute(routePoints.value[0], routePoints.value[1])
                routeMode.value   = false
                routePoints.value = []
            }
            return
        }

        if (!selectedType.value) return

        if (isLineObstacle(selectedType.value)) {
            await handleLineObstaclePoint(coords)
            return
        }

        const saved = await api.saveObstacle({ type: selectedType.value, location: { type: 'Point', coordinates: coords } })
        if (saved) { allObstacles.value.push(saved); addPointMarker(saved) }
        selectedType.value = null
    })
})
</script>


<style scoped>
.map-Container {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
}
.map-container {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
}

.add-button {
    position: absolute;
    top: 20px; left: 20px;
    z-index: 10;
    width: 48px; height: 48px;
    border-radius: 50%; border: none;
    background: orange; color: black;
    font-size: 32px; cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}

.logout-button {
    position: absolute;
    top: 20px; right: 20px;
    z-index: 10;
    padding: 10px 16px;
    border-radius: 20px; border: 2px solid black;
    background: crimson; color: white;
    font-size: 14px; font-weight: bold; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background 0.15s;
}
.logout-button:hover { background: darkred; }

.add-menu {
    position: absolute;
    top: 80px; left: 20px;
    z-index: 10;
    display: flex; flex-direction: column; gap: 8px;
    background: orange; padding: 12px; border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}
.add-menu button {
    padding: 8px 12px;
    border: 1px solid black; background: orange;
    cursor: pointer; text-align: left;
}
.lpMenu {
    display: flex; flex-direction: row; flex-wrap: wrap; gap: 6px;
    margin-left: 16px; padding-left: 8px;
    border-left: 2px solid black;
}
.lp-button {
    display: flex; flex-direction: column; align-items: center;
    gap: 2px; padding: 4px 6px;
}
.lp-icon { width: 28px; height: 28px; object-fit: contain; }

.route-button {
    position: absolute;
    top: 20px; left: 50%;
    transform: translate(-50%);
    z-index: 999;
    padding: 12px 24px;
    border-radius: 24px; border: 2px solid black;
    background: orange; color: black;
    font-size: 16px; font-weight: bold; cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}

.route-options-button {
    position: absolute;
    top: 20px; left: calc(50% + 155px);
    z-index: 999;
    padding: 10px 14px;
    border: 2px solid black; border-radius: 8px;
    background: orange; color: black;
    font-weight: bold; cursor: pointer;
}

.route-options {
    position: absolute;
    top: 72px; left: 50%;
    z-index: 999;
    transform: translateX(-50%);
    min-width: 190px; padding: 12px;
    display: flex; flex-direction: column; gap: 9px;
    background: white; border: 2px solid black; border-radius: 8px;
}
.route-options-title { font-weight: bold; }
.route-options label { display: flex; align-items: center; gap: 8px; cursor: pointer; }

.route-message {
    position: relative;
    top: 78px; left: 50%;
    z-index: 999;
    transform: translateX(-50%);
    max-width: 420px;
    padding: 10px 42px 10px 14px;
    border: 2px solid black; border-radius: 8px;
    font-size: 14px; font-weight: bold; text-align: center;
}
.route-message-clear   { background: lightgreen; color: black; }
.route-message-warning { background: lightyellow; color: black; }

.route-message-close {
    position: absolute;
    top: 50%; right: 10px;
    transform: translateY(-50%);
    width: 28px; height: 28px;
    border-radius: 50%; border: none;
    background: crimson; color: white;
    font-size: 16px; font-weight: bold; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    transition: background 0.15s;
}
.route-message-close:hover { background: darkred; }

.toggle-obstacles-button {
    position: absolute;
    top: 78px; right: 20px;
    z-index: 10;
    padding: 10px 16px;
    border-radius: 20px; border: 2px solid black;
    font-size: 14px; font-weight: bold; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background 0.15s, color 0.15s;
}
.toggle-obstacles-on  { background: orange; color: black; }
.toggle-obstacles-off { background: #333;   color: white; }
</style>

<style>
.obstacle-type-select {
    width: 100%; padding: 4px 6px; margin: 6px 0 2px;
    border: 1px solid #ccc; border-radius: 4px; font-size: 13px;
}
.change-type-button {
    width: 100%; padding: 5px; margin-bottom: 6px;
    background: orange; border: 1px solid black; border-radius: 4px;
    cursor: pointer; font-weight: bold; font-size: 13px;
}
</style>
