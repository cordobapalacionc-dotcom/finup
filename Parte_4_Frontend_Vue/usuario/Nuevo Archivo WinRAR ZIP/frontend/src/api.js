// Conexión con el backend.
// Todas las peticiones a API_URL llevan el token de sesión guardado al iniciar sesión.
export const API_URL = 'http://localhost:3000/api'

const CLAVE_SESION = 'usuario_identificado'

export const obtenerSesion = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null')
  } catch {
    return null
  }
}

// Mensajes que se muestran en el login cuando la sesión termina sola
const AVISOS = {
  expirada: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
  inactividad: 'Tu sesión se cerró por inactividad. Inicia sesión de nuevo.',
  desactivada: 'Tu cuenta está desactivada. Comunícate con el administrador.'
}

// Borra la sesión local, guarda el aviso para el login y vuelve a la pantalla de inicio de sesión
export const terminarSesion = (motivo) => {
  localStorage.removeItem(CLAVE_SESION)
  try { sessionStorage.setItem('aviso_sesion', AVISOS[motivo] || AVISOS.expirada) } catch { /* sin almacenamiento */ }
  if (window.location.pathname !== '/') window.location.href = '/'
}

// Lee (y borra) el aviso guardado por terminarSesion()
export const leerAvisoSesion = () => {
  try {
    const aviso = sessionStorage.getItem('aviso_sesion')
    sessionStorage.removeItem('aviso_sesion')
    return aviso || ''
  } catch {
    return ''
  }
}

const fetchOriginal = window.fetch.bind(window)

window.fetch = async (recurso, opciones = {}) => {
  const url = typeof recurso === 'string' ? recurso : recurso.url
  if (!url.startsWith(API_URL)) return fetchOriginal(recurso, opciones)

  const headers = new Headers(opciones.headers || {})
  const sesion = obtenerSesion()
  if (sesion?.token) headers.set('Authorization', `Bearer ${sesion.token}`)

  const respuesta = await fetchOriginal(recurso, { ...opciones, headers })

  // Sesión caducada, cerrada por inactividad o cuenta desactivada: volver al login con el aviso
  const motivo = respuesta.headers.get('X-Sesion')
  if (motivo) terminarSesion(motivo)
  return respuesta
}

// Atajo para las vistas nuevas: devuelve el JSON o lanza un Error con el mensaje del servidor
export const api = async (ruta, { method = 'GET', body } = {}) => {
  const respuesta = await fetch(API_URL + ruta, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) throw new Error(datos.error || `Error ${respuesta.status}`)
  return datos
}

export const moneda = (valor) =>
  '$' + Number(valor || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

// Acepta 'YYYY-MM-DD' o 'YYYY-MM-DD HH:MM:SS' (hora local, como las guarda SQLite)
export const fechaCorta = (texto) => {
  if (!texto) return ''
  const iso = texto.length === 10 ? `${texto}T00:00:00` : texto.replace(' ', 'T')
  return new Date(iso).toLocaleDateString('es-CO')
}
