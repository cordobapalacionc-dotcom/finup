<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="logo">
        🐷 <span>Finanzas <b>Personales</b></span>
      </div>
      
      <nav class="menu">
        <router-link to="/inicio">Página Principal</router-link>
        <router-link to="/gastos" class="active">Gastos e Ingresos</router-link>
        <router-link to="/metas">Metas</router-link>
        <router-link to="/configuracion">Configuración</router-link>
      </nav>
      
      <div class="user-profile">
        <div class="info">
          <b>{{ usuario.nombre }}</b><br>
          {{ usuario.rol }}
        </div>
        <button @click="cerrarSesion" class="btn-logout">Cerrar Sesión</button>
      </div>
    </aside>

    <main class="main">
      <header class="header">
        <div>
          <h1>Gastos e Ingresos</h1>
          <p>Monitorea tus finanzas personales en tiempo real</p>
        </div>
        <button class="btn" @click="abrirModal">+ Nuevo Registro</button>
      </header>

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

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Detalle</th>
              <th>Categoría</th>
              <th>Cantidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in registros" :key="item.id">
              <td>{{ item.tipo === 'ingreso' ? '💼' : '💸' }} {{ item.nombre_ingreso || item.descripcion }}</td>
              <td>{{ nombreCategoria(item.categoria_id) }}</td>
              <td :class="item.tipo === 'ingreso' ? 'positivo' : 'negativo'">
                {{ item.tipo === 'ingreso' ? '+' : '-' }}${{ Number(item.monto).toLocaleString() }}
              </td>
              <td class="opciones-celda">
                <button class="btn-edit" @click="editarRegistro(item)">✏️</button>
                <button class="btn-delete" @click="eliminarRegistro(item.id)">🗑️</button>
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
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="cerrarModal">Cancelar</button>
          <button class="btn-create" @click="guardarRegistro">
            {{ editandoId ? 'Actualizar' : 'Guardar' }}
          </button>
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
import { ref, computed, onMounted, watch } from 'vue';
import { categoriasIngreso, categoriasGasto, etiquetaCategoria, nombreCategoria, cargarCategorias } from './categorias';

cargarCategorias();
import { useRouter } from 'vue-router';

const router = useRouter();
const usuario = ref({ id: 1, nombre: 'Steven', rol: 'Usuario' }); 
const registros = ref([]);
const mostrarModal = ref(false);
const editandoId = ref(null);
const escalaManual = ref(0);
const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];


const nuevoRegistro = ref({
  tipo: 'gasto',
  monto: 0,
  categoria_id: 3,
  descripcion: '', 
  nombre_ingreso: '',
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
  // Validación de seguridad para evitar errores de lógica
  if (nuevoRegistro.value.monto < 0) {
    return;
  }
  if (nuevoRegistro.value.monto === 0) {
    return;
  }

  const payload = { 
    ...nuevoRegistro.value, 
    usuario_id: usuario.value.id, 
    monto: Number(nuevoRegistro.value.monto), 
    fecha: new Date().toISOString().slice(0, 19).replace('T', ' ') 
  };

  try {
    const url = editandoId.value ? `http://localhost:3000/api/movimientos/${editandoId.value}` : 'http://localhost:3000/api/movimientos';
    const res = await fetch(url, { 
      method: editandoId.value ? 'PUT' : 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    if (res.ok) { await cargarDatosDesdeDB(usuario.value.id); cerrarModal(); }
  } catch (e) { console.error(e); }
};

// ELIMINAR
const eliminarRegistro = async (id) => {
  try {
    const res = await fetch(`http://localhost:3000/api/movimientos/${id}`, { method: 'DELETE' });
    if (res.ok) cargarDatosDesdeDB(usuario.value.id);
  } catch (e) { console.error(e); }
};


// LOGICA MODAL
const abrirModal = () => {
  editandoId.value = null;
  nuevoRegistro.value = { tipo: 'gasto', monto: 0, categoria_id: 3, descripcion: '', nombre_ingreso: '', usuario_id: usuario.value.id };
  mostrarModal.value = true;
};

const editarRegistro = (item) => {
  editandoId.value = item.id;
  nuevoRegistro.value = { tipo: item.tipo, monto: item.monto, categoria_id: item.categoria_id, descripcion: item.descripcion || '', nombre_ingreso: item.nombre_ingreso || '', usuario_id: item.usuario_id };
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

const cerrarSesion = () => { localStorage.removeItem('usuario_identificado'); router.push('/'); };
const mostrarTooltip = (e, texto) => { tooltip.value = { ver: true, texto, x: e.clientX + 15, y: e.clientY - 15 }; };
const ocultarTooltip = () => { tooltip.value.ver = false; };
</script>

<style scoped>
.dashboard { display: flex; min-height: 100vh; background: #f0f4f8; font-family: 'Poppins', sans-serif; }
.sidebar { width: 10%; background: #122326; color:#122326; padding: 25px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
.logo { font-size: 1.2rem; margin-bottom: 40px; }
.logo b { color: #2dbb73; }
.menu a { display: block; color: #a0aec0; text-decoration: none; padding: 12px 15px; margin-bottom: 8px; border-radius: 12px; transition: 0.3s; }
.menu a.active, .menu a:hover { color: white; background: rgba(45, 187, 115, 0.15); }
.user-profile { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2d3748; }
.btn-logout { width: 100%; padding: 8px; background: #e53e3e; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px; }

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
.chart-tooltip { position: fixed; background: #2d3748; color: white; padding: 5px 12px; border-radius: 8px; pointer-events: none; font-size: 0.85rem; z-index: 100; }
</style>