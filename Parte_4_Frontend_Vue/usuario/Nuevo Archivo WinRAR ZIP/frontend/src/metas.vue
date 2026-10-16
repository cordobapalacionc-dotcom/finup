<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="logo">🐷 <span>Finanzas <b>Personales</b></span></div>

      <nav class="menu">
        <router-link to="/inicio">Página Principal</router-link>
        <router-link to="/gastos">Gastos e Ingresos</router-link>
        <router-link to="/metas" class="active">Metas</router-link>
        <router-link to="/reportes">Reportes</router-link>
        <router-link to="/configuracion">Configuración</router-link>
      </nav>

      <div class="user-profile">
        <div style="color: #5778a4;" class="info">
          <b>{{ usuario.nombre }}</b><br>
          {{ usuario.rol }}
        </div>
        <button @click="cerrarSesion" class="btn-logout">Cerrar Sesión</button>
      </div>
    </aside>

    <main class="main">
      <header class="header">
        <div>
          <h1>🎯 Mis <span>Metas</span> de Ahorro</h1>
          <p>Avanza y alcanza tus objetivos financieros</p>
        </div>
        <button class="btn" @click="abrirModalMeta()">+ Nueva Meta</button>
      </header>

      <section class="goals">
        <div v-if="metas.length === 0" class="no-data">No tienes metas creadas.</div>
        
        <div v-for="(meta, index) in metas" :key="'meta-'+index" class="goal-card-container">
          <div class="goal-card">
            <div class="goal-info">
              <h3>✨ {{ meta.nombre }}</h3>
              <p>Meta personal</p>
            </div>
            <div class="goal-progress-container">
              <div class="progress-wrapper">
                <div class="progress-bar-bg">
                  <div class="progress-fill" :class="getClaseColor(calcularPorcentaje(meta))" :style="{ width: calcularPorcentaje(meta) + '%' }"></div>
                </div>
                <span class="percentage-text">{{ calcularPorcentaje(meta) }}%</span>
              </div>
            </div>
            <div class="goal-money"><b>${{ (meta.ahorro || 0).toLocaleString() }}</b> / ${{ meta.monto.toLocaleString() }}</div>
            <div class="status-badge" :class="{ 'completed': calcularPorcentaje(meta) >= 100 }">
              {{ calcularPorcentaje(meta) >= 100 ? '¡Logrado!' : 'En progreso' }}
            </div>
            <div class="actions">
              <button v-if="calcularPorcentaje(meta) < 100" @click="abrirModalAbono(index)" class="btn-abonar" title="Abonar dinero a esta meta">💰 Abonar</button>
              <button @click="abrirModalMeta(index)" class="btn-mini">✏️</button>
              <button @click="eliminarMeta(index)" class="btn-icon-delete">🗑️</button>
            </div>
          </div>
          <div style="padding-left: 20px; color: #5778a4;" class="goal-analysis" v-if="calcularPorcentaje(meta) < 100">
            <p>
              💡 <b>Análisis a 6 meses:</b> Te faltan ${{ (meta.monto - (meta.ahorro || 0)).toLocaleString() }}. 
              Para lograrlo en 6 meses, necesitas ahorrar <b>${{ Math.ceil((meta.monto - (meta.ahorro || 0)) / 6).toLocaleString() }}</b> al mes.
              <br>
              <span :class="(meta.monto - (meta.ahorro || 0)) / 6 > (usuario.ahorroMensual || 120000) ? 'alerta' : 'bien'">
                {{ (meta.monto - (meta.ahorro || 0)) / 6 > (usuario.ahorroMensual || 120000) 
                    ? `⚠️ Te faltan $${(Math.ceil((meta.monto - (meta.ahorro || 0)) / 6) - (usuario.ahorroMensual || 120000)).toLocaleString()} adicionales por mes.` 
                    : '✅ Tu ahorro actual es suficiente para cumplir el plazo.' 
                }}
              </span>
            </p>
          </div>
        </div>
      </section>

      <header class="header">
        <div>
          <h1>📊 Presupuestos <span>Mensuales</span></h1>
          <p>Control de gastos por categoría</p>
        </div>
        <button class="btn btn-alt" @click="abrirModalPresupuesto()">+ Nuevo Presupuesto</button>
      </header>

      <section class="budgets-grid">
        <div v-if="presupuestos.length === 0" class="no-data" style="grid-column: span 2;">No hay presupuestos.</div>
        
        <div v-for="(pre, index) in presupuestos" :key="'pre-'+index" class="card budget-card" :class="{ 'border-rojo': pre.gastado > pre.limite }">
          <div class="budget-header">
            <h3>{{ pre.icono }} {{ pre.categoria }}</h3>
            <div class="actions">
              <button @click="abrirModalPresupuesto(index)" class="btn-mini">✏️</button>
              <button @click="eliminarPresupuesto(index)" class="btn-mini">🗑️</button>
            </div>
          </div>
          <div class="budget-money-info">
            <span class="gastado">${{ (pre.gastado || 0).toLocaleString() }}</span>
            <span class="total"> / ${{ pre.limite.toLocaleString() }}</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-fill" 
                 :class="getClasePresupuesto(pre.gastado, pre.limite)" 
                 :style="{ width: Math.min(((pre.gastado || 0) / pre.limite) * 100, 100) + '%' }">
            </div>
          </div>
          <p>
            {{ pre.gastado > pre.limite ? '❌ Límite superado' : (pre.gastado > pre.limite * 0.8 ? '⚠️ Casi al límite' : '✅ En control') }}
          </p>
        </div>
      </section>

      <section class="summary">
        <div class="card"><p>Total de Metas</p><h3>{{ metas.length }}</h3></div>
        <div class="card"><p>Ahorrado Total</p><h3 class="positive">${{ totalAhorrado.toLocaleString() }}</h3></div>
        <div class="card large">
          <p>Progreso General</p>
          <div class="progress-wrapper">
            <div class="progress-bar-bg"><div class="progress-fill gold" :style="{ width: porcentajeGeneral + '%' }"></div></div>
            <span class="percentage-text">{{ porcentajeGeneral }}%</span>
          </div>
        </div>
      </section>
    </main>

    <div v-if="modal.activo" class="modal-overlay" @click.self="cerrarModal">
      <div class="modal-content">
        <h2>{{ modal.titulo }}</h2>
        
        <div v-if="modal.tipo === 'meta'">
          <div class="input-group"><label>Nombre</label><input v-model="nuevaMeta.nombre" type="text"></div>
          <div class="input-group">
            <label>Monto Objetivo ($)</label>
            <input v-model.number="nuevaMeta.monto" type="number" min="0" @keydown="bloquearNegativos">
          </div>
          <div class="input-group" v-if="modal.editandoIndex !== null">
            <label>Ahorro Actual ($)</label>
            <input v-model.number="nuevaMeta.ahorro" type="number" min="0" @keydown="bloquearNegativos">
          </div>
        </div>

        <div v-if="modal.tipo === 'abono'" class="abono-contenido">
          <p class="abono-meta">✨ {{ metaAbono?.nombre }}</p>
          <p class="abono-detalle">
            Llevas <b>${{ (metaAbono?.ahorro || 0).toLocaleString() }}</b> de ${{ (metaAbono?.monto || 0).toLocaleString() }}.
            Te faltan <b>${{ faltanteAbono.toLocaleString() }}</b>.
          </p>
          <div class="input-group">
            <label>¿Cuánto quieres abonar? ($)</label>
            <input v-model.number="montoAbono" type="number" min="1" @keydown="bloquearNegativos" placeholder="Ej: 50000" @keyup.enter="guardarAbono">
          </div>
          <button type="button" class="btn-completar" @click="montoAbono = faltanteAbono">Completar la meta (${{ faltanteAbono.toLocaleString() }})</button>
        </div>

        <div v-if="modal.tipo === 'presupuesto'">
          <div class="input-group">
            <label>Categoría</label>
            <select v-model="nuevoPresupuesto.categoria_id" class="modal-select">
              <option v-for="c in categoriasGasto" :key="c.id" :value="c.id">{{ etiquetaCategoria(c) }}</option>
            </select>
          </div>
          <div class="input-group">
            <label>Límite Mensual ($)</label>
            <input v-model.number="nuevoPresupuesto.limite" type="number" min="0" @keydown="bloquearNegativos" placeholder="Ej: 500000">
          </div>
          <div class="input-group">
            <label>Gasto Real Actual ($)</label>
            <input v-model.number="nuevoPresupuesto.gastado" type="number" min="0" @keydown="bloquearNegativos">
          </div>
        </div>

        <div class="modal-actions">
          <button @click="cerrarModal" class="btn-cancel">Cancelar</button>
          <button @click="modal.tipo === 'meta' ? guardarMeta() : (modal.tipo === 'abono' ? guardarAbono() : guardarPresupuesto())" class="btn-save">{{ modal.tipo === 'abono' ? 'Abonar' : 'Guardar' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { categoriasGasto, etiquetaCategoria, cargarCategorias } from './categorias';

cargarCategorias();

const router = useRouter();
const API_URL = 'http://localhost:3000/api';

const usuario = ref({ id: null, nombre: '', rol: '', ahorroMensual: 120000 });
const metas = ref([]);
const presupuestos = ref([]);

const modal = ref({ activo: false, tipo: 'meta', titulo: '', editandoIndex: null });
const nuevaMeta = ref({ id: null, nombre: '', monto: 0, ahorro: 0 }); 
const nuevoPresupuesto = ref({ id: null, categoria_id: 3, limite: 0, gastado: 0 }); 

// LÓGICA DE BLOQUEO: Evita que el usuario presione el signo menos o la letra e (notación científica)
const bloquearNegativos = (e) => {
  if (e.key === '-' || e.key === 'e' || e.key === '+') {
    e.preventDefault();
  }
};

const cargarDatos = async () => {
  if (!usuario.value || !usuario.value.id) return;
  try {
    const resMetas = await fetch(`${API_URL}/metas/${usuario.value.id}`);
    const dataMetas = await resMetas.json();
    metas.value = dataMetas.map(m => ({
      id: m.id,
      nombre: m.nombre,
      monto: parseFloat(m.monto_objetivo) || 0,
      ahorro: parseFloat(m.monto_actual) || 0
    }));

    const resPre = await fetch(`${API_URL}/presupuestos/${usuario.value.id}`);
    const dataPre = await resPre.json();
    presupuestos.value = dataPre.map(p => ({
      id: p.id,
      categoria: p.categoria_nombre,
      categoria_id: p.categoria_id,
      limite: parseFloat(p.monto_limite) || 0,
      gastado: parseFloat(p.monto_actual || 0),
      icono: '💰'
    }));
  } catch (e) { 
    console.error("Error al cargar:", e); 
  }
};

const guardarMeta = async () => {
  if (nuevaMeta.value.monto < 0 || nuevaMeta.value.ahorro < 0) {
      return;
  }
  const esEdicion = modal.value.editandoIndex !== null;
  const payload = {
    id: esEdicion ? metas.value[modal.value.editandoIndex].id : null,
    usuario_id: usuario.value.id,
    nombre: nuevaMeta.value.nombre,
    monto_objetivo: Number(nuevaMeta.value.monto),
    monto_actual: Number(nuevaMeta.value.ahorro),
    fecha_limite: new Date().toISOString().split('T')[0] 
  };

  try {
    const res = await fetch(`${API_URL}/metas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await cargarDatos();
      cerrarModal();
    }
  } catch (e) { console.error(e); }
};

const eliminarMeta = async (index) => {
  const idMeta = metas.value[index].id;
  await fetch(`${API_URL}/metas/${idMeta}`, { method: 'DELETE' });
  await cargarDatos();
};

const guardarPresupuesto = async () => {
  if (nuevoPresupuesto.value.limite < 0 || nuevoPresupuesto.value.gastado < 0) {
      return;
  }
  const esEdicion = modal.value.editandoIndex !== null;
  const payload = {
    id: esEdicion ? presupuestos.value[modal.value.editandoIndex].id : null,
    usuario_id: usuario.value.id,
    categoria_id: parseInt(nuevoPresupuesto.value.categoria_id) || 3, 
    monto_actual: parseFloat(nuevoPresupuesto.value.gastado) || 0,
    monto_limite: parseFloat(nuevoPresupuesto.value.limite) || 0,
    periodo: 'mensual'
  };

  try {
    const res = await fetch(`${API_URL}/presupuestos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await cargarDatos();
      cerrarModal();
    }
  } catch (e) { console.error(e); }
};

const eliminarPresupuesto = async (index) => {
  const idPre = presupuestos.value[index].id;
  await fetch(`${API_URL}/presupuestos/${idPre}`, { method: 'DELETE' });
  await cargarDatos();
};

const abrirModalMeta = (index = null) => {
  modal.value = { activo: true, tipo: 'meta', titulo: index !== null ? '✏️ Editar Meta' : '🎯 Nueva Meta', editandoIndex: index };
  if (index !== null) {
    const m = metas.value[index];
    nuevaMeta.value = { id: m.id, nombre: m.nombre, monto: m.monto, ahorro: m.ahorro };
  } else {
    nuevaMeta.value = { id: null, nombre: '', monto: 0, ahorro: 0 };
  }
};

const abrirModalPresupuesto = (index = null) => {
  modal.value = { activo: true, tipo: 'presupuesto', titulo: index !== null ? '✏️ Editar Presupuesto' : '📊 Nuevo Presupuesto', editandoIndex: index };
  if (index !== null) {
    const p = presupuestos.value[index];
    nuevoPresupuesto.value = { id: p.id, limite: p.limite, categoria_id: p.categoria_id, gastado: p.gastado };
  } else {
    nuevoPresupuesto.value = { id: null, limite: 0, categoria_id: 3, gastado: 0 };
  }
};

// --- ABONAR A UNA META ---
const metaAbono = ref(null);
const montoAbono = ref(null);
const faltanteAbono = computed(() => metaAbono.value ? Math.max(metaAbono.value.monto - (metaAbono.value.ahorro || 0), 0) : 0);

const abrirModalAbono = (index) => {
  metaAbono.value = metas.value[index];
  montoAbono.value = null;
  modal.value = { activo: true, tipo: 'abono', titulo: '💰 Abonar a la meta', editandoIndex: null };
};

const guardarAbono = async () => {
  if (!metaAbono.value || !(montoAbono.value > 0)) return;
  try {
    const res = await fetch(`${API_URL}/metas/${metaAbono.value.id}/abonar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto: Number(montoAbono.value) })
    });
    if (res.ok) {
      await cargarDatos();
      cerrarModal();
    }
  } catch (e) { console.error(e); }
};

const cerrarModal = () => { modal.value.activo = false; };

const cerrarSesion = async () => {
  try {
    if (usuario.value.id) {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuario.value.id })
      });
    }
  } finally {
    localStorage.removeItem('usuario_identificado');
    router.push('/');
  }
};

const calcularPorcentaje = (m) => {
    if (!m.monto || m.monto === 0) return 0;
    return Math.min(Math.round(((m.ahorro || 0) / m.monto) * 100), 100);
};

const getClaseColor = (p) => p >= 100 ? 'verde' : (p >= 50 ? 'naranja' : 'rojo');
const getClasePresupuesto = (g, l) => g > l ? 'rojo' : (g > l * 0.8 ? 'naranja' : 'verde');

const totalAhorrado = computed(() => metas.value.reduce((acc, m) => acc + (m.ahorro || 0), 0));
const porcentajeGeneral = computed(() => {
  const tot = metas.value.reduce((acc, m) => acc + (m.monto || 0), 0);
  return tot === 0 ? 0 : Math.round((totalAhorrado.value / tot) * 100);
});

onMounted(() => {
  const sesion = localStorage.getItem('usuario_identificado');
  if (sesion) {
    usuario.value = JSON.parse(sesion);
    cargarDatos();
  } else {
    router.push('/');
  }
});
</script>


<style scoped>
.dashboard { display: flex; min-height: 100vh; background: #f0f4f8; font-family: 'Poppins', sans-serif; }
.sidebar { 
  width: 10%;
  background: #122326; 
  color: white; 
  padding: 25px; 
  display: flex; 
  flex-direction: column; 
  /* Agregamos esto para que sea fijo y ocupe el alto total */
  height: 100vh;
  position: sticky;
  top: 0;
}
.user-profile { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2d3748; }
.btn-logout { width: 100%; padding: 8px; background: #e53e3e; color: white; border: none; border-radius: 8px; cursor: pointer; }
.logo { font-size: 1.2rem; margin-bottom: 40px; }
.logo b { color: #2dbb73; }
.menu a { color: #a0aec0; text-decoration: none; padding: 12px 15px; margin-bottom: 8px; border-radius: 12px; display: block; }
.menu a.active { color: white; background: rgba(45, 187, 115, 0.15); border-left: 4px solid #2dbb73; }
.menu a:hover { color: white; background: rgba(45, 187, 115, 0.15); border-left: 4px solid #2dbb73; }
.main { flex: 1; padding: 40px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.header h1 span { color: #2dbb73; }
.btn { background: #2dbb73; color: white; border: none; padding: 12px 25px; border-radius: 10px; cursor: pointer; font-weight: 600; }
.btn-alt { background: #3182ce; }

/* TARJETAS */
.card { background: white; padding: 25px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
.goal-card-container { background: white; border-radius: 24px; margin-bottom: 20px; overflow: hidden; }
.goal-card { display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr 0.5fr; align-items: center; padding: 20px; gap: 20px; }

/* PRESUPUESTOS */
.budgets-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
.budget-card { transition: 0.3s; border: 2px solid transparent; }
.border-rojo { border-color: #e74c3c22; background: #fffafa; }
.budget-money-info { margin: 10px 0; }
.budget-money-info .gastado { font-size: 1.4rem; font-weight: bold; color: #2d3748; }
.budget-status-text { font-size: 0.8rem; font-weight: bold; margin-top: 5px; }

/* BARRAS Y COLORES */
.progress-bar-bg { flex: 1; height: 8px; background: #edf2f7; border-radius: 10px; overflow: hidden; margin: 10px 0; }
.progress-fill { height: 100%; transition: width 0.6s ease; }
.verde { background: #2ecc71 !important; }
.naranja { background: #f39c12 !important; }
.rojo { background: #e74c3c !important; }
.gold { background: #ff9f1c; }

/* MODALES */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); }
.modal-content { background: white; padding: 30px; border-radius: 24px; width: 400px; }
.input-group { margin-bottom: 15px; }
.input-group label { display: block; font-size: 0.8rem; margin-bottom: 5px; color: #4a5568; }
.input-group input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; }
.modal-actions { display: flex; gap: 10px; margin-top: 25px; }
.btn-save { flex: 2; padding: 12px; background: #2dbb73; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; }
.btn-cancel { flex: 1; padding: 12px; background: #edf2f7; border-radius: 12px; cursor: pointer; }

.actions { display: flex; gap: 10px; }
.btn-mini { background: none; border: none; cursor: pointer; opacity: 0.5; }
.btn-icon-delete { background: none; border: none; cursor: pointer; font-size: 1.2rem; filter: grayscale(1); }
.btn-icon-delete:hover { filter: grayscale(0); }
.status-badge { font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; background: #ebf8ff; color: #3182ce; text-align: center; font-weight: bold; }
.status-badge.completed { background: #f0fff4; color: #38a169; }
.positive { color: #38a169; }
.summary { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 20px; }


.modal-select {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  font-family: 'Poppins', sans-serif;
  outline: none;
}
.modal-select:focus {
  border-color: #2dbb73;
}

</style>

<style scoped>
/* --- Abonar a una meta --- */
.btn-abonar {
  background: #2dbb73;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-abonar:hover { background: #1a8a4a; }
.abono-meta { font-size: 17px; font-weight: 600; margin: 0 0 4px; }
.abono-detalle { font-size: 14px; color: #5778a4; margin: 0 0 16px; }
.btn-completar {
  background: none;
  border: 1px dashed #2dbb73;
  color: #1a8a4a;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
}
.btn-completar:hover { background: rgba(45, 187, 115, 0.08); }
</style>
