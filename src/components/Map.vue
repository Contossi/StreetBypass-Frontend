<template>
    <div class="map-Container">
        <div ref="mapContainer" class ="map-container"></div>
            <button class="add-button" @click="toggleMenu">
                +
            </button>

            <button class="route-button" @click="startRouteMode">
                Kreni s navigacijom
            </button>

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
                <button>Stara cesta</button>
                <button>Šljunak</button>   
            </div>
    </div>
</template>


<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const mapContainer = ref(null)
const menuOpen =ref(false)
const lpMenuOpen = ref(false)
const selectedType = ref(null)
const routeMode = ref(false)
const routePoints = ref([])
const routeMarkers = ref([])
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

    }   catch (error) {
        console.error('Fetch error: ', error)
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

        obstacles.forEach(obstacle => {
            if ( obstacle.location.type === 'Point') {
                addPointMarker(obstacle)
            }
        })
        console.log('Loaded obstacles: ', obstacles)

      } catch (error) {
        console.error('Fetch error:', error)
      
    }
}
function addPointMarker(obstacle) {
    const el =document.createElement('div')
    el.className = `obstacle-marker obstacle-marker-${obstacle.type}`
    el.textContent =getMarkerIcon(obstacle.type)

    new mapboxgl.Marker(el)
    .setLngLat(obstacle.location.coordinates)
    .addTo(map)
}
function getMarkerIcon(type){
    if(type.startsWith('lp')) return 'Lp'
    if(type === 'semafor') return 'semafor'
    if(type === 'kamera') return 'kamera'
    return '!'
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
function startRouteMode() {
    clearRouteMarkers()
    clearRouteLine()

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
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const url=
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${start[0]},${start[1]};${end[0]},${end[1]}` +
        `?geometries=geojson&overview=full&access_token=${token}`
    try{
        const response = await fetch(url)
        const data = await response.json()

        if (!data.routes || data.routes.length === 0) {
            console.error('No route found: ', data)
            return
        }
        const routeGeometry = data.routes[0].geometry
        drawRoute(routeGeometry)

        console.log('Route data:', data.routes[0])
    }   catch (error) {
        console.error('Route error:', error)
    }
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

        const obstacle = {
            type:selectedType.value,
            location: {
                type:'Point', 
                coordinates: coords
            }
        }
        await saveObstacle(obstacle)
        addPointMarker(obstacle)

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
</style>