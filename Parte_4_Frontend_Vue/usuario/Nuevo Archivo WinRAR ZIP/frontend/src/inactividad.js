// CU-11 · Cerrar sesión, flujo 1a: si pasa demasiado tiempo sin actividad, la sesión se cierra sola.
// El servidor también la rechaza pasados MINUTOS_INACTIVIDAD; esto cierra la pantalla aunque no se haga ninguna petición.
// La última actividad se guarda en localStorage para que todas las pestañas abiertas cuenten como actividad.
import { API_URL, obtenerSesion, terminarSesion } from './api'

const MINUTOS_INACTIVIDAD = 30
const CLAVE = 'ultima_actividad'

const ahora = () => Date.now()
const leer = () => {
  try { return Number(localStorage.getItem(CLAVE)) || ahora() } catch { return ahora() }
}

let ultimaEscritura = 0
const registrarActividad = () => {
  // Como mucho una escritura cada 5 segundos
  if (ahora() - ultimaEscritura < 5000) return
  ultimaEscritura = ahora()
  try { localStorage.setItem(CLAVE, String(ultimaEscritura)) } catch { /* sin almacenamiento */ }
}

for (const evento of ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']) {
  window.addEventListener(evento, registrarActividad, { passive: true })
}
registrarActividad()

setInterval(async () => {
  const sesion = obtenerSesion()
  if (!sesion?.token) return
  if (ahora() - leer() < MINUTOS_INACTIVIDAD * 60 * 1000) return
  // Avisar al servidor para que invalide el token (si ya lo invalidó, no pasa nada)
  try {
    await fetch(`${API_URL}/logout`, { method: 'POST' })
  } catch { /* sin conexión */ }
  terminarSesion('inactividad')
}, 30 * 1000)
