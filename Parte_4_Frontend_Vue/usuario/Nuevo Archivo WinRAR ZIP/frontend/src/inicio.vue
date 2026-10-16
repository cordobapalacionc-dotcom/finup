<script setup>
import MenuUsuario from './MenuUsuario.vue';
import { ref, onMounted, computed } from "vue";
import { useRouter } from 'vue-router'
import { categoriasGasto, etiquetaCategoria, cargarCategorias } from "./categorias";

cargarCategorias();

const router = useRouter()
const API_URL = 'http://localhost:3000/api'

// --- VARIABLES REACTIVAS ---
const usuario = ref({ id: null, nombre: 'Usuario', rol: 'Estudiante' })
const resumen = ref({ ingresos: 0, gastos: 0 }) 
const goals = ref([]) 
const payments = ref([]) 


// Estado para el Modal de Pago (Aportes)
const mostrarModalPago = ref(false);
const pagoSeleccionado = ref(null);
const montoAPagar = ref(0);

// Estado para el Modal de Nuevo Recurrente
const mostrarModalRecurrente = ref(false)
const nuevoRecurrente = ref({
  categoria_id: 6,
  monto: 0,
  pago: 0,
  frecuencia: 'mensual',
  fecha_inicio: new Date().toISOString().substr(0, 10),
  descripcion: '',
  pagado: false
})

// --- NUEVO: BLOQUEO DE NEGATIVOS ---
const bloquearNegativos = (e) => {
  if (e.key === '-' || e.key === 'e' || e.key === '+') {
    e.preventDefault();
  }
};

// --- LÓGICA DE APORTES (PAGOS PARCIALES) ---

const saldoPendiente = computed(() => {
  if (!pagoSeleccionado.value) return 0;
  return pagoSeleccionado.value.monto - pagoSeleccionado.value.pago;
});

const abrirModalPago = (p) => {
  if (p.pagado) return; 
  pagoSeleccionado.value = p;
  montoAPagar.value = 0; 
  mostrarModalPago.value = true;
};

const confirmarPago = async () => {
  // Validación de seguridad contra 0 o negativos
  if (montoAPagar.value <= 0) return;
  
  if (montoAPagar.value > saldoPendiente.value) {
    return;
  }

  try {
    const res = await fetch(`${API_URL}/recurrentes/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: usuario.value.id,
        categoria_id: pagoSeleccionado.value.categoria_id,
        monto: Number(montoAPagar.value),
        descripcion: `Aporte: ${pagoSeleccionado.value.descripcion || 'Servicio'}`,
        recurrente_id: pagoSeleccionado.value.id
      })
    });

    if (res.ok) {
      mostrarModalPago.value = false;
      montoAPagar.value = 0;
      await obtenerRecurrentes(usuario.value.id);
      await obtenerResumen(usuario.value.id);
    }
  } catch (error) {
    console.error("Error al procesar el aporte:", error);
  }
};

// --- FETCH DE DATOS (Sin cambios) ---

const obtenerResumen = async (userId) => {
  try {
    const res = await fetch(`${API_URL}/resumen/${userId}`)
    if (res.ok) resumen.value = await res.json()
  } catch (error) {
    console.error("Error al traer el resumen:", error)
  }
}

const obtenerMetas = async (userId) => {
  try {
    const res = await fetch(`${API_URL}/metas/${userId}`)
    if (res.ok) goals.value = await res.json()
  } catch (error) {
    console.error("Error al obtener metas:", error)
  }
}

const obtenerRecurrentes = async (userId) => {
  try {
    const res = await fetch(`${API_URL}/recurrentes/${userId}`)
    if (res.ok) {
      const data = await res.json()
      payments.value = data
    }
  } catch (error) { 
    console.error("Error al obtener recurrentes:", error) 
  }
}

const guardarRecurrente = async () => {
  // Validación de seguridad para el monto principal
  if (nuevoRecurrente.value.monto <= 0) {
    return;
  }

  try {
    const method = nuevoRecurrente.value.id ? 'PUT' : 'POST';
    const url = nuevoRecurrente.value.id 
      ? `${API_URL}/recurrentes/${nuevoRecurrente.value.id}` 
      : `${API_URL}/recurrentes`;

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...nuevoRecurrente.value, 
        usuario_id: usuario.value.id,
        monto: Number(nuevoRecurrente.value.monto) 
      })
    })

    if (res.ok) {
      await obtenerRecurrentes(usuario.value.id)
      mostrarModalRecurrente.value = false
      nuevoRecurrente.value = { 
        categoria_id: 6, monto: 0, pago: 0, frecuencia: 'mensual', 
        fecha_inicio: new Date().toISOString().substr(0, 10), descripcion: '', pagado: false 
      }
    }
  } catch (error) { 
    console.error("Error al guardar:", error) 
  }
}

// --- LÓGICA VISUAL Y ELIMINACIÓN (Sin cambios) ---

const saldoTotal = computed(() => resumen.value.ingresos - resumen.value.gastos)

const getEstadoPago = (p) => {
  // Convertimos a número para asegurar comparaciones precisas
  const montoTotal = Number(p.monto);
  const pagoAcumulado = Number(p.pago);

  // 1. COMPLETADO (Verde): Solo si el pago alcanzó o superó el monto
  if (p.pagado === 1 || pagoAcumulado >= montoTotal) {
    return { color: '#2dbb73', texto: 'COMPLETADO' }
  }
  
  // 2. EN ABONO (Amarillo): Si hay pagos pero aún no llega al total
  if (pagoAcumulado > 0 && pagoAcumulado < montoTotal) {
    return { color: '#ecc94b', texto: 'EN ABONO' }
  }

  // 3. PENDIENTE O VENCIDO (Basado en fecha cuando no hay ningún abono)
  const hoy = new Date()
  const fechaVence = new Date(p.fecha_inicio)
  
  if (hoy > fechaVence) {
    return { color: '#e53e3e', texto: 'VENCIDO' }
  }
  
  const difDias = Math.ceil((fechaVence - hoy) / (1000 * 60 * 60 * 24))
  if (difDias <= 3 && difDias >= 0) {
    return { color: '#ecc94b', texto: 'POR VENCER' }
  }
  
  return { color: '#718096', texto: 'PENDIENTE' }
}

const eliminarRecurrente = async (id) => {
  
  try {
    const res = await fetch(`${API_URL}/recurrentes/${id}`, { 
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      await obtenerRecurrentes(usuario.value.id);
      await obtenerResumen(usuario.value.id);
    }
  } catch (error) {
    console.error("Error al eliminar:", error);
  }
};

const editarRecurrente = (p) => {
  nuevoRecurrente.value = { ...p };
  mostrarModalRecurrente.value = true;
};

// --- CICLO DE VIDA (Actualizado para el tema) ---
onMounted(async () => {

  const sesion = localStorage.getItem('usuario_identificado')
  if (sesion) {
    const data = JSON.parse(sesion)
    usuario.value.id = data.id
    usuario.value.nombre = data.nombre
    usuario.value.rol = data.rol || 'Estudiante'
    
    await Promise.all([
      obtenerResumen(data.id),
      obtenerMetas(data.id),
      obtenerRecurrentes(data.id)
    ])
  } else {
    router.push('/')
  }
})
</script>

<template>
  <div class="dashboard-container">
    <MenuUsuario />

    <main class="main-content">
      <section class="welcome-banner">
        <div class="welcome-text">
          <h2>¡Bienvenido de nuevo, {{ usuario.nombre }}!</h2>
          <p>Esto es un resumen de tus finanzas personales.</p>
        </div>
        <div class="welcome-illustration">👨‍💻💰</div>
      </section>

      <section class="stat-cards">
        <div class="card">
          <p>Saldo Actual</p>
          <h3 :class="saldoTotal >= 0 ? 'positive' : 'negative'">
            ${{ saldoTotal.toLocaleString() }}
          </h3>
          <span class="sub-text" :class="saldoTotal >= 0 ? 'positive' : 'negative'">
            {{ saldoTotal >= 0 ? 'Total en cuenta' : 'Balance negativo' }}
          </span>
        </div>

        <div class="card">
          <p>Gastos Totales</p>
          <h3 class="negative">-${{ resumen.gastos.toLocaleString() }}</h3>
          <span class="sub-text negative">Acumulado</span>
        </div>

        <div class="card">
          <p>Ingresos Totales</p>
          <h3 class="positive">+${{ resumen.ingresos.toLocaleString() }}</h3>
          <span class="sub-text positive">Acumulado</span>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="goals-section">
          <div class="section-header">
            <h4>Mis Metas de Ahorro</h4>
          </div>
          
          <div v-if="goals.length > 0" class="goals-list">
            <div v-for="goal in goals" :key="goal.id" class="goal-item">
              <div class="goal-info">
                <span>{{ goal.nombre }}</span>
                <span>${{ Number(goal.monto_actual).toLocaleString() }} / ${{ Number(goal.monto_objetivo).toLocaleString() }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" 
                     :style="{ 
                       width: (goal.monto_actual / goal.monto_objetivo * 100) + '%', 
                       background: '#2dbb73' 
                     }">
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-goals">
            <div class="empty-icon">📁</div>
            <p>No hay metas a completar</p>
          </div>
        </section>

        <div class="right-column">
          <section class="payments-section">
            <div class="section-header">
              <h4>Pagos Recurrentes</h4>
              <button @click="mostrarModalRecurrente = true" class="btn-add-mini" title="Programar nuevo pago">+</button>
            </div>

            <div v-if="payments.length > 0" class="payments-list">
              <div v-for="p in payments" :key="p.id" 
                   class="payment-card" 
                   :style="{ 
                     borderLeft: '5px solid ' + getEstadoPago(p).color 
                   }">
                
                <div @click="Number(p.pago) < Number(p.monto) ? abrirModalPago(p) : null" 
                     style="flex: 1; cursor: pointer;">
                  <b class="pay-title">{{ p.descripcion || p.nombre_categoria }}</b>
                  <span class="pay-date">Vence: {{ new Date(p.fecha_inicio).toLocaleDateString() }}</span>
                  
                  <div class="progress-container-mini">
                    <div class="progress-fill-mini" 
                         :style="{ 
                           width: Math.min((p.pago / p.monto) * 100, 100) + '%', 
                           backgroundColor: getEstadoPago(p).color 
                         }">
                    </div>
                  </div>
                </div>

                <div class="pay-amount-zone">
                  <div class="amount-text" :style="{ color: getEstadoPago(p).color }">
                    ${{ Number(p.pago).toLocaleString() }} / ${{ Number(p.monto).toLocaleString() }}
                  </div>
                  
                  <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                    <div class="pay-status-tag" :style="{ backgroundColor: getEstadoPago(p).color }">
                      {{ getEstadoPago(p).texto }}
                    </div>
                    
                    <button @click.stop="eliminarRecurrente(p.id)" class="btn-delete-small" title="Eliminar">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="no-goals" style="padding: 20px;">
              <p style="font-size: 0.8rem;">No hay transacciones programadas</p>
            </div>
          </section>
        </div>
      </div>
    </main>

    <div v-if="mostrarModalRecurrente" class="modal-overlay">
      <div class="modal-content">
        <h3>{{ nuevoRecurrente.id ? '📝 Editar' : '➕ Programar' }} Gasto</h3>
        <div class="form-group">
          <label>Descripción</label>
          <input v-model="nuevoRecurrente.descripcion" type="text" placeholder="Ej: Pago de Internet">
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select v-model="nuevoRecurrente.categoria_id">
            <option v-for="c in categoriasGasto" :key="c.id" :value="c.id">{{ etiquetaCategoria(c) }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Monto del Recibo (Total)</label>
          <input 
            v-model.number="nuevoRecurrente.monto" 
            type="number" 
            min="0" 
            @keydown="bloquearNegativos" 
            placeholder="0.00"
          >
        </div>
        <div class="form-group">
          <label>Próxima Fecha de Pago</label>
          <input v-model="nuevoRecurrente.fecha_inicio" type="date">
        </div>
        <div class="modal-actions">
          <button @click="mostrarModalRecurrente = false" class="btn-cancel">Cancelar</button>
          <button @click="guardarRecurrente" class="btn-save">
            {{ nuevoRecurrente.id ? 'Actualizar' : 'Programar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="mostrarModalPago" class="modal-overlay">
      <div class="modal-content">
        <h3>💰 Registrar Aporte</h3>
        <p>Vas a abonar al servicio: <b>{{ pagoSeleccionado?.descripcion || 'este servicio' }}</b></p>
        
        <div class="info-pago-fijo">
          <div class="dato-fijo">
            <span>Monto Total del Recibo:</span>
            <b>${{ Number(pagoSeleccionado?.monto).toLocaleString() }}</b>
          </div>
          <div class="dato-fijo highlight-red">
            <span>Faltante por pagar:</span>
            <b>${{ (pagoSeleccionado?.monto - pagoSeleccionado?.pago).toLocaleString() }}</b>
          </div>
        </div>

        <div class="form-group">
          <label>¿Cuánto vas a aportar ahora?</label>
          <input 
            v-model.number="montoAPagar" 
            type="number" 
            min="0" 
            @keydown="bloquearNegativos" 
            placeholder="Ej: 20000"
          >
          <small>Este abono se descontará de tu saldo actual.</small>
        </div>

        <div class="modal-actions">
          <button @click="mostrarModalPago = false" class="btn-cancel">Cancelar</button>
          <button 
            @click="confirmarPago" 
            class="btn-save"
            :disabled="montoAPagar <= 0 || montoAPagar > (pagoSeleccionado?.monto - pagoSeleccionado?.pago)"
          >
            Confirmar Aporte
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

/* Estilos base */
.dashboard-container { 
  display: flex; 
  min-height: 100vh; 
  width: 100%;
  font-family: 'Poppins', sans-serif; 
}

.main-content { flex: 1; padding: 30px 50px;background-color: #f0f4f8; }

.welcome-banner { 
  background: white; 
  padding: 30px; 
  border-radius: 20px; 
  margin-bottom: 25px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
  height: 10%;
  width: 93%;
}

.welcome-text h2 { margin: 0; color: #1a202c; }
.welcome-illustration { font-size: 3rem; }

/* Tarjetas de Estadísticas */
.stat-cards { 
  display: grid; 
  grid-template-columns: repeat(3, 1fr); 
  gap: 20px; 
}

.card { 
  background: white; 
  padding: 20px; 
  border-radius: 20px; 
  box-shadow: 0 4px 6px rgba(0,0,0,0.02); 
  transition: transform 0.2s;
}
.card:hover { transform: translateY(-3px); }
.card p { color: #718096; margin: 0; font-size: 0.95rem; }
.card h3 { font-size: 1.8rem; margin: 10px 0; }

.sub-text { font-size: 0.8rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }

.dashboard-grid { 
  display: grid; 
  grid-template-columns: 1.5fr 1fr; 
  gap: 25px; 
  margin-top: 25px; 
}

.goals-section, .payments-section { 
  background: white; 
  padding: 25px; 
  border-radius: 20px; 
  margin-bottom: 20px; 
}

.section-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 20px; 
}

/* --- ESTILOS DE PAGOS (ABONOS) --- */
.payment-card { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 15px; 
  background: #fff; 
  margin-bottom: 12px; 
  border-radius: 12px; 
  box-shadow: 0 2px 8px rgba(0,0,0,0.04); 
  transition: 0.3s;
}
.payment-card:hover:not([style*="default"]) { transform: translateX(5px); background: #f9fafb; }

.pay-title { font-size: 0.95rem; color: #2d3748; display: block; margin-bottom: 2px; }
.pay-date { font-size: 0.75rem; color: #718096; display: block; }
.pay-amount { text-align: right; }

.mini-progress-container {
  background: #edf2f7;
  overflow: hidden;
}

.pay-status-tag { 
  font-size: 0.65rem; 
  font-weight: 800; 
  color: white; 
  padding: 3px 8px; 
  border-radius: 6px; 
  margin-top: 5px; 
  display: inline-block;
  text-transform: uppercase;
}

/* Botón Añadir (+) */
.btn-add-mini {
  background: #2dbb73;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}
.btn-add-mini:hover { background: #24a162; transform: rotate(90deg); }

/* --- ESTILOS DEL MODAL Y FORMULARIOS --- */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(18, 35, 38, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.form-group { margin-bottom: 15px; }
.form-group label { display: block; font-size: 0.85rem; color: #4a5568; margin-bottom: 6px; font-weight: 600; }
.form-group input, .form-group select { 
  width: 100%; 
  padding: 12px; 
  border: 1px solid #e2e8f0; 
  border-radius: 10px; 
  font-size: 0.9rem;
  outline: none;
}
.form-group input:focus { border-color: #2dbb73; box-shadow: 0 0 0 3px rgba(45, 187, 115, 0.1); }

/* Deshabilitado */
.btn-save:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
}

.modal-actions { display: flex; gap: 12px; margin-top: 25px; }
.btn-save { flex: 2; background: #2dbb73; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-save:hover:not(:disabled) { background: #24a162; }
.btn-cancel { flex: 1; background: #edf2f7; color: #4a5568; border: none; padding: 12px; border-radius: 10px; cursor: pointer; transition: 0.2s; }
.btn-cancel:hover { background: #e2e8f0; }

/* Otros estilos */
.goal-item { margin-bottom: 15px; }
.goal-info { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 5px; }
.progress-bar { background: #edf2f7; height: 10px; border-radius: 5px; overflow: hidden; }
.progress-fill { height: 100%; transition: width 0.5s ease; }

.no-goals {
  text-align: center;
  padding: 40px 20px;
  color: #a0aec0;
  border: 2px dashed #edf2f7;
  border-radius: 15px;
  margin-top: 10px;
}

.negative { color: #e53e3e !important; }
.positive { color: #38a169 !important; }
</style>