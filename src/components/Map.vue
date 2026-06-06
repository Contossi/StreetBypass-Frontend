<template>
    <div class="map-Container">
        <div ref="mapContainer" class ="map-container"></div>
            <button class="add-button" @click="toggleMenu">
                +
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
function addPointMarker(obstacle) {
    const el =document.createElement('div')
    el.className = `marker marker-${obstacle.type}`
    el.textContent =getMarkerIcon(obstacle.type)

    new mapboxgl.Marker(el)
    .setLngLat(obstacle.location.coordinates)
    .addTo(map)
}
function getMarkerIcon(type){
    if(type.startsWith('lp')) return 'Miao'
    if(type === 'semafor') return 'Miao22'
    if(type === 'kamera') return 'Mrnjao'
    return '!'
}
onMounted(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
        map = new mapboxgl.Map({
            container: mapContainer.value,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [13.8496, 44.8683],
            zoom: 13,
        })    
    map.on('click', async (event) => {
        if (!selectedType.value) return

        const lng =event.lngLat.lng
        const lat =event.lngLat.lat
        const obstacle = {
            type:selectedType.value,
            location: {
                type:'Point', 
                coordinates: [lng,lat]
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
.marker {
    width:32px;
    height:32px;
    border-radius:50%;
    background:orange;
    border: 2px solid black;

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:18px;
    cursor:pointer;
}
.marker-lp1,
.marker-lp2,
.marker-lp3,
.marker-lp4,
.marker-lp5{
    background:orange;
}
.marker-kamera{
    background:orange;
}

</style>