// Categorías de ingresos y gastos, leídas de la base de datos (una sola fuente para todos los formularios).
import { ref, computed } from 'vue'
import { api } from './api'

const EMOJI = {
  'Sueldo': '💼',
  'Freelance': '💰',
  'Otros ingresos': '💵',
  'Alimentación': '🛒',
  'Transporte': '🚗',
  'Entretenimiento': '🎬',
  'Servicios': '💡',
  'Salud': '🏥',
  'Educación': '🎓',
  'Otros gastos': '📦'
}

export const categorias = ref([])

export const categoriasIngreso = computed(() => categorias.value.filter(c => c.tipo === 'ingreso'))
export const categoriasGasto = computed(() => categorias.value.filter(c => c.tipo === 'gasto'))

// "🛒 Alimentación"
export const etiquetaCategoria = (c) => `${EMOJI[c.nombre] || '🏷️'} ${c.nombre}`

// Etiqueta a partir del id (para tablas)
export const nombreCategoria = (id) => {
  const c = categorias.value.find(x => x.id === Number(id))
  return c ? etiquetaCategoria(c) : 'Otras'
}

let pendiente = null
export const cargarCategorias = () => {
  if (!pendiente) {
    pendiente = api('/categorias')
      .then(lista => { categorias.value = lista })
      .catch(e => { pendiente = null; console.error(e) })
  }
  return pendiente
}
