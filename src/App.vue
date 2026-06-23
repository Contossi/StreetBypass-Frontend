<template>
    <Auth v-if="!authenticated" @authenticated="onAuthenticated" />
    <Map v-else @logout="onLogout" />
</template>

<script setup>
import { ref } from 'vue'
import Map from './components/Map.vue'
import Auth from './components/Auth.vue'

const authenticated = ref(!!localStorage.getItem('jwt_token'))

function onAuthenticated() {
    authenticated.value = true
}

function onLogout() {
    localStorage.removeItem('jwt_token')
    authenticated.value = false
}
</script>
