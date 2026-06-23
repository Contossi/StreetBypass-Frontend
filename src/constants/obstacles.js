import sljunak      from '../assets/sljunak.png'
import pothole      from '../assets/pothole.png'
import kamera       from '../assets/speed.png'
import semafor      from '../assets/traffic-light.png'
import crv          from '../assets/crv.png'
import kornjaca     from '../assets/kornjaca.png'
import kornjacastup from '../assets/kornjacastup.png'
import kameni       from '../assets/kameni.png'
import treskanje    from '../assets/treskanje.png'

export const OBSTACLE_META = {
    lp1:           { icon: crv,           label: 'LP1' },
    lp2:           { icon: kornjaca,      label: 'LP2' },
    lp3:           { icon: kornjacastup,  label: 'LP3' },
    lp4:           { icon: kameni,        label: 'LP4' },
    lp5:           { icon: treskanje,     label: 'LP5' },
    semafor:       { icon: semafor,       label: 'Semafor' },
    kamera:        { icon: kamera,        label: 'Kamera' },
    sljunak:       { icon: sljunak,       label: 'Šljunak',     lineColor: 'peru' },
    'stara-cesta': { icon: pothole,       label: 'Stara cesta', lineColor: 'dimgray' },
}

export const POINT_TYPES = ['lp1', 'lp2', 'lp3', 'lp4', 'lp5', 'semafor', 'kamera']
export const LINE_TYPES  = ['sljunak', 'stara-cesta']

export const LP_TYPES = POINT_TYPES
    .filter(t => t.startsWith('lp'))
    .map(t => ({ type: t, icon: OBSTACLE_META[t].icon }))

export const ALL_OBSTACLE_TYPES = [
    { value: 'lp1',          label: 'Ležeći policajac 1' },
    { value: 'lp2',          label: 'Ležeći policajac 2' },
    { value: 'lp3',          label: 'Ležeći policajac 3' },
    { value: 'lp4',          label: 'Ležeći policajac 4' },
    { value: 'lp5',          label: 'Ležeći policajac 5' },
    { value: 'semafor',      label: 'Semafore' },
    { value: 'kamera',       label: 'Kamere' },
    { value: 'sljunak',      label: 'Šljunak' },
    { value: 'stara-cesta',  label: 'Stare ceste' },
]

export const DETOUR_DISTANCES_KM  = [0.08, 0.5, 1.0, 2.0]
export const OBSTACLE_DISTANCE_KM = 0.015
