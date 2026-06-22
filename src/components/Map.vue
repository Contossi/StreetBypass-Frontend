

<template>
    <div class="map-Container">
        <div ref="mapContainer" class ="map-container"></div>
            <button class="add-button" @click="toggleMenu">
                +
            </button>

            <button class="route-button" @click="startRouteMode">
                Kreni s navigacijom
            </button>
            <div
            v-if="routeMessage"
            class="route-message"
            :class="routeHasObstacles ? 'route-message-warning' : 'route-message-clear'"
            >
            <span>{{ routeMessage }}</span>
            <button
            classs="route-message-close"
            @click="closeRouteMode"
            aria-label="Zatvori navigaciju"
            >
            x
            </button>
            </div>
            <button
            class = "route-options-button"
            @click="routeOptionsOpen = !routeOptionsOpen"
            >
                Prepreke
            </button>
            <div v-if="routeOptionsOpen" class="route-options">
                <div class="route-options-title">Izbjegavaj</div>
            

            <label>
                <input v-model="avoidTypes" type="checkbox" value="lp1">
                Ležeći policajac 1
            </label>
            <label>
                <input v-model="avoidTypes" type="checkbox" value="lp2">
                Ležeći policajac 2
            </label>
            <label>
                <input v-model="avoidTypes" type="checkbox" value="lp3">
                Ležeći policajac 3
            </label>
            <label>
                <input v-model="avoidTypes" type="checkbox" value="lp4">
                Ležeći policajac 4
            </label>
            <label>
                <input v-model="avoidTypes" type="checkbox" value="lp5">
                Ležeći policajac 5
            </label>
            <label>
                <input v-model="avoidTypes" type="checkbox" value="semafor">
                Semafore
            </label>

            <label>
                <input v-model="avoidTypes" type="checkbox" value="kamera">
                Kamere
            </label>

            <label>
                <input v-model="avoidTypes" type="checkbox" value="sljunak">
                Šljunak
            </label>

            <label>
                <input v-model="avoidTypes" type="checkbox" value="stara-cesta">
                Stare ceste
            </label>
            </div>

            <div v-if="menuOpen" class="add-menu">
                <button @click="toggleLpMenu">
                    Ležeći policajac
                </button>

                <div v-if="lpMenuOpen" class="lpMenu">
                    <button @click="selectObstacle('lp1')">LP1</button>
                    <button @click="selectObstacle('lp2')">LP2</button>
                    <button @click="selectObstacle('lp3')">LP3</button>
                    <button @click="selectObstacle('lp4')">LP4</button>
                    <button @click="selectObstacle('lp5')">LP5</button>
                </div>
                <button @click="selectObstacle('semafor')">Semafor</button>
                <button @click="selectObstacle('kamera')">Kamera</button>
                <button @click ="selectObstacle('stara-cesta')">Stara cesta</button>
                <button @click ="selectObstacle('sljunak')">Šljunak</button> 
            </div>
    </div>   
</template>


<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as turf from '@turf/turf'

import sljunak from '../assets/sljunak.png'
import pothole from '../assets/pothole.png'
import kamera from '../assets/speed.png'
import semafor from '../assets/traffic-light.png'

const mapContainer = ref(null)
const menuOpen =ref(false)
const lpMenuOpen = ref(false)
const selectedType = ref(null)
const routeMode = ref(false)
const routePoints = ref([])
const routeMarkers = ref([])
const lineObstaclePoints = ref([])
const lineObstacleMarkers = ref([])
const allObstacles = ref([])
const routeOptionsOpen =ref(false)
const avoidTypes = ref([
    'lp1',
    'lp2',
    'lp3',
    'lp4',
    'lp5',
    'semafor',
    'kamera',
    'sljunak',
    'stara-cesta'
])
const routeMessage = ref('')
const routeHasObstacles = ref(false)
const obstacleVisuals = new Map()
const DETOUR_DISTANCES_KM = [0.08, 0.5 , 1.0, 2.0]
let map = null


function toggleMenu(){
    menuOpen.value =!menuOpen.value
}
function toggleLpMenu(){
    lpMenuOpen.value = !lpMenuOpen.value
}
function selectObstacle(type) {
    selectedType.value = type
    menuOpen.value = false
    lpMenuOpen.value =false
    console.log('Selected obstacle:',type)
}
async function saveObstacle(obstacle) {
    try {
        const response = await fetch('http://localhost:3000/api/obstacles', {
            method:'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(obstacle)
        })
        if (!response.ok) {
            const error = await response.json()
            console.error('Backend error', error)
            return
        }
        const data = await response.json()
        console.log('Saved obstacle:', data)

        return data.obstacle

    }   catch (error) {
        console.error('Fetch error: ', error)
        }
}

async function deleteObstacle(id, marker, sourceId =null, layerId=null) {
    try {
        const response = await fetch (`http://localhost:3000/api/obstacles/${id}`, 
        {
            method: 'DELETE'
        })

    
    if (!response.ok) {
            const error = await response.json()
            console.error('Delete error:', error)
            return
            
    }

    marker.remove()
    obstacleVisuals.delete(String(id))

    allObstacles.value = allObstacles.value.filter(obstacle => {
        return String(obstacle._id) !== String(id)
    })

    if(layerId && map.getLayer(layerId)) {
        map.removeLayer(layerId)
    }
    if(sourceId && map.getLayer(sourceId)) {
        map.removeSource(sourceId)
    }

    console.log('Deleted obstacle:', id)

    }   catch(error) {
        console.error('Fetch delete error:', error)
    }
}

async function loadObstacles() {
    try {
        const response = await fetch('http://localhost:3000/api/obstacles?lng=13.8496&lat=44.8683')

        if (!response.ok) {
            const error = await response.json()
            console.error('Backend error:', error)
            return
        }
        const obstacles = await response.json()

        allObstacles.value = obstacles

        obstacles.forEach(obstacle => {
            if ( obstacle.location.type === 'Point') {
                addPointMarker(obstacle)
            }
            if(obstacle.location.type === 'LineString') {
                addLineObstacle(obstacle)
            }
        })
        console.log('Loaded obstacles: ', obstacles)

      } catch (error) {
        console.error('Fetch error:', error)
      
    }
}

function getMarkerImage(type) {
    if (type === 'semafor') return semafor
    if (type === 'kamera') return kamera
    if (type === 'sljunak') return sljunak
    if (type === 'stara-cesta') return pothole

    return null
}
function addPointMarker(obstacle) {
    const el =document.createElement('div')
    el.className = `obstacle-marker obstacle-marker-${obstacle.type}`
    
    const imageSrc = getMarkerImage(obstacle.type)
    
    if(imageSrc) {
        const image = document.createElement('img')
        image.src = imageSrc
        image.alt = obstacle.type

        el.appendChild(image)
      } else {
        el.textContent = obstacle.type.startsWith('lp') ? 'LP' : '!'
    }

    const popupContent = document.createElement('div')
    popupContent.className ='obstacle-popup'

    const title = document.createElement('div')
    title.className = 'obstacle-popup-title'
    title.textContent = obstacle.type

    const deleteButton = document.createElement('button')
    deleteButton.className ='delete-obstacle-button'
    deleteButton.textContent = 'Delete obstacle'
   

    popupContent.appendChild(title)
    popupContent.appendChild(deleteButton)

    const popup = new mapboxgl.Popup({
        offset: 25
    }).setDOMContent(popupContent)


    const marker = new mapboxgl.Marker(el)
    .setLngLat(obstacle.location.coordinates)
    .setPopup(popup)
    .addTo(map)

    obstacleVisuals.set(String(obstacle._id), {
        marker
    })

    deleteButton.addEventListener('click', async () => {
        await deleteObstacle(obstacle._id, marker)
    })
}

function clearRouteMarkers() {
    routeMarkers.value.forEach(marker => {
        marker.remove()
    })
    routeMarkers.value = []
}
function clearRouteLine() {
    if (map.getLayer('route')){
        map.removeLayer('route')
    }

    if (map.getSource('route')) {
        map.removeSource('route')
    }
}
function getObstacleDisplayName(type) {
    if(type.startsWith('lp')) return type.toUpperCase()
    if (type === 'semafor') return 'Semafor'
    if (type === 'kamera') return 'Kamera'
    if (type === 'sljunak') return 'Šljunak'
    if (type === 'stara-cesta') return 'Stara cesta'

    return type
}
function updateRouteMessage(obstacles) {
    if(obstacles.length === 0) {
        routeHasObstacles.value = false
        routeMessage.value =
        'Ruta ne prolazi kroz nijednu odabranu prepreku.'
        return
    }

    const counts ={}
    obstacles.forEach(obstacle => {
        counts[obstacle.type] =(counts[obstacle.type] || 0) + 1
    })

    const summary = Object.entries(counts)
    .map(([type,count]) => `${count} x ${getObstacleDisplayName(type)}`)
    .join(', ')
    routeHasObstacles.value = true
    routeMessage.value =
    `Najbolje pronađena ruta i dalje prolazi kroz: ${summary}.`
}
function setObstacleVisibility(visual, visible) {
    if(visual.marker) {
        visual.marker.getElement().style.display = visible ? '' : 'none'
    }
    if (visual.layerId && map.getLayer(visual.layerId)) {
        map.setLayoutProperty(
            visual.layerId,
            'visibility',
            visible ? 'visible' : 'none'
        )
    }
}
function showOnlyRouteObstacles(routeObstacles) {
    const routeObstacleIds = new Set(
        routeObstacles.map(obstacle => String(obstacle._id))
    )
    obstacleVisuals.forEach((visual, obstacleId) => {
        setObstacleVisibility(
            visual,
            routeObstacleIds.has(String(obstacleId))
        )
    })
}
function showAllObstacles() {
    obstacleVisuals.forEach(visual => {
        setObstacleVisibility(visual, true)
    })
}
function closeRouteMode() {
    clearRouteMarkers()
    clearRouteLine()
    showAllObstacles()

    routeMode.value = false
    routePoints.value = []

    routeMessage.value =''
    routeHasObstacles.value = false
}   
function startRouteMode() {
    clearRouteMarkers()
    clearRouteLine()

    showAllObstacles()
    routeMessage.value = ''

    routeOptionsOpen.value = false

    routeMode.value = true
    routePoints.value = []

    selectedType.value = null
    menuOpen.value = false
    lpMenuOpen.value = false

    console.log('Route mode started')
}
function addRoutePointMarker(coords, label) {
    const el= document.createElement('div')

    el.classList.add('route-point-marker')
    el.textContent = label

    const marker = new mapboxgl.Marker(el)
    .setLngLat(coords)
    .addTo(map)

    routeMarkers.value.push(marker)
}
async function getAndDrawRoute(start, end) {
  const directRoutes = await requestRoutes([start, end])

  if (directRoutes.length === 0) {
    return
  }

  const initialBestRoute = getBestRoute(directRoutes)
  let chosenRoute = initialBestRoute

  if (initialBestRoute.obstacleCount > 0) {
    const obstacleToAvoid = initialBestRoute.obstacles[0]

    const detourRoute = await getBestDetourRoute(
      start,
      end,
      obstacleToAvoid
    )

    if (
      detourRoute &&
      detourRoute.obstacleCount < initialBestRoute.obstacleCount
    ) {
      chosenRoute = detourRoute

      console.log('Detour route selected:', {
        previousObstacles: initialBestRoute.obstacleCount,
        newObstacles: detourRoute.obstacleCount
      })
    } else {
      console.log('No better detour route found')
    }
  }

  drawRoute(chosenRoute.route.geometry)

  showOnlyRouteObstacles(chosenRoute.obstacles)
  updateRouteMessage(chosenRoute.obstacles)

  console.log('Chosen route:', {
    obstacles: chosenRoute.obstacleCount,
    types: chosenRoute.obstacles.map(obstacle => obstacle.type)
  })
}
function drawRoute(routeGeometry){
    const routeGeojson = {
        type: 'Feature',
        properties: {},
        geometry: routeGeometry
    }

    if(map.getSource('route')) {
        map.getSource('route').setData(routeGeojson)
        return
    }
    map.addSource('route', {
        type: 'geojson',
        data:routeGeojson
    })
    map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': 'lightskyblue',
            'line-width': 8,
        }
    })
}
const OBSTACLE_DISTANCE_KM = 0.015

function getObstacleFeature(obstacle) {
    if (obstacle.location.type === 'Point') {
        return turf.point(obstacle.location.coordinates)
    }
    if(obstacle.location.type === 'LineString') {
        return turf.lineString(obstacle.location.coordinates)
    }
    return null
}
function shouldAvoidObstacle(obstacle) {
    return avoidTypes.value.includes(obstacle.type)
}
function scoreRoute(route) {
    const routeFeature = turf.lineString(route.geometry.coordinates)

    const obstaclesOnRoute = allObstacles.value.filter(obstacle => {
        if(!shouldAvoidObstacle(obstacle)) {
            return false
        }
        const obstacleFeature = getObstacleFeature(obstacle)
        if(!obstacleFeature) return false

        const obstacleArea = turf.buffer(
            obstacleFeature,
            OBSTACLE_DISTANCE_KM,
            {units : 'kilometers'}
        )
        return turf.booleanIntersects(routeFeature, obstacleArea)
    })
    return {
        route,
        obstacleCount: obstaclesOnRoute.length,
        obstacles: obstaclesOnRoute
    }
}
function getBestRoute(routes) {
    const scoredRoutes = routes.map(scoreRoute)

    scoredRoutes.sort((first, second) => {
        if (first.obstacleCount !== second.obstacleCount) {
            return first.obstacleCount - second.obstacleCount
        }
        return first.route.duration -second.route.duration
    })
    console.log('Route comparison', scoredRoutes.map(item => ({
        obstacles: item.obstacleCount,
        durationSeconds: Math.round(item.route.duration),
        types: item.obstacles.map(obstacle => obstacle.type)
    })))
    return scoredRoutes[0]
}


async function requestRoutes(coordinates){
    const token = import.meta.env.VITE_MAPBOX_TOKEN

    const coordinateString = coordinates
        .map(coordinate => `${coordinate[0]},${coordinate[1]}`)
        .join(';')
    const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${coordinateString}` +
        `?geometries=geojson&overview=full&alternatives=true&access_token=${token}`

    try{
        const response = await fetch(url)
        const data = await response.json()

        if (!response.ok || !data.routes || data.routes.length === 0) {
            console.error('No route found: ', data)
            return []
        }
        return data.routes
    }   catch(error) {
        console.error('Directions request error:', error)
        return []
    }
}
function getObstacleCenter(obstacle) {
    if (obstacle.location.type === 'Point') {
        return obstacle.location.coordinates
    }
    const coordinates = obstacle.location.coordinates
    return coordinates[Math.floor(coordinates.length / 2)]
}
function createDetourWaypoints(obstacle) {
  const obstacleCenter = turf.point(getObstacleCenter(obstacle))
  const bearings = [0, 90, 180, -90]

  return DETOUR_DISTANCES_KM.flatMap(distance => {
    return bearings.map(bearing => {
      return turf.destination(
        obstacleCenter,
        distance,
        bearing,
        { units: 'kilometers' }
      ).geometry.coordinates
    })
  })
}
async function getBestDetourRoute(start, end, obstacle) {
    const waypoints =createDetourWaypoints(obstacle)

    const routeLists = await Promise.all(
        waypoints.map(waypoint => requestRoutes([start, waypoint, end]))
    )
    const scoredRoutes = routeLists
    .flat()
    .map(scoreRoute)

    if(scoredRoutes.length === 0) {
        return null
    }
    scoredRoutes.sort((first,second) => {
        if(first.obstacleCount !== second.obstacleCount) {
            return first.obstacleCount - second.obstacleCount
        }
        return first.route.duration - second.route.duration
    })
    return scoredRoutes[0]
}

function isLineObstacle(type) {
    return type === 'sljunak' || type === 'stara-cesta'
}
function addLineObstaclePointMarker(coords,label) {
    const el = document.createElement('div')
    el.className = 'line-obstacle-point-marker'
    el.textContent = label

    const marker = new mapboxgl.Marker(el)
    .setLngLat(coords)
    .addTo(map)

    lineObstacleMarkers.value.push(marker)
}

function clearLineObstaclePoints() {
    lineObstacleMarkers.value.forEach(marker => marker.remove())

    lineObstacleMarkers.value = []
    lineObstaclePoints.value = []
}
function getLineMarkerPosition(coordinates) {
    if(coordinates.length === 2) {
        const start = coordinates[0]
        const end = coordinates [1]
        return [
            (start[0] + end[0]) / 2,
            (start[1] + end[1]) / 2
        ]
    }
    return coordinates [Math.floor(coordinates.length / 2)]
}

async function getRoadGeometry(start, end) {
    const token = import.meta.env.VITE_MAPBOX_TOKEN

    const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${start[0]},${start[1]};${end[0]},${end[1]}` +
    `?geometries=geojson&overview=full&access_token=${token}`

    try {
        const response = await fetch (url)
        const data = await response.json()

        if (!response.ok || !data.routes || data.routes.length === 0) {
            console.error('No road route found:', data)
            return null
        }

        return data.routes[0].geometry

    }   catch (error) {
        console.error('Road geometry error:', error)
        return null
    }
}

async function handleLineObstaclePoint(coords) {
    lineObstaclePoints.value.push(coords)

    const label = lineObstaclePoints.value.length === 1 ? 'A' : 'B'
    addLineObstaclePointMarker(coords, label)

    if (lineObstaclePoints.value.length !== 2) return

    const type =selectedType.value
    const start = lineObstaclePoints.value[0]
    const end = lineObstaclePoints.value[1]

    const roadGeometry = await getRoadGeometry(start, end)

    if (!roadGeometry) {
        clearLineObstaclePoints()
        selectedType.value = null
        return
    }
    const obstacle ={
        type,
        location: roadGeometry
    }
    const savedObstacle = await saveObstacle(obstacle)
    clearLineObstaclePoints()
    selectedType.value = null
    if (savedObstacle) {
        allObstacles.value.push(savedObstacle)
        addLineObstacle(savedObstacle)
    }
}

function addLineObstacle(obstacle) {
   const sourceId = `line-obstacle-${obstacle._id}`
   const layerId = `line-obstacle-layer-${obstacle._id}`

   const color = obstacle.type === 'sljunak' ? 'peru' : 'dimgray'

   if (map.getLayer(layerId)) {
     map.removeLayer(layerId)
   }

   if (map.getSource(sourceId)) {
     map.removeSource(sourceId)
   }

   map.addSource(sourceId, {
     type: 'geojson',
     data: {
       type: 'Feature',
       properties: {
         obstacleId: obstacle._id,
         type: obstacle.type
       },
       geometry: obstacle.location
     }
   })

   map.addLayer({
     id: layerId,
     type: 'line',
     source: sourceId,
     layout: {
       'line-cap': 'round',
       'line-join': 'round'
     },
     paint: {
       'line-color': color,
       'line-width': 10,
       'line-opacity': 0.8
     }
   })

   const iconEl = document.createElement('div')
   iconEl.className = `obstacle-marker obstacle-marker-${obstacle.type}`

   const imageSrc = getMarkerImage(obstacle.type)

   if (imageSrc) {
     const image = document.createElement('img')
     image.src = imageSrc
     image.alt = obstacle.type
     iconEl.appendChild(image)
   }

   const popupContent = document.createElement('div')
   popupContent.className = 'obstacle-popup'

   const title = document.createElement('div')
   title.className = 'obstacle-popup-title'
   title.textContent = obstacle.type === 'sljunak'
    ? 'Šljunak'
    : 'Stara cesta'

   const deleteButton = document.createElement('button')
   deleteButton.className = 'delete-obstacle-button'
   deleteButton.textContent = 'Delete obstacle'

   popupContent.appendChild(title)
   popupContent.appendChild(deleteButton)

   const popup = new mapboxgl.Popup({
    offset: 25
   }).setDOMContent(popupContent)

   const marker = new mapboxgl.Marker(iconEl)
    .setLngLat(getLineMarkerPosition(obstacle.location.coordinates))
    .setPopup(popup)
    .addTo(map)

    obstacleVisuals.set(String(obstacle._id), {
        marker,
        sourceId,
        layerId
    })

  deleteButton.addEventListener('click', async () => {
    await deleteObstacle(obstacle._id, marker, sourceId, layerId)
  })
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
    })     
    map.on('click', async (event) => {
        const coords = [event.lngLat.lng, event.lngLat.lat]

        if(routeMode.value) {
            routePoints.value.push(coords)

            if(routePoints.value.length === 1){
                addRoutePointMarker(coords, 'A')
            }
            if(routePoints.value.length === 2) {
                addRoutePointMarker(coords, 'B')

                await getAndDrawRoute(routePoints.value[0], routePoints.value[1])
               
                routeMode.value = false
                routePoints.value = []
            }
            return
        }
        if (!selectedType.value) return
        if (isLineObstacle(selectedType.value)) {
            await handleLineObstaclePoint(coords)
            return
        }
        const obstacle = {
            type:selectedType.value,
            location: {
                type:'Point', 
                coordinates: coords
            }
        }
        const savedObstacle = await saveObstacle(obstacle)
        if(savedObstacle) {
            allObstacles.value.push(savedObstacle)
            addPointMarker(savedObstacle)
        }
        selectedType.value =null
    })

})
</script>


<style scoped>
.map-Container{
    position: fixed;
    top:0;
    left:0;
    width: 100%;
    height:100%;
}
.map-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
.add-button{
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 10;

    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;

    background: orange;
    color: black;
    font-size: 32px;
    cursor: pointer;

    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}

.add-menu {
    position:absolute;
    top:80px;
    left:20px;
    z-index:10;
    
    display:flex;
    flex-direction: column;
    gap: 8px;

    background:orange;
    padding:12px;
    border-radius: 10px;

    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}
.lpMenu {
    display:flex;
    flex-direction:row;
    gap:6px;
    margin-left: 16px;
    padding-left:8px;
    border-left: 2px solid black;
}

.add-menu button{
    padding: 8px 12px;
    border:1px solid black;
    background:orange;
    cursor: pointer;
    text-align: left;
}

.route-button {
    position: absolute;
    top:20px;
    left:50%;
    transform:translate(-50%);
    z-index:999;

    padding: 12px 24px;
    border-radius: 24px;
    border: 2px solid black;

    background: orange;
    color:black;
    font-size:16px;
    font-weight: bold;
    cursor: pointer;

    box-shadow:0 2px 10px rgba(0,0,0,0.25);
}
.route-options-button {
  position: absolute;
  top: 20px;
  left: calc(50% + 155px);
  z-index: 999;

  padding: 10px 14px;
  border: 2px solid black;
  border-radius: 8px;

  background: orange;
  color: black;
  font-weight: bold;
  cursor: pointer;
}

.route-options {
  position: absolute;
  top: 72px;
  left: 50%;
  z-index: 999;
  transform: translateX(-50%);

  min-width: 190px;
  padding: 12px;

  display: flex;
  flex-direction: column;
  gap: 9px;

  background: white;
  border: 2px solid black;
  border-radius: 8px;
}

.route-options-title {
  font-weight: bold;
}

.route-options label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.route-message {
  position: relative;
  top: 78px;
  left: 50%;
  z-index: 999;
  transform: translateX(-50%);

  max-width: 420px;
  padding: 10px 42px 10px 14px;

  border: 2px solid black;
  border-radius: 8px;

  font-size: 14px;
  font-weight: bold;
  text-align: center;
}

.route-message-clear {
  background: lightgreen;
  color: black;
}

.route-message-warning {
  background: lightyellow;
  color: black;
}
.route-message-close{
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);

    border: none;
    background: transparent;
    
    color: black;
    font-size: 22px;
    font-weight: bolt;
    line-height: 1;
    cursor: pointer;

}
</style>