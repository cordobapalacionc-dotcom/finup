<template>
  <div class="dashboard">
    <MenuUsuario />

    <main class="main">
      <header class="header">
        <div>
          <h1>Gastos e Ingresos</h1>
          <p>Monitorea tus finanzas personales en tiempo real</p>
        </div>
        <button class="btn" @click="abrirModal">+ Nuevo Registro</button>
      </header>

      <!-- CU-07 · Notificar presupuesto excedido -->
      <div v-for="(a, i) in alertas" :key="'alerta-' + i" class="alerta-presupuesto">
        <span>
          <Icono nombre="alerta" /> <b>Superaste tu presupuesto {{ a.periodo }} de {{ a.categoria }}:</b>
          llevas ${{ a.acumulado.toLocaleString() }} de ${{ a.limite.toLocaleString() }}
          ({{ a.porcentaje }}%). Te pasaste por <b>${{ a.exceso.toLocaleString() }}</b>.
        </span>
        <button @click="alertas.splice(i, 1)" title="Cerrar">&times;</button>
      </div>
      <p v-if="mensajeExito" class="aviso-exito"><Icono nombre="ok" /> {{ mensajeExito }}</p>

      <section class="saldo">
        <div class="saldo-box">
          <h4>Saldo Actual</h4>
          <h2>${{ totalSaldo.toLocaleString() }}</h2>
        </div>
        <div class="card gasto">
          <p>Total Gastos</p>
          <h3 style="color:#e53e3e;">-${{ totalGastos.toLocaleString() }}</h3>
        </div>
        <div class="card ingreso">
          <p>Total Ingresos</p>
          <h3 style="color:#2dbb73">+${{ totalIngresos.toLocaleString() }}</h3>
        </div>
      </section>

      <div class="chart-container">
        <div class="chart-header">
          <h3>Reporte Semanal</h3>
          <div class="scale-selector">
            <label>Escala Máx:</label>
            <select v-model.number="escalaManual">
              <option :value="0">Auto (Dinámico)</option>
              <option :value="100">100</option>
              <option :value="10000">10,000</option>
              <option :value="1000000">1,000,000</option>
              <option :value="100000000">100,000,000</option>
            </select>
          </div>
        </div>

        <div class="chart-content">
          <div class="bars">
            <div v-for="(dia, index) in diasSemana" :key="index" class="bar-group">
              <div 
                class="bar green" 
                :style="{ height: calcularAltura(reporteSemanal.ingresos[index]) }"
                @mousemove="mostrarTooltip($event, `Ingresos: $${reporteSemanal.ingresos[index].toLocaleString()}`)"
                @mouseleave="ocultarTooltip"
              ></div>
              <div 
                class="bar red" 
                :style="{ height: calcularAltura(reporteSemanal.gastos[index]) }"
                @mousemove="mostrarTooltip($event, `Gastos: $${reporteSemanal.gastos[index].toLocaleString()}`)"
                @mouseleave="ocultarTooltip"
              ></div>
              <span class="day-label">{{ dia }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- CU-12 · Historial de transacciones con filtros -->
      <div class="table-container">
        <div class="historial-header">
          <h3>Historial de movimientos</h3>
          <div class="filtros">
            <label>Desde <input v-model="filtros.desde" type="date" :max="hoy"></label>
            <label>Hasta <input v-model="filtros.hasta" type="date" :max="hoy"></label>
            <label>Tipo
              <select v-model="filtros.tipo">
                <option value="">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="gasto">Gastos</option>
              </select>
            </label>
            <label>Categoría
              <select v-model.number="filtros.categoria_id">
                <option :value="0">Todas</option>
                <option v-for="c in categoriasFiltro" :key="c.id" :value="c.id">{{ etiquetaCategoria(c) }}</option>
              </select>
            </label>
            <button v-if="hayFiltros" class="btn-limpiar" @click="limpiarFiltros">Limpiar</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Detalle</th>
              <th>Categoría</th>
              <th>Cantidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in registrosFiltrados" :key="item.id" class="fila" @click="detalle = item">
              <td class="fecha">{{ fechaCorta(item.fecha) }}</td>
              <td><Icono :nombre="item.tipo === 'ingreso' ? 'ingreso' : 'gasto'" /> {{ item.nombre_ingreso || item.descripcion }}</td>
              <td><Icono :nombre="iconoCategoria(nombreCategoria(item.categoria_id))" /> {{ nombreCategoria(item.categoria_id) }}</td>
              <td :class="item.tipo === 'ingreso' ? 'positivo' : 'negativo'">
                {{ item.tipo === 'ingreso' ? '+' : '-' }}${{ Number(item.monto).toLocaleString() }}
              </td>
              <td class="opciones-celda" @click.stop>
                <button v-if="!item.meta_id" class="btn-edit" title="Editar" @click="editarRegistro(item)"><Icono nombre="editar" /></button>
                <button class="btn-delete" title="Eliminar" @click="pendienteEliminar = item"><Icono nombre="papelera" /></button>
              </td>
            </tr>
            <tr v-if="!registrosFiltrados.length">
              <td colspan="5" class="sin-datos">
                {{ registros.length ? 'Ningún movimiento coincide con los filtros.' : 'Aún no tienes transacciones registradas.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <div v-if="mostrarModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ editandoId ? 'Editar Registro' : 'Nuevo Registro' }}</h2>
          <button class="close-btn" @click="cerrarModal" type="button">&times;</button>
        </div>

        <div class="type-selector">
          <button 
            :class="['type-btn', { 'active-gasto': nuevoRegistro.tipo === 'gasto' }]" 
            @click="nuevoRegistro.tipo = 'gasto'"
          >Gasto</button>
          <button 
            :class="['type-btn', { 'active-ingreso': nuevoRegistro.tipo === 'ingreso' }]" 
            @click="nuevoRegistro.tipo = 'ingreso'"
          >Ingreso</button>
        </div>

        <div class="modal-body">
          <div class="modal-grid">
            <div class="input-group">
              <label>Nombre del Registro</label>
              <input v-model="nuevoRegistro.nombre_ingreso" type="text" placeholder="Ej: Pago Mensual">
            </div>
            
            <div class="input-group">
              <label>Monto</label>
              <input 
                v-model.number="nuevoRegistro.monto" 
                type="number" 
                min="0" 
                @keydown="bloquearNegativos"
              >
            </div>

            <div class="input-group">
              <label>Categoría</label>
              <select v-model.number="nuevoRegistro.categoria_id">
                <option v-for="c in (nuevoRegistro.tipo === 'ingreso' ? categoriasIngreso : categoriasGasto)" :key="c.id" :value="c.id">{{ etiquetaCategoria(c) }}</option>
              </select>
            </div>
            <div class="input-group">
              <label>Descripción</label>
              <input v-model="nuevoRegistro.descripcion" type="text">
            </div>
            <div class="input-group">
              <label>Fecha</label>
              <input v-model="nuevoRegistro.fecha" type="date" :max="hoy">
            </div>
          </div>
          <p v-if="errorRegistro" class="error-registro">{{ errorRegistro }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="cerrarModal">Cancelar</button>
          <button class="btn-create" @click="guardarRegistro">
            {{ editandoId ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Detalle de un movimiento -->
    <div v-if="detalle" class="modal-overlay" @click.self="detalle = null">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Detalle del movimiento</h2>
          <button class="close-btn" @click="detalle = null" type="button">&times;</button>
        </div>
        <dl class="detalle">
          <dt>Tipo</dt><dd><Icono :nombre="detalle.tipo" /> {{ detalle.tipo === 'ingreso' ? 'Ingreso' : 'Gasto' }}</dd>
          <dt>Monto</dt><dd :class="detalle.tipo === 'ingreso' ? 'positivo' : 'negativo'">{{ detalle.tipo === 'ingreso' ? '+' : '-' }}${{ Number(detalle.monto).toLocaleString() }}</dd>
          <dt>Categoría</dt><dd><Icono :nombre="iconoCategoria(nombreCategoria(detalle.categoria_id))" /> {{ nombreCategoria(detalle.categoria_id) }}</dd>
          <dt>Fecha</dt><dd>{{ fechaHora(detalle.fecha) }}</dd>
          <dt>Detalle</dt><dd>{{ detalle.descripcion || '—' }}</dd>
          <template v-if="detalle.meta_id"><dt>Meta</dt><dd>Abono a una meta de ahorro (se edita desde Metas)</dd></template>
        </dl>
        <div class="modal-footer">
          <button class="btn-cancel" @click="pendienteEliminar = detalle; detalle = null">Eliminar</button>
          <button v-if="!detalle.meta_id" class="btn-create" @click="editarRegistro(detalle); detalle = null">Editar</button>
        </div>
      </div>
    </div>

    <!-- Confirmar eliminación -->
    <div v-if="pendienteEliminar" class="modal-overlay" @click.self="pendienteEliminar = null">
      <div class="modal-content">
        <div class="modal-header">
          <h2>¿Eliminar movimiento?</h2>
          <button class="close-btn" @click="pendienteEliminar = null" type="button">&times;</button>
        </div>
        <p>
          Se eliminará <b>{{ pendienteEliminar.descripcion || 'este movimiento' }}</b>
          por <b>${{ Number(pendienteEliminar.monto).toLocaleString() }}</b>.
          Tu saldo y tus presupuestos se recalcularán.
          <template v-if="pendienteEliminar.meta_id"> Como es un abono a una meta, ese dinero también saldrá de la meta.</template>
        </p>
        <div class="modal-footer">
          <button class="btn-cancel" @click="pendienteEliminar = null">Cancelar</button>
          <button class="btn-create btn-rojo" @click="eliminarRegistro(pendienteEliminar.id)">Eliminar</button>
        </div>
      </div>
    </div>

    <div 
      v-show="tooltip.ver" 
      class="chart-tooltip" 
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.texto }}
    </div>
  </div>
</template>

<script setup>
import MenuUsuario from './MenuUsuario.vue';
import { ref, computed, onMounted, watch } from 'vue';
import { categorias, categoriasIngreso, categoriasGasto, etiquetaCategoria, nombreCategoria, iconoCategoria, cargarCategorias } from './categorias';
import { fechaCorta } from './api';

cargarCategorias();
import { useRouter } from 'vue-router';

const router = useRouter();
const usuario = ref({ id: 1, nombre: 'Steven', rol: 'Usuario' }); 
const registros = ref([]);
const mostrarModal = ref(false);
const editandoId = ref(null);
const escalaManual = ref(0);
const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const hoy = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD en hora local

const errorRegistro = ref('');
const mensajeExito = ref('');
const alertas = ref([]);
const detalle = ref(null);
const pendienteEliminar = ref(null);

// --- FILTROS DEL HISTORIAL ---
const filtros = ref({ desde: '', hasta: '', tipo: '', categoria_id: 0 });
const hayFiltros = computed(() => Boolean(filtros.value.desde || filtros.value.hasta || filtros.value.tipo || filtros.value.categoria_id));
const limpiarFiltros = () => { filtros.value = { desde: '', hasta: '', tipo: '', categoria_id: 0 }; };
// Categorías que aparecen en los movimientos (incluye inactivas) del tipo elegido
const categoriasFiltro = computed(() => {
  const usadas = new Set(registros.value.map(r => r.categoria_id));
  return categorias.value.filter(c => usadas.has(c.id) && (!filtros.value.tipo || c.tipo === filtros.value.tipo));
});
const registrosFiltrados = computed(() => registros.value.filter(r => {
  const dia = String(r.fecha || '').slice(0, 10);
  const f = filtros.value;
  return (!f.desde || dia >= f.desde)
    && (!f.hasta || dia <= f.hasta)
    && (!f.tipo || r.tipo === f.tipo)
    && (!f.categoria_id || r.categoria_id === f.categoria_id);
}));

const fechaHora = (texto) => {
  if (!texto) return '';
  const d = new Date(String(texto).replace(' ', 'T'));
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const avisar = (texto) => {
  mensajeExito.value = texto;
  setTimeout(() => { if (mensajeExito.value === texto) mensajeExito.value = ''; }, 3500);
};


const nuevoRegistro = ref({
  tipo: 'gasto',
  monto: 0,
  categoria_id: 3,
  descripcion: '', 
  nombre_ingreso: '',
  fecha: hoy,
  usuario_id: null
});

watch(() => nuevoRegistro.value.tipo, (tipo) => {
  const lista = tipo === 'ingreso' ? categoriasIngreso.value : categoriasGasto.value;
  if (lista.length && !lista.some(c => c.id === Number(nuevoRegistro.value.categoria_id))) {
    nuevoRegistro.value.categoria_id = lista[0].id;
  }
});

const tooltip = ref({ ver: false, texto: '', x: 0, y: 0 });

// --- NUEVA LÓGICA DE BLOQUEO ---
const bloquearNegativos = (e) => {
  // Evita que se escriban signos de polaridad o notación científica
  if (e.key === '-' || e.key === 'e' || e.key === '+') {
    e.preventDefault();
  }
};

// FETCH DATOS
const cargarDatosDesdeDB = async (idUsuario) => {
  if (!idUsuario) return;
  try {
    const res = await fetch(`http://localhost:3000/api/movimientos/${idUsuario}`);
    const data = await res.json();
    registros.value = Array.isArray(data) ? data : [];
  } catch (e) { console.error("Error API:", e); }
};

// GUARDAR CON VALIDACIÓN DE NEGATIVOS
const guardarRegistro = async () => {
  errorRegistro.value = '';
  // 3a: datos o monto inválidos
  if (!(Number(nuevoRegistro.value.monto) > 0)) {
    errorRegistro.value = 'El monto debe ser mayor que 0';
    return;
  }
  if (!nuevoRegistro.value.categoria_id) {
    errorRegistro.value = 'Elige una categoría';
    return;
  }
  if (nuevoRegistro.value.fecha && nuevoRegistro.value.fecha > hoy) {
    errorRegistro.value = 'La fecha no puede ser futura';
    return;
  }

  const payload = { 
    ...nuevoRegistro.value, 
    usuario_id: usuario.value.id, 
    monto: Number(nuevoRegistro.value.monto)
  };

  try {
    const url = editandoId.value ? `http://localhost:3000/api/movimientos/${editandoId.value}` : 'http://localhost:3000/api/movimientos';
    const res = await fetch(url, { 
      method: editandoId.value ? 'PUT' : 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errorRegistro.value = data.error || 'No se pudo guardar el movimiento';
      return;
    }
    await cargarDatosDesdeDB(usuario.value.id);
    cerrarModal();
    avisar(editandoId.value ? 'Movimiento actualizado' : 'Movimiento registrado con éxito');
    // 5a: el gasto superó el presupuesto de la categoría
    alertas.value = data.alertas || [];
  } catch (e) {
    console.error(e);
    errorRegistro.value = 'No se pudo conectar con el servidor';
  }
};

// ELIMINAR (después de confirmar)
const eliminarRegistro = async (id) => {
  try {
    const res = await fetch(`http://localhost:3000/api/movimientos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      pendienteEliminar.value = null;
      await cargarDatosDesdeDB(usuario.value.id);
      avisar('Movimiento eliminado');
    }
  } catch (e) { console.error(e); }
};


// LOGICA MODAL
const abrirModal = () => {
  editandoId.value = null;
  errorRegistro.value = '';
  nuevoRegistro.value = { tipo: 'gasto', monto: 0, categoria_id: categoriasGasto.value[0]?.id || 3, descripcion: '', nombre_ingreso: '', fecha: hoy, usuario_id: usuario.value.id };
  mostrarModal.value = true;
};

const editarRegistro = (item) => {
  editandoId.value = item.id;
  errorRegistro.value = '';
  nuevoRegistro.value = { tipo: item.tipo, monto: item.monto, categoria_id: item.categoria_id, descripcion: item.descripcion || '', nombre_ingreso: item.nombre_ingreso || '', fecha: String(item.fecha || '').slice(0, 10) || hoy, usuario_id: item.usuario_id };
  mostrarModal.value = true;
};

const cerrarModal = () => { mostrarModal.value = false; };

// CÁLCULOS
const totalIngresos = computed(() => registros.value.filter(r => r.tipo === 'ingreso').reduce((acc, r) => acc + Number(r.monto), 0));
const totalGastos = computed(() => registros.value.filter(r => r.tipo === 'gasto').reduce((acc, r) => acc + Number(r.monto), 0));
const totalSaldo = computed(() => totalIngresos.value - totalGastos.value);

const reporteSemanal = computed(() => {
  const data = { ingresos: [0,0,0,0,0,0,0], gastos: [0,0,0,0,0,0,0] };
  registros.value.forEach(reg => {
    const fechaReg = reg.fecha ? new Date(reg.fecha) : new Date();
    let index = fechaReg.getDay() === 0 ? 6 : fechaReg.getDay() - 1;
    if (reg.tipo === 'ingreso') data.ingresos[index] += Number(reg.monto);
    else data.gastos[index] += Number(reg.monto);
  });
  return data;
});

const calcularAltura = (valor) => {
  if (!valor || valor <= 0) return '4px';
  const maximo = escalaManual.value > 0 ? escalaManual.value : Math.max(...reporteSemanal.value.ingresos, ...reporteSemanal.value.gastos, 100);
  return `${Math.min((valor / maximo) * 100, 100)}%`;
};

onMounted(() => {
  const sesion = localStorage.getItem('usuario_identificado');
  if (sesion) usuario.value = JSON.parse(sesion);
  cargarDatosDesdeDB(usuario.value.id);
});
const mostrarTooltip = (e, texto) => { tooltip.value = { ver: true, texto, x: e.clientX + 15, y: e.clientY - 15 }; };
const ocultarTooltip = () => { tooltip.value.ver = false; };
</script>

<style scoped>
.dashboard { display: flex; min-height: 100vh; background: #f0f4f8; font-family: 'Poppins', sans-serif; }

.main { flex: 1; padding: 30px 50px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.btn { background: #2dbb73; color: white; border: none; padding: 10px 25px; border-radius: 12px; cursor: pointer; font-weight: 600; }

.saldo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
.saldo-box, .card { background: white; padding: 25px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }

.chart-container { background: white; padding: 25px; border-radius: 20px; margin-bottom: 30px; }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.scale-selector select { padding: 5px 10px; border-radius: 8px; border: 1px solid #e2e8f0; color: #4a5568; }

.chart-content { height: 180px; display: flex; align-items: flex-end; padding-bottom: 40px; }
.bars { display: flex; justify-content: space-around; width: 100%; height: 100%; border-bottom: 2px solid #f0f4f8; }
.bar-group { display: flex; gap: 4px; align-items: flex-end; position: relative; width: 40px; }
.bar { width: 12px; border-radius: 4px 4px 0 0; transition: height 0.3s ease; }
.bar.green { background: #2dbb73; }
.bar.red { background: #e53e3e; }
.day-label { position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); font-size: 0.75rem; color: #718096; }

.table-container { background: white; padding: 25px; border-radius: 20px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #edf2f7; }
.positivo { color: #38a169; font-weight: 600; }
.negativo { color: #e53e3e; font-weight: 600; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; width: 90%; max-width: 500px; padding: 30px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.close-btn { background: none; border: none; font-size: 1.8rem; color: #a0aec0; cursor: pointer; transition: 0.2s; }
.close-btn:hover { color: #e53e3e; transform: scale(1.1); }

.type-selector { display: flex; gap: 10px; margin-bottom: 20px; background: #f7fafc; padding: 5px; border-radius: 12px; }
.type-btn { flex: 1; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: 600; background: transparent; }
.active-gasto { background: #fff5f5; color: #e53e3e; border: 1px solid #feb2b2; }
.active-ingreso { background: #f0fff4; color: #2dbb73; border: 1px solid #9bebb7; }

.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.input-group label { display: block; font-size: 0.8rem; color: #4a5568; margin-bottom: 5px; }
.input-group input, .input-group select { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 10px; outline: none; }

.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
.btn-cancel { background: #edf2f7; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; }
.btn-create { background: #2dbb73; color: white; border: none; padding: 10px 30px; border-radius: 10px; cursor: pointer; font-weight: 600; }

.opciones-celda button { background: none; border: none; cursor: pointer; margin-right: 8px; font-size: 1.1rem; }
.alerta-presupuesto { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #fff5f5; border: 1px solid #feb2b2; color: #c53030; padding: 14px 18px; border-radius: 14px; margin-bottom: 16px; }
.alerta-presupuesto button { background: none; border: none; color: #c53030; font-size: 1.4rem; cursor: pointer; }
.aviso-exito { background: #f0fff4; border: 1px solid #9ae6b4; color: #1a8a4a; padding: 10px 16px; border-radius: 12px; margin: 0 0 16px; }
.error-registro { color: #e53e3e; font-size: 0.85rem; margin: 14px 0 0; }

.historial-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.historial-header h3 { margin: 0; }
.filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
.filtros label { display: flex; flex-direction: column; font-size: 0.75rem; color: #718096; gap: 4px; }
.filtros input, .filtros select { padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 8px; color: #4a5568; font-family: inherit; }
.btn-limpiar { background: #edf2f7; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; color: #4a5568; }
.fila { cursor: pointer; }
.fila:hover td { background: #f7fafc; }
.fecha { color: #718096; white-space: nowrap; }
.sin-datos { text-align: center; color: #a0aec0; padding: 24px; }

.detalle { display: grid; grid-template-columns: 110px 1fr; gap: 10px 16px; margin: 0; }
.detalle dt { color: #718096; font-size: 0.85rem; }
.detalle dd { margin: 0; color: #2d3748; }
.btn-rojo { background: #e53e3e; }

.chart-tooltip { position: fixed; background: #2d3748; color: white; padding: 5px 12px; border-radius: 8px; pointer-events: none; font-size: 0.85rem; z-index: 100; }
</style>