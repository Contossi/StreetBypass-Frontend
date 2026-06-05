<template>
    <div ref="mapContainer" class ="map-container" />
</template>


<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const mapContainer = ref(null)
let map = null

onMounted(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
    map = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [13.8496, 44.8683],
        zoom: 13,
    })
})

onUnmounted(() => {
    map?.remove()
})
console.log(mapContainer.value)
</script>


<style scoped>
.map-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
</style>