<!--
  Gestión de categorías.
  · modo "usuario" (CU-01): ve las categorías generales y crea, edita, desactiva y elimina las suyas.
  · modo "admin"   (CU-08): gestiona el catálogo de categorías generales (crear, editar, cambiar estado).
  Una categoría con movimientos no se puede eliminar: se desactiva (deja de ofrecerse, pero sus movimientos se conservan).
-->
<template>
  <div class="gestion">
    <header class="encabezado">
      <div>
        <h1><Icono nombre="categoria" /> {{ esAdmin ? 'Categorías generales' : 'Mis categorías' }}</h1>
        <p>{{ esAdmin
          ? 'Catálogo de categorías que ven todos los usuarios'
          : 'Clasifica tus ingresos y gastos. Además de las generales, puedes crear las tuyas.' }}</p>
      </div>
      <button class="btn-principal" @click="abrirFormulario()">+ Nueva categoría</button>
    </header>

    <p v-if="mensaje" class="aviso exito"><Icono nombre="ok" /> {{ mensaje }}</p>
    <p v-if="error && !formulario && !confirmacion" class="aviso error">{{ error }}</p>

    <div class="filtros">
      <div class="pestanas">
        <button v-for="(texto, valor) in FILTROS" :key="valor" :class="{ activa: filtro === valor }" @click="filtro = valor">{{ texto }}</button>
      </div>
      <input v-model.trim="busqueda" type="text" placeholder="Buscar categoría...">
    </div>

    <div class="tabla">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Descripción</th>
            <th v-if="!esAdmin">Origen</th>
            <th>Estado</th>
            <th>Movimientos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in visibles" :key="c.id" :class="{ apagada: c.estado !== 'activa' }">
            <td><b><Icono :nombre="iconoCategoria(c.nombre)" /> {{ etiquetaCategoria(c) }}</b></td>
            <td><span class="etiqueta" :class="c.tipo">{{ c.tipo === 'ingreso' ? 'Ingreso' : 'Gasto' }}</span></td>
            <td class="descripcion">{{ c.descripcion || '—' }}</td>
            <td v-if="!esAdmin"><span class="etiqueta" :class="c.propia ? 'propia' : 'general'">{{ c.propia ? 'Propia' : 'General' }}</span></td>
            <td><span class="etiqueta" :class="c.estado">{{ c.estado === 'activa' ? 'Activa' : 'Inactiva' }}</span></td>
            <td>{{ c.movimientos }}</td>
            <td class="acciones">
              <template v-if="editable(c)">
                <button title="Editar" @click="abrirFormulario(c)"><Icono nombre="editar" /></button>
                <button :title="c.estado === 'activa' ? 'Desactivar' : 'Activar'" @click="pedirConfirmacion('estado', c)">
                  <Icono :nombre="c.estado === 'activa' ? 'pausa' : 'activar'" />
                </button>
                <button title="Eliminar" @click="pedirConfirmacion('eliminar', c)"><Icono nombre="papelera" /></button>
              </template>
              <span v-else class="sin-acciones">{{ esSistema(c) ? 'Del sistema' : 'Solo lectura' }}</span>
            </td>
          </tr>
          <tr v-if="!visibles.length">
            <td :colspan="esAdmin ? 6 : 7" class="vacio">{{ cargando ? 'Cargando...' : 'No hay categorías que coincidan.' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Crear / editar -->
    <div v-if="formulario" class="fondo-modal" @click.self="cerrarModales">
      <form class="modal" @submit.prevent="guardar">
        <h2><Icono :nombre="formulario.id ? 'editar' : 'categoria'" /> {{ formulario.id ? 'Editar categoría' : 'Nueva categoría' }}</h2>
        <label>Nombre
          <input v-model="formulario.nombre" type="text" maxlength="50" placeholder="Ej: Mascotas" required>
        </label>
        <label>Tipo
          <select v-model="formulario.tipo">
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
        </label>
        <label>Descripción <small>(opcional)</small>
          <input v-model="formulario.descripcion" type="text" maxlength="120" placeholder="Ej: Comida y veterinario">
        </label>
        <p v-if="error" class="aviso error">{{ error }}</p>
        <div class="botones">
          <button type="button" class="btn-secundario" @click="cerrarModales">Cancelar</button>
          <button type="submit" class="btn-principal">Guardar</button>
        </div>
      </form>
    </div>

    <!-- Confirmar cambio de estado o eliminación -->
    <div v-if="confirmacion" class="fondo-modal" @click.self="cerrarModales">
      <div class="modal">
        <h2><Icono :nombre="textoConfirmacion.icono" /> {{ textoConfirmacion.titulo }}</h2>
        <p>{{ textoConfirmacion.detalle }}</p>
        <p v-if="error" class="aviso error">{{ error }}</p>
        <div class="botones">
          <button class="btn-secundario" @click="cerrarModales">Cancelar</button>
          <button :class="confirmacion.accion === 'eliminar' ? 'btn-peligro' : 'btn-principal'" @click="confirmar">Confirmar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from './api'
import { etiquetaCategoria, iconoCategoria, cargarCategorias } from './categorias'

const props = defineProps({ modo: { type: String, default: 'usuario' } })
const esAdmin = props.modo === 'admin'
const base = esAdmin ? '/admin/categorias' : '/categorias'

const FILTROS = { todas: 'Todas', ingreso: 'Ingresos', gasto: 'Gastos', inactiva: 'Inactivas' }
const SISTEMA = 'Ahorro para metas'

const lista = ref([])
const cargando = ref(true)
const filtro = ref('todas')
const busqueda = ref('')
const mensaje = ref('')
const error = ref('')
const formulario = ref(null)
const confirmacion = ref(null)

// Al cerrar un formulario se borra su error para que no quede en la página
const cerrarModales = () => {
  formulario.value = null
  confirmacion.value = null
  error.value = ''
}

const esSistema = (c) => c.nombre === SISTEMA
const editable = (c) => !esSistema(c) && (esAdmin || Boolean(c.propia))

const visibles = computed(() => lista.value.filter(c => {
  if (filtro.value === 'inactiva' && c.estado !== 'inactiva') return false
  if ((filtro.value === 'ingreso' || filtro.value === 'gasto') && c.tipo !== filtro.value) return false
  const q = busqueda.value.toLowerCase()
  return !q || c.nombre.toLowerCase().includes(q) || (c.descripcion || '').toLowerCase().includes(q)
}))

const avisar = (texto) => {
  mensaje.value = texto
  setTimeout(() => { if (mensaje.value === texto) mensaje.value = '' }, 3500)
}

const cargar = async () => {
  try {
    lista.value = await api(base)
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
  // Los formularios de movimientos y presupuestos usan la lista compartida
  cargarCategorias(true)
}

const abrirFormulario = (c = null) => {
  error.value = ''
  formulario.value = c
    ? { id: c.id, nombre: c.nombre, tipo: c.tipo, descripcion: c.descripcion || '' }
    : { id: null, nombre: '', tipo: 'gasto', descripcion: '' }
}

const guardar = async () => {
  const { id, ...datos } = formulario.value
  error.value = ''
  try {
    const r = await api(id ? `${base}/${id}` : base, { method: id ? 'PUT' : 'POST', body: datos })
    formulario.value = null
    avisar(r.mensaje)
    await cargar()
  } catch (e) {
    error.value = e.message // p. ej. nombre duplicado
  }
}

const pedirConfirmacion = (accion, categoria) => {
  error.value = ''
  confirmacion.value = { accion, categoria }
}

const textoConfirmacion = computed(() => {
  const { accion, categoria } = confirmacion.value
  if (accion === 'eliminar') {
    return {
      titulo: 'Eliminar categoría', icono: 'papelera',
      detalle: `¿Eliminar "${categoria.nombre}"? Esta acción no se puede deshacer.`
    }
  }
  return categoria.estado === 'activa'
    ? { titulo: 'Desactivar categoría', icono: 'pausa', detalle: `"${categoria.nombre}" dejará de aparecer al registrar movimientos. Los movimientos que ya tiene se conservan.` }
    : { titulo: 'Activar categoría', icono: 'activar', detalle: `"${categoria.nombre}" volverá a aparecer al registrar movimientos.` }
})

const confirmar = async () => {
  const { accion, categoria } = confirmacion.value
  error.value = ''
  try {
    const r = accion === 'eliminar'
      ? await api(`${base}/${categoria.id}`, { method: 'DELETE' })
      : await api(`${base}/${categoria.id}/estado`, {
          method: 'PUT',
          body: { estado: categoria.estado === 'activa' ? 'inactiva' : 'activa' }
        })
    confirmacion.value = null
    avisar(r.mensaje)
    await cargar()
  } catch (e) {
    error.value = e.message // p. ej. tiene movimientos: hay que desactivarla
  }
}

onMounted(cargar)
</script>

<style scoped>
.gestion { font-family: 'Poppins', sans-serif; }
.encabezado { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 24px; }
.encabezado h1 { margin: 0; color: #1a202c; font-size: 1.9rem; }
.encabezado p { margin: 6px 0 0; color: #718096; }

.btn-principal, .btn-secundario, .btn-peligro {
  border: none; padding: 10px 22px; border-radius: 12px; cursor: pointer; font-weight: 600; font-family: inherit;
}
.btn-principal { background: #2dbb73; color: white; }
.btn-principal:hover { background: #1a8a4a; }
.btn-secundario { background: #edf2f7; color: #4a5568; }
.btn-peligro { background: #e53e3e; color: white; }

.aviso { padding: 10px 14px; border-radius: 10px; font-size: 0.9rem; margin: 0 0 16px; }
.aviso.exito { background: #f0fff4; color: #1a8a4a; border: 1px solid #9ae6b4; }
.aviso.error { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }

.filtros { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.pestanas { display: flex; gap: 6px; background: white; padding: 5px; border-radius: 12px; flex-wrap: wrap; }
.pestanas button { border: none; background: transparent; padding: 8px 14px; border-radius: 9px; cursor: pointer; color: #4a5568; font-family: inherit; }
.pestanas button.activa { background: #2dbb73; color: white; }
.filtros input { padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 12px; min-width: 220px; font-family: inherit; }

.tabla { background: white; border-radius: 20px; padding: 20px; overflow-x: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #edf2f7; font-size: 0.92rem; }
th { color: #718096; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; }
tr.apagada td { opacity: 0.55; }
tr.apagada td.acciones { opacity: 1; }
.descripcion { color: #718096; max-width: 260px; }
.vacio { text-align: center; color: #a0aec0; padding: 24px; }

.etiqueta { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.etiqueta.ingreso { background: #f0fff4; color: #2f855a; }
.etiqueta.gasto { background: #fff5f5; color: #c53030; }
.etiqueta.activa { background: #e6fffa; color: #1a8a4a; }
.etiqueta.inactiva { background: #edf2f7; color: #718096; }
.etiqueta.propia { background: #ebf8ff; color: #2b6cb0; }
.etiqueta.general { background: #faf5ff; color: #6b46c1; }

.acciones button { background: none; border: none; cursor: pointer; font-size: 1.05rem; margin-right: 6px; }
.sin-acciones { color: #a0aec0; font-size: 0.8rem; }

.fondo-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 16px; }
.modal { background: white; width: 100%; max-width: 440px; padding: 28px; border-radius: 22px; display: flex; flex-direction: column; gap: 14px; }
.modal h2 { margin: 0; color: #1a202c; font-size: 1.3rem; }
.modal p { margin: 0; color: #4a5568; }
.modal label { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: #4a5568; }
.modal input, .modal select { padding: 10px; border: 1px solid #e2e8f0; border-radius: 10px; font-family: inherit; font-size: 0.95rem; }
.botones { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
</style>
