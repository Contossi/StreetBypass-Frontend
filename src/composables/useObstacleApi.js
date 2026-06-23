const BASE = 'http://localhost:3000/api'

export function useObstacleApi(authHeader, onUnauthorized) {
    async function apiFetch(url, options = {}) {
        const { headers = {}, ...rest } = options
        const response = await fetch(url, { ...rest, headers: { ...authHeader(), ...headers } })
        if (response.status === 401) { onUnauthorized(); return null }
        return response
    }

    async function saveObstacle(obstacle) {
        try {
            const response = await apiFetch(`${BASE}/obstacles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(obstacle)
            })
            if (!response) return null
            if (!response.ok) { console.error('Backend error', await response.json()); return null }
            const { obstacle: saved } = await response.json()
            return saved
        } catch (error) {
            console.error('Fetch error:', error)
            return null
        }
    }

    async function deleteObstacle(id) {
        try {
            const response = await apiFetch(`${BASE}/obstacles/${id}`, { method: 'DELETE' })
            if (!response) return false
            if (!response.ok) { console.error('Delete error:', await response.json()); return false }
            return true
        } catch (error) {
            console.error('Fetch delete error:', error)
            return false
        }
    }

    async function updateObstacle(id, type, location) {
        try {
            const response = await apiFetch(`${BASE}/obstacles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, location })
            })
            if (!response) return null
            const data = await response.json()
            if (!response.ok) { console.error('Update error:', data); return null }
            return data.obstacle
        } catch (error) {
            console.error('Fetch update error:', error)
            return null
        }
    }

    return { saveObstacle, deleteObstacle, updateObstacle }
}
