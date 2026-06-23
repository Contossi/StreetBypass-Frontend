import mapboxgl from 'mapbox-gl'
import { OBSTACLE_META, POINT_TYPES, LINE_TYPES } from '../constants/obstacles.js'

export function getMarkerImage(type)         { return OBSTACLE_META[type]?.icon ?? null }
export function getObstacleDisplayName(type) { return OBSTACLE_META[type]?.label ?? type }
export function isLineObstacle(type)         { return LINE_TYPES.includes(type) }

export function createLabelMarker(map, coords, label, className) {
    const el = document.createElement('div')
    el.className = className
    el.textContent = label
    return new mapboxgl.Marker(el).setLngLat(coords).addTo(map)
}

export function createObstacleMarkerEl(type) {
    const el = document.createElement('div')
    el.className = `obstacle-marker obstacle-marker-${type}`
    const src = getMarkerImage(type)
    if (src) {
        const img = document.createElement('img')
        img.src = src
        img.alt = type
        el.appendChild(img)
    } else {
        el.textContent = type.startsWith('lp') ? 'LP' : '!'
    }
    return el
}

export function buildObstaclePopup(obstacle, types, onUpdate, onDelete) {
    const container = document.createElement('div')
    container.className = 'obstacle-popup'

    const title = document.createElement('div')
    title.className = 'obstacle-popup-title'
    title.textContent = getObstacleDisplayName(obstacle.type)

    const select = document.createElement('select')
    select.className = 'obstacle-type-select'
    types.forEach(t => {
        const opt = document.createElement('option')
        opt.value = t
        opt.textContent = getObstacleDisplayName(t)
        if (t === obstacle.type) opt.selected = true
        select.appendChild(opt)
    })

    const changeBtn = document.createElement('button')
    changeBtn.className = 'change-type-button'
    changeBtn.textContent = 'Promijeni tip'
    changeBtn.addEventListener('click', () => onUpdate(select.value))

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'delete-obstacle-button'
    deleteBtn.textContent = 'Delete obstacle'
    deleteBtn.addEventListener('click', onDelete)

    container.append(title, select, changeBtn, deleteBtn)
    return container
}

export function getLineMarkerPosition(coordinates) {
    if (coordinates.length === 2) {
        const [s, e] = coordinates
        return [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2]
    }
    return coordinates[Math.floor(coordinates.length / 2)]
}
