// Categorías de ingresos y gastos, leídas de la base de datos (una sola fuente para todos los formularios).
// Incluye las globales (del administrador) y las propias del usuario. Las inactivas se guardan en la lista
// para poder mostrar el nombre de movimientos antiguos, pero no se ofrecen en los formularios.
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
  'Otros gastos': '📦',
  'Ahorro para metas': '🐷'
}

// Se asigna sola al abonar a una meta: no se ofrece en los formularios
const AUTOMATICAS = ['Ahorro para metas']

export const categorias = ref([])

const activa = (c) => (c.estado || 'activa') === 'activa'
export const categoriasIngreso = computed(() => categorias.value.filter(c => c.tipo === 'ingreso' && activa(c)))
export const categoriasGasto = computed(() => categorias.value.filter(c => c.tipo === 'gasto' && activa(c) && !AUTOMATICAS.includes(c.nombre)))

// "🛒 Alimentación"
export const etiquetaCategoria = (c) => `${EMOJI[c.nombre] || '🏷️'} ${c.nombre}`

// Etiqueta a partir del id (para tablas)
export const nombreCategoria = (id) => {
  const c = categorias.value.find(x => x.id === Number(id))
  return c ? etiquetaCategoria(c) : 'Otras'
}

let pendiente = null
// recargar = true vuelve a pedir la lista (después de crear, editar o eliminar una categoría)
export const cargarCategorias = (recargar = false) => {
  if (recargar) pendiente = null
  if (!pendiente) {
    pendiente = api('/categorias')
      .then(lista => { categorias.value = lista })
      .catch(e => { pendiente = null; console.error(e) })
  }
  return pendiente
}
