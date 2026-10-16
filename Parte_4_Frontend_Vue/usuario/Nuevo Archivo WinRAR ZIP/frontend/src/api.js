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

const fetchOriginal = window.fetch.bind(window)

window.fetch = async (recurso, opciones = {}) => {
  const url = typeof recurso === 'string' ? recurso : recurso.url
  if (!url.startsWith(API_URL)) return fetchOriginal(recurso, opciones)

  const headers = new Headers(opciones.headers || {})
  const sesion = obtenerSesion()
  if (sesion?.token) headers.set('Authorization', `Bearer ${sesion.token}`)

  const respuesta = await fetchOriginal(recurso, { ...opciones, headers })

  // Sesión caducada o inválida: volver al login
  if (respuesta.headers.get('X-Sesion') === 'expirada') {
    localStorage.removeItem(CLAVE_SESION)
    if (window.location.pathname !== '/') window.location.href = '/'
  }
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
