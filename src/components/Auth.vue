<template>
    <div class="auth-container">
        <div class="auth-box">
            <h2>{{ isLogin ? 'Prijava' : 'Registracija' }}</h2>

            <form @submit.prevent="isLogin ? login() : register()">
                <input
                    v-model="username"
                    type="text"
                    placeholder="Korisničko ime"
                    autocomplete="username"
                    required
                />
                <input
                    v-model="password"
                    type="password"
                    placeholder="Lozinka"
                    autocomplete="current-password"
                    required
                />
                <button type="submit" :disabled="loading">
                    {{ loading ? 'Pričekaj...' : (isLogin ? 'Prijavi se' : 'Registriraj se') }}
                </button>
            </form>

            <p v-if="error" class="auth-error">{{ error }}</p>
            <p v-if="success" class="auth-success">{{ success }}</p>

            <button class="auth-toggle" @click="toggleMode">
                {{ isLogin ? 'Nemaš račun? Registriraj se' : 'Već imaš račun? Prijavi se' }}
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['authenticated'])

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

function toggleMode() {
    isLogin.value = !isLogin.value
    error.value = ''
    success.value = ''
}

async function register() {
    loading.value = true
    error.value = ''
    success.value = ''
    try {
        const response = await fetch('https://streetbypass-backend.onrender.com/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.value, password: password.value })
        })
        const data = await response.json()
        if (!response.ok) {
            error.value = data.error || 'Greška pri registraciji'
            return
        }
        success.value = 'Registracija uspješna! Možeš se prijaviti.'
        isLogin.value = true
        username.value = ''
        password.value = ''
    } catch {
        error.value = 'Greška pri spajanju na poslužitelj'
    } finally {
        loading.value = false
    }
}

async function login() {
    loading.value = true
    error.value = ''
    success.value = ''
    try {
        const response = await fetch('https://streetbypass-backend.onrender.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.value, password: password.value })
        })
        const data = await response.json()
        if (!response.ok) {
            error.value = 'Neispravno korisničko ime ili lozinka'
            return
        }
        if (!data.jwt_token) {
            error.value = 'Greška servera — pokušaj ponovo'
            return
        }
        localStorage.setItem('jwt_token', data.jwt_token)
        emit('authenticated')
    } catch {
        error.value = 'Greška pri spajanju na poslužitelj'
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.auth-container {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
}

.auth-box {
    background: white;
    padding: 40px 36px;
    border-radius: 12px;
    width: 340px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    gap: 14px;
}

h2 {
    margin: 0 0 6px;
    font-size: 22px;
    text-align: center;
}

form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

input {
    padding: 10px 12px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
}

input:focus {
    border-color: orange;
}

form button {
    padding: 11px;
    background: orange;
    border: none;
    border-radius: 6px;
    font-size: 15px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.15s;
}

form button:hover:not(:disabled) {
    background: darkorange;
}

form button:disabled {
    opacity: 0.6;
    cursor: default;
}

.auth-error {
    color: crimson;
    font-size: 13px;
    text-align: center;
    margin: 0;
}

.auth-success {
    color: green;
    font-size: 13px;
    text-align: center;
    margin: 0;
}

.auth-toggle {
    background: none;
    border: none;
    color: #555;
    font-size: 13px;
    cursor: pointer;
    text-align: center;
    text-decoration: underline;
    padding: 0;
}

.auth-toggle:hover {
    color: orange;
}
</style>
