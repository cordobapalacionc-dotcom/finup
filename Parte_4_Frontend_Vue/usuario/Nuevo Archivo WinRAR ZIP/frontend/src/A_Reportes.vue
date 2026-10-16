<template>
  <div class="dashboard">
    <!-- SIDEBAR -->
    <aside class="sidebar">
      <h1 id="tituloM">Finanzas <span>Personales</span></h1>
      <ul>
        <li v-for="item in menuItems" :key="item.text" :class="{ active: $route.name === item.routeName }">
      <!-- Usamos :to con el nombre de la ruta -->
      <router-link 
        :to="{ name: item.routeName }" 
        class="menu-item"
      >
        <span class="icon">{{ item.icon }}</span>
        <span class="text">{{ item.text }}</span>
      </router-link>
    </li>
      </ul>
      <div class="perfil">
        <div class="icono">👤</div>
        <p>{{ sesion?.nombre || 'Administrador' }}</p>
        <span>Admin</span>
      </div>
    </aside>

    <!-- CONTENIDO PRINCIPAL -->
    <main class="contenido">
      <div class="reportes-container">
        
        <!-- HEADER -->
        <header class="reportes-header">
          <div>
            <h1>Visualiza y analiza los datos financieros</h1>
            <p>de los usuarios con reportes detallados</p>
          </div>
          <div class="fecha-selector">
            <span>📅</span>
            <select v-model="periodoSeleccionado" @change="cargarDatos">
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
            </select>
          </div>
        </header>

        <!-- CARDS ESTADÍSTICAS -->
        <section class="stats-cards">
          <div v-for="card in stats" :key="card.titulo" class="stat-card" :class="card.clase">
            <h3>{{ card.icono }} {{ card.titulo }}</h3>
            <div class="valor">{{ card.valor }}</div>
            <div v-if="card.trend" :class="['trend', card.trendClase]">
              {{ card.trend }}
            </div>
            <div v-if="card.subtitulo" class="subtitulo">{{ card.subtitulo }}</div>
          </div>
        </section>

        <!-- GRÁFICO DE BARRAS (INGRESOS VS GASTOS) -->
        <section class="chart-section">
          <div class="chart-header">
            <h3>📊 Ingresos vs Gastos</h3>
            <div class="chart-legend">
              <div class="legend-item"><span class="legend-color ingresos"></span> Ingresos</div>
              <div class="legend-item"><span class="legend-color gastos"></span> Gastos</div>
              <div class="legend-item"><span class="legend-color balance"></span> Balance</div>
            </div>
          </div>
          
          <div class="chart-container">
            <div class="chart-bars">
              <div v-for="(grupo, index) in serie" :key="index" class="bar-item">
                <div class="bar-wrapper">
                  <!-- Cálculo dinámico de altura -->
                  <div class="bar-ingreso" :style="{ height: getBarHeight(grupo.ingresos) + 'px' }"></div>
                  <div class="bar-gasto" :style="{ height: getBarHeight(grupo.gastos) + 'px' }"></div>
                </div>
                <div class="bar-label">{{ grupo.label }}</div>
                <div class="bar-value">{{ moneda(grupo.ingresos - grupo.gastos) }}</div>
              </div>
            </div>
            <div class="chart-annotation">
              <span>{{ balancePeriodo >= 0 ? '+' : '-' }}{{ moneda(Math.abs(balancePeriodo)) }}</span> Balance neto del período
            </div>
          </div>
        </section>

        <!-- DISTRIBUCIÓN POR CATEGORÍAS (DONA) -->
        <section class="dona-section">
          <div class="dona-header">
            <h3>Pie Distribución de Gastos por Categoría</h3>
            <div class="dona-legend">
              <div v-for="cat in categorias" :key="cat.nombre" class="dona-legend-item">
                <span class="dona-color" :style="{ background: cat.color }"></span> {{ cat.nombre }}
              </div>
            </div>
          </div>

          <div class="dona-container">
            <div class="dona-grafico">
              <svg viewBox="0 0 100 100" class="dona-svg">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="15"/>
                <!-- En un caso real, aquí calcularíamos los stroke-dasharray dinámicamente -->
                <circle v-for="(cat, i) in categorias" :key="i"
                  cx="50" cy="50" r="40" fill="none" 
                  :stroke="cat.color" stroke-width="15"
                  :stroke-dasharray="cat.dashArray" 
                  :stroke-dashoffset="cat.dashOffset"
                  transform="rotate(-90 50 50)"/>
              </svg>
              <div class="dona-centro">
                <div class="dona-total">{{ moneda(totalGastos) }}</div>
                <div class="dona-label">Total Gastos</div>
              </div>
            </div>

            <div class="dona-lista">
              <div v-for="cat in categorias" :key="cat.nombre" class="dona-item">
                <div class="dona-item-info">
                  <div class="dona-item-color" :style="{ background: cat.color }"></div>
                  <span class="dona-item-nombre">{{ cat.nombre }}</span>
                </div>
                <div>
                  <span class="dona-item-valor">{{ moneda(cat.monto) }}</span>
                  <span class="dona-item-porcentaje">({{ cat.porcentaje }}%)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- GRID INFERIOR -->
        <div class="reportes-grid">
          <!-- REPORTES RECIENTES -->
          <section class="recientes-section">
            <div class="recientes-header">
              <h3>📄 Reportes Recientes</h3>
              <button v-if="reportesRecientes.length > 1" class="btn-borrar-todos" @click="borrarTodos">Borrar todos</button>
            </div>
            <div class="recientes-list">
              <div
                v-for="rep in reportesRecientes"
                :key="rep.id"
                class="reporte-item"
                :class="{ abierto: reporteAbierto === rep.id }"
              >
                <div class="reporte-cabecera" @click="alternarReporte(rep.id)">
                  <div class="reporte-icono">📊</div>
                  <div class="reporte-info">
                    <h4>{{ rep.tipo }}</h4>
                    <p>{{ fechaHora(rep.fecha_generado) }} · {{ rep.usuario }}</p>
                  </div>
                  <span class="reporte-flecha">{{ reporteAbierto === rep.id ? '▲' : '▼' }}</span>
                  <button class="btn-borrar-reporte" title="Eliminar reporte" @click.stop="eliminarReporte(rep.id)">🗑️</button>
                </div>

                <div v-if="reporteAbierto === rep.id" class="reporte-detalle">
                  <template v-if="rep.datos">
                    <div class="detalle-totales">
                      <div><span>Ingresos</span><b class="verde">{{ moneda(rep.datos.ingresos) }}</b></div>
                      <div><span>Gastos</span><b class="rojo">{{ moneda(rep.datos.gastos) }}</b></div>
                      <div><span>Balance</span><b :class="rep.datos.ingresos - rep.datos.gastos >= 0 ? 'verde' : 'rojo'">{{ moneda(rep.datos.ingresos - rep.datos.gastos) }}</b></div>
                      <div><span>Metas</span><b>{{ rep.datos.metas_cumplidas }}/{{ rep.datos.metas }}</b></div>
                    </div>
                    <div v-for="c in rep.datos.categorias" :key="c.nombre" class="detalle-categoria">
                      <span>{{ c.nombre }}</span>
                      <div class="detalle-barra"><div :style="{ width: c.porcentaje + '%' }"></div></div>
                      <b>{{ moneda(c.monto) }}</b>
                    </div>
                    <p v-if="!rep.datos.categorias.length" class="detalle-vacio">No hubo gastos en ese periodo.</p>
                  </template>
                  <p v-else class="detalle-vacio">Este reporte se creó antes de que se guardaran los detalles.</p>
                </div>
              </div>

              <div v-if="reportesRecientes.length === 0" class="sin-reportes">
                <div>📄</div>
                Aún no hay reportes. Pulsa <b>Generar reporte</b> para guardar los totales del periodo elegido.
              </div>
            </div>
          </section>

          <!-- LISTADO DE CATEGORÍAS CON PROGRESO -->
          <section class="categorias-section">
            <h3>📂 Categorías de Gastos</h3>
            <div class="categorias-list">
              <div v-for="cat in categorias" :key="cat.nombre" class="categoria-group">
                <div class="categoria-item">
                  <div class="categoria-info">
                    <div class="categoria-icono" :style="{ background: cat.color + '22', color: cat.color }">{{ cat.emoji }}</div>
                    <div class="categoria-texto">
                      <h4>{{ cat.nombre }}</h4>
                      <p>{{ cat.desc }}</p>
                    </div>
                  </div>
                  <div class="categoria-monto">
                    <div class="monto">{{ moneda(cat.monto) }}</div>
                    <div class="porcentaje">{{ cat.porcentaje }}%</div>
                  </div>
                </div>
                <div class="categoria-progreso">
                  <div class="progreso-bg">
                    <div class="progreso-fill" :style="{ width: cat.porcentaje + '%', background: cat.color }"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="btn-ver-totales">
              <button @click="generarReporte">📄 Generar reporte</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api, moneda, fechaCorta, obtenerSesion } from './api';

const sesion = obtenerSesion();

// --- ESTADO ---
const periodoSeleccionado = ref("30");

const menuItems = ref([
  { text: 'Inicio', icon: '🏠', routeName: 'admin-inicio', active: true },
  { text: 'Usuarios', icon: '👥', routeName: 'admin-usuarios', active: false },
  { text: 'Finanzas', icon: '💰', routeName: 'admin-finanzas', active: false }, // O el nombre que uses para finanzas
  { text: 'Reportes', icon: '📊', routeName: 'admin-reportes', active: false },
  { text: 'Metas', icon: '🎯', routeName: 'admin-metas', active: false },
  { text: 'Configuración', icon: '⚙️', routeName: 'configuracion', active: false },
]);
const resumen = ref(null);
const serie = ref([]);
const gastosCategoria = ref([]);
const reportesRecientes = ref([]);

const stats = computed(() => {
  const r = resumen.value;
  if (!r) return [];
  const balance = r.ingresos - r.gastos;
  const pctMetas = r.metas ? Math.round((r.metas_cumplidas / r.metas) * 100) : 0;
  return [
    { titulo: 'Ingresos Totales', valor: moneda(r.ingresos), subtitulo: `${r.transacciones} movimiento(s)`, icono: '💰' },
    { titulo: 'Gastos Totales', valor: moneda(r.gastos), icono: '💸' },
    { titulo: 'Balance', valor: (balance >= 0 ? '+' : '-') + moneda(Math.abs(balance)), icono: '⚖️' },
    { titulo: 'Metas Alcanzadas', valor: `${r.metas_cumplidas}/${r.metas}`, subtitulo: `${pctMetas}% completado`, clase: 'metas-card', icono: '🎯' },
  ];
});

// Apariencia de cada categoría; las que no estén aquí usan la paleta de respaldo
const ESTILO_CATEGORIA = {
  'Alimentación': { emoji: '🍽️', color: '#2dbb73', desc: 'Comida y supermercado' },
  'Transporte': { emoji: '🚗', color: '#f59e0b', desc: 'Gasolina y pasajes' },
  'Entretenimiento': { emoji: '🎬', color: '#8b5cf6', desc: 'Cine, salidas y streaming' },
  'Servicios': { emoji: '💡', color: '#3b82f6', desc: 'Luz, agua, internet' },
  'Salud': { emoji: '🏥', color: '#ef4444', desc: 'Médico y farmacia' },
  'Educación': { emoji: '🎓', color: '#14b8a6', desc: 'Cursos, libros y estudios' },
  'Otros gastos': { emoji: '📦', color: '#6b7280', desc: 'Gastos varios' },
};
const PALETA = ['#ef4444', '#14b8a6', '#ec4899', '#6b7280'];
const CIRCUNFERENCIA = 2 * Math.PI * 40;

const totalGastos = computed(() => gastosCategoria.value.reduce((acc, c) => acc + c.monto, 0));

const categorias = computed(() => {
  let acumulado = 0;
  return gastosCategoria.value.map((c, i) => {
    const estilo = ESTILO_CATEGORIA[c.nombre] || { emoji: '📦', color: PALETA[i % PALETA.length], desc: 'Otros gastos' };
    const fraccion = totalGastos.value ? c.monto / totalGastos.value : 0;
    const segmento = fraccion * CIRCUNFERENCIA;
    const cat = {
      ...estilo,
      nombre: c.nombre,
      monto: c.monto,
      porcentaje: Math.round(fraccion * 100),
      dashArray: `${segmento} ${CIRCUNFERENCIA}`,
      dashOffset: -acumulado
    };
    acumulado += segmento;
    return cat;
  });
});

// Agrupación de la gráfica según el periodo elegido
const AGRUPACION = { '7': 'dias=7', '30': 'dias=30&agrupar=semana', '90': 'meses=3', '365': 'meses=12' };

// --- LÓGICA ---
const maxValor = computed(() => Math.max(1, ...serie.value.flatMap(g => [g.ingresos, g.gastos])));
const getBarHeight = (valor) => (valor / maxValor.value) * 250;
const balancePeriodo = computed(() => serie.value.reduce((acc, g) => acc + g.ingresos - g.gastos, 0));

const cargarDatos = async () => {
  const dias = periodoSeleccionado.value;
  try {
    const [r, s, g, rep] = await Promise.all([
      api(`/admin/resumen?dias=${dias}`),
      api(`/admin/serie?${AGRUPACION[dias]}`),
      api(`/admin/gastos-categoria?dias=${dias}`),
      api('/admin/reportes')
    ]);
    resumen.value = r;
    serie.value = s;
    gastosCategoria.value = g;
    reportesRecientes.value = rep;
  } catch (e) {
    console.error(e);
  }
};
onMounted(cargarDatos);

// --- REPORTES GUARDADOS ---
const reporteAbierto = ref(null);
const NOMBRE_PERIODO = { '7': 'últimos 7 días', '30': 'últimos 30 días', '90': 'últimos 90 días', '365': 'último año' };

const fechaHora = (texto) => {
  if (!texto) return '';
  const d = new Date(texto.replace(' ', 'T'));
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const recargarReportes = async () => {
  reportesRecientes.value = await api('/admin/reportes');
};

// Guarda una foto de los totales actuales del periodo elegido
const generarReporte = async () => {
  const r = resumen.value;
  if (!r) return;
  const datos = {
    periodo: periodoSeleccionado.value,
    ingresos: r.ingresos,
    gastos: r.gastos,
    metas: r.metas,
    metas_cumplidas: r.metas_cumplidas,
    categorias: categorias.value.filter(c => c.monto > 0).map(c => ({ nombre: c.nombre, monto: c.monto, porcentaje: c.porcentaje }))
  };
  try {
    const { id } = await api('/admin/reportes', {
      method: 'POST',
      body: { tipo: `Resumen de los ${NOMBRE_PERIODO[periodoSeleccionado.value]}`, datos }
    });
    await recargarReportes();
    reporteAbierto.value = id;
  } catch (e) {
    console.error(e);
  }
};

const alternarReporte = (id) => {
  reporteAbierto.value = reporteAbierto.value === id ? null : id;
};

const eliminarReporte = async (id) => {
  try {
    await api(`/admin/reportes/${id}`, { method: 'DELETE' });
    await recargarReportes();
  } catch (e) {
    console.error(e);
  }
};

const borrarTodos = async () => {
  try {
    await api('/admin/reportes', { method: 'DELETE' });
    reporteAbierto.value = null;
    await recargarReportes();
  } catch (e) {
    console.error(e);
  }
};
</script>

<style scoped>

:root {
    --bg-main: #f0f4f8;
    --sidebar-dark: #0a1a1f;
    --sidebar-light: #122326;
    --primary-green: #2dbb73;
    --primary-dark: #1a8a4a;
    --card-white: #ffffff;
    --danger-red: #e53e3e;
    --danger-dark: #c53030;
    --warning-yellow: #f59e0b;
    --info-blue: #3b82f6;
    --purple: #8b5cf6;
    --gray-text: #6b7280;
    --gray-light: #e5e7eb;
    --gray-bg: #f9fafb;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background: var(--bg-main);
    font-family: 'Poppins', sans-serif;
}

/* ============================================
   LAYOUT PRINCIPAL
   ============================================ */
.dashboard {
    display: flex;
    min-height: 100vh;
}

/* ============================================
   SIDEBAR
   ============================================ */
.sidebar {
    background: #000000;
    border-right: 1px solid rgba(255, 255, 255, 0.14);
    width: 280px;
    color: white;
    padding: 30px 20px;
    display: flex;
    flex-direction: column;
    position: fixed;
    height: 100vh;
    overflow-y: auto;
    box-shadow: 4px 0 20px rgba(0,0,0,0.1);
}

.sidebar h1, .sidebar h2 {
    font-size: 22px;
    margin-bottom: 40px;
    text-align: center;
    letter-spacing: 1px;
}

.sidebar h1 span, .sidebar h2 span {
    color: var(--primary-green);
}

.sidebar ul {
    list-style: none;
    flex: 1;
}

.sidebar ul li {
    margin-bottom: 12px;
}

.sidebar ul li a {
    display: flex;
    align-items: center;
    gap: 14px;
    text-decoration: none;
    color: #a0aec0;
    padding: 12px 18px;
    border-radius: 12px;
    transition: all 0.3s ease;
    font-size: 15px;
    font-weight: 500;
}

.sidebar ul li a:hover {
    color: white;
    background: rgba(45, 187, 115, 0.15);
    transform: translateX(5px);
}

.sidebar ul li.active a {
    color: white;
    background: linear-gradient(90deg, rgba(45, 187, 115, 0.25), transparent);
    border-left: 4px solid var(--primary-green);
}

/* Perfil en Sidebar */
.perfil {
    margin-top: auto;
    padding-top: 25px;
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.1);
}

.icono {
    width: 55px;
    height: 55px;
    background: var(--primary-green);
    border-radius: 50%;
    margin: 0 auto 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    font-weight: bold;
}

.perfil p {
    font-size: 15px;
    font-weight: 600;
}

.perfil span {
    font-size: 12px;
    opacity: 0.7;
}

/* ============================================
   CONTENIDO PRINCIPAL
   ============================================ */
.contenido {
    flex: 1;
    margin-left: 280px;
    padding: 30px 35px;
}

h1 {
    font-size: 32px;
    margin-bottom: 8px;
    color: #1a202c;
    font-weight: 600;
}

.subtitulo {
    color: var(--gray-text);
    margin-bottom: 30px;
    font-size: 14px;
    border-left: 3px solid var(--primary-green);
    padding-left: 15px;
}

/* ============================================
   CARDS
   ============================================ */
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 25px;
    margin-bottom: 35px;
}

.card {
    background: var(--card-white);
    padding: 22px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
    border: 1px solid rgba(0,0,0,0.03);
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.card h3 {
    font-size: 14px;
    color: var(--gray-text);
    margin-bottom: 12px;
    font-weight: 500;
    letter-spacing: 0.5px;
}

.card p {
    font-size: 32px;
    font-weight: 700;
    color: #1a202c;
}

.card .positivo {
    color: var(--primary-green);
}

.card .negativo {
    color: var(--danger-red);
}

.trend {
    font-size: 11px;
    display: inline-block;
    margin-top: 10px;
    font-weight: 500;
}

.trend.positivo {
    color: var(--primary-green);
}

.trend.negativo {
    color: var(--danger-red);
}

/* ============================================
   TABLAS
   ============================================ */
.tabla {
    background: var(--card-white);
    padding: 20px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    overflow-x: auto;
    margin-top: 25px;
}

.tabla h3 {
    margin-bottom: 20px;
    font-size: 18px;
    color: #1a202c;
    font-weight: 600;
}

table {
    width: 100%;
    border-collapse: collapse;
    min-width: 600px;
}

th {
    text-align: left;
    padding: 14px 12px;
    background: var(--gray-bg);
    color: var(--gray-text);
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

td {
    padding: 14px 12px;
    border-bottom: 1px solid var(--gray-light);
    font-size: 14px;
    color: #374151;
}

tr:hover {
    background: var(--gray-bg);
}

/* Estados */
.activo {
    color: var(--primary-green);
    font-weight: 600;
    background: rgba(45, 187, 115, 0.1);
    padding: 4px 10px;
    border-radius: 20px;
    display: inline-block;
    font-size: 12px;
}

.inactivo {
    color: var(--danger-red);
    font-weight: 600;
    background: rgba(229, 62, 62, 0.1);
    padding: 4px 10px;
    border-radius: 20px;
    display: inline-block;
    font-size: 12px;
}

/* Badges */
.badge-excelente {
    background: var(--primary-green);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.badge-bueno {
    background: var(--info-blue);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.badge-regular {
    background: var(--warning-yellow);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.badge-atencion {
    background: var(--danger-red);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

/* ============================================
   BOTONES
   ============================================ */
button {
    border: none;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    transition: all 0.3s ease;
}

.btn-agregar {
    background: var(--primary-green);
    color: white;
    padding: 10px 24px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.btn-agregar:hover {
    background: var(--primary-dark);
    transform: scale(1.02);
}

.btn-editar {
    background: var(--info-blue);
    color: white;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    margin-right: 8px;
}

.btn-editar:hover {
    background: #2563eb;
}

.btn-eliminar {
    background: var(--danger-red);
    color: white;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
}

.btn-eliminar:hover {
    background: var(--danger-dark);
}

.btn-guardar {
    background: var(--primary-green);
    color: white;
    padding: 12px;
    border-radius: 10px;
    font-weight: 600;
    width: 100%;
}

.btn-guardar:hover {
    background: var(--primary-dark);
}

/* ============================================
   FORMULARIOS
   ============================================ */
form input, form select {
    width: 100%;
    padding: 12px 15px;
    border: 1px solid var(--gray-light);
    border-radius: 10px;
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    margin-bottom: 15px;
    transition: all 0.3s ease;
}

form input:focus, form select:focus {
    outline: none;
    border-color: var(--primary-green);
    box-shadow: 0 0 0 3px rgba(45, 187, 115, 0.1);
}

form label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
}

/* ============================================
   BUSCADOR
   ============================================ */
.buscador {
    margin-bottom: 25px;
}

.buscador input {
    width: 100%;
    max-width: 350px;
    padding: 12px 20px;
    border: 1px solid var(--gray-light);
    border-radius: 12px;
    font-size: 14px;
    background: white;
}

.buscador input:focus {
    outline: none;
    border-color: var(--primary-green);
}

/* ============================================
   HEADER CON BOTÓN
   ============================================ */
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    flex-wrap: wrap;
    gap: 15px;
}

.header h1 {
    margin-bottom: 0;
}

/* ============================================
   GRÁFICAS
   ============================================ */
.chart-container {
    background: var(--card-white);
    padding: 25px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    margin-bottom: 30px;
}

.chart-container h3 {
    margin-bottom: 20px;
    font-size: 18px;
}

.chart-content {
    height: 250px;
}

.bars {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    height: 100%;
}

.bar-group {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    height: 100%;
    position: relative;
    width: 60px;
    justify-content: center;
}

.bar {
    width: 20px;
    border-radius: 8px 8px 0 0;
    transition: height 0.5s ease;
    min-height: 3px;
}

.bar.green {
    background: linear-gradient(180deg, var(--primary-green), var(--primary-dark));
}

.bar.red {
    background: linear-gradient(180deg, var(--danger-red), var(--danger-dark));
}

.day-label {
    position: absolute;
    bottom: -30px;
    font-size: 11px;
    color: var(--gray-text);
}

/* Tooltip */
#chart-tooltip {
    position: fixed;
    background: #1f2937;
    color: white;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    pointer-events: none;
    display: none;
    z-index: 1000;
    white-space: nowrap;
}

/* ============================================
   GRÁFICAS DE REPORTES
   ============================================ */
.graficas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
    gap: 25px;
    margin-bottom: 30px;
}

.grafica, .grafica-full {
    background: var(--card-white);
    padding: 20px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.grafica h3, .grafica-full h3 {
    margin-bottom: 20px;
    font-size: 16px;
}

.chart-barras {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    gap: 15px;
    padding: 20px 0;
}

.barra-mes {
    text-align: center;
    flex: 1;
}

.barra-container {
    display: flex;
    justify-content: center;
    gap: 8px;
    align-items: flex-end;
    height: 280px;
    margin-bottom: 10px;
}

.barra-ingreso {
    width: 35px;
    background: linear-gradient(180deg, var(--primary-green), var(--primary-dark));
    border-radius: 5px 5px 0 0;
    min-height: 20px;
}

.barra-gasto {
    width: 35px;
    background: linear-gradient(180deg, var(--danger-red), var(--danger-dark));
    border-radius: 5px 5px 0 0;
    min-height: 20px;
}

.barra-valor {
    font-size: 10px;
    color: var(--gray-text);
}

.leyenda {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--gray-light);
}

.leyenda span {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.color-ingreso, .color-gasto {
    width: 12px;
    height: 12px;
    border-radius: 3px;
}

.color-ingreso { background: var(--primary-green); }
.color-gasto { background: var(--danger-red); }

/* Donut */
.donut-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 20px 0;
}

.donut {
    width: 180px;
    height: 180px;
    transform: rotate(-90deg);
}

.donut-center {
    position: absolute;
    text-align: center;
}

.donut-total {
    font-size: 22px;
    font-weight: bold;
}

.donut-label {
    font-size: 10px;
    color: var(--gray-text);
}

.categorias {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--gray-light);
}

.categoria {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 13px;
}

.cat-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: inline-block;
    margin-right: 8px;
}

/* Línea de tiempo */
.line-chart {
    padding: 20px 0;
}

.line-bars {
    display: flex;
    justify-content: space-around;
    gap: 15px;
}

.line-bar {
    text-align: center;
    flex: 1;
}

.line-fill {
    background: linear-gradient(180deg, var(--info-blue), #2563eb);
    border-radius: 5px 5px 0 0;
    width: 100%;
    max-width: 50px;
    margin: 0 auto;
}

/* ============================================
   RESPONSIVE
   ============================================ */
@media (max-width: 1024px) {
    .sidebar { width: 240px; }
    .contenido { margin-left: 240px; padding: 25px; }
    .cards { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
}

@media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); position: fixed; z-index: 1000; transition: 0.3s; }
    .contenido { margin-left: 0; padding: 20px; }
    .graficas { grid-template-columns: 1fr; }
    .header { flex-direction: column; align-items: flex-start; }
    .card p { font-size: 24px; }
}

/* ============================================
   REPORTES.CSS - Estilos para Reportes de Administrador
   Incluye sección de Presupuesto Mensual
   ============================================ */

/* ============================================
   SECCIÓN DE PRESUPUESTO ADMINISTRADOR
   ============================================ */
   
   .presupuesto-section {
    background: white;
    border-radius: 20px;
    padding: 25px;
    margin-bottom: 30px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.presupuesto-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    flex-wrap: wrap;
    gap: 15px;
}

.presupuesto-header h2 {
    font-size: 20px;
    color: #1a202c;
    display: flex;
    align-items: center;
    gap: 10px;
}

.presupuesto-header h2::before {
    content: "📋";
    font-size: 24px;
}

/* Selector de mes */
.mes-selector {
    display: flex;
    align-items: center;
    gap: 15px;
    background: #f9fafb;
    padding: 8px 15px;
    border-radius: 12px;
}

.mes-selector label {
    font-weight: 500;
    color: #374151;
}

.mes-selector select {
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-family: 'Poppins', sans-serif;
    background: white;
    cursor: pointer;
}

.mes-selector select:focus {
    outline: none;
    border-color: #2dbb73;
}

/* Tabla de presupuesto */
.presupuesto-tabla {
    overflow-x: auto;
}

.presupuesto-tabla table {
    width: 100%;
    border-collapse: collapse;
}

.presupuesto-tabla th {
    background: #f9fafb;
    padding: 15px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 13px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.presupuesto-tabla td {
    padding: 15px 12px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
}

.presupuesto-tabla tr:hover {
    background: #f9fafb;
}

/* Categorías */
.categoria-nombre {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 500;
}

.categoria-icono {
    width: 35px;
    height: 35px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
}

.icono-comida { background: rgba(45, 187, 115, 0.15); }
.icono-servicios { background: rgba(59, 130, 246, 0.15); }
.icono-transporte { background: rgba(245, 158, 11, 0.15); }
.icono-entretenimiento { background: rgba(139, 92, 246, 0.15); }
.icono-salud { background: rgba(239, 68, 68, 0.15); }
.icono-educacion { background: rgba(6, 182, 212, 0.15); }
.icono-ahorro { background: rgba(16, 185, 129, 0.15); }
.icono-otros { background: rgba(107, 114, 128, 0.15); }

/* Inputs de presupuesto */
.presupuesto-input {
    width: 140px;
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    transition: all 0.3s ease;
}

.presupuesto-input:focus {
    outline: none;
    border-color: #2dbb73;
    box-shadow: 0 0 0 3px rgba(45, 187, 115, 0.1);
}

/* Gasto actual */
.gasto-actual {
    font-weight: 500;
}

.gasto-actual.por-debajo {
    color: #2dbb73;
}

.gasto-actual.por-encima {
    color: #e53e3e;
}

/* Barra de progreso */
.progreso-bar-container {
    width: 100%;
    min-width: 120px;
    background: #e5e7eb;
    border-radius: 10px;
    height: 8px;
    overflow: hidden;
}

.progreso-bar {
    height: 100%;
    border-radius: 10px;
    transition: width 0.5s ease;
}

.progreso-bar.bajo {
    background: #2dbb73;
}

.progreso-bar.medio {
    background: #f59e0b;
}

.progreso-bar.alto {
    background: #e53e3e;
}

.porcentaje-texto {
    font-size: 12px;
    font-weight: 500;
    margin-left: 10px;
    white-space: nowrap;
}

.porcentaje-texto.bajo {
    color: #2dbb73;
}

.porcentaje-texto.medio {
    color: #f59e0b;
}

.porcentaje-texto.alto {
    color: #e53e3e;
}

/* Botones */
.btn-guardar-presupuesto {
    background: #2dbb73;
    color: white;
    padding: 10px 24px;
    border: none;
    border-radius: 10px;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.btn-guardar-presupuesto:hover {
    background: #1a8a4a;
    transform: translateY(-2px);
}

.btn-editar-presupuesto {
    background: #3b82f6;
    color: white;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-right: 8px;
}

.btn-editar-presupuesto:hover {
    background: #2563eb;
}

.btn-aplicar-todos {
    background: #8b5cf6;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 10px;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.btn-aplicar-todos:hover {
    background: #7c3aed;
}

/* Resumen de presupuesto */
.resumen-presupuesto {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 25px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
}

.resumen-item {
    text-align: center;
    padding: 15px;
    background: #f9fafb;
    border-radius: 15px;
}

.resumen-item h4 {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 8px;
}

.resumen-item .valor {
    font-size: 24px;
    font-weight: 700;
}

.resumen-item .valor.total-presupuesto {
    color: #3b82f6;
}

.resumen-item .valor.total-gastado {
    color: #e53e3e;
}

.resumen-item .valor.restante {
    color: #2dbb73;
}

/* Alertas de presupuesto */
.alertas-container {
    margin-top: 20px;
}

.alerta-presupuesto {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 12px 15px;
    border-radius: 10px;
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
}

.alerta-presupuesto.alerta-roja {
    background: #fee2e2;
    border-left-color: #e53e3e;
}

.alerta-presupuesto .alerta-icono {
    font-size: 18px;
}

/* ============================================
   GRÁFICAS DE REPORTES
   ============================================ */

.graficas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
    gap: 25px;
    margin-bottom: 30px;
}

.grafica, .grafica-full {
    background: white;
    padding: 20px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.grafica h3, .grafica-full h3 {
    margin-bottom: 20px;
    font-size: 16px;
    color: #1a202c;
}

/* Gráfico de barras comparativo */
.chart-barras {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    gap: 15px;
    padding: 20px 0;
    flex-wrap: wrap;
}

.barra-mes {
    text-align: center;
    flex: 1;
    min-width: 80px;
}

.barra-container {
    display: flex;
    justify-content: center;
    gap: 8px;
    align-items: flex-end;
    height: 280px;
    margin-bottom: 10px;
}

.barra-presupuesto {
    width: 35px;
    background: linear-gradient(180deg, #3b82f6, #2563eb);
    border-radius: 5px 5px 0 0;
    min-height: 20px;
    transition: height 0.5s ease;
}

.barra-gasto-real {
    width: 35px;
    background: linear-gradient(180deg, #e53e3e, #c53030);
    border-radius: 5px 5px 0 0;
    min-height: 20px;
    transition: height 0.5s ease;
}

.barra-valor {
    font-size: 10px;
    color: #6b7280;
    display: block;
    margin-top: 5px;
}

.leyenda {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
}

.leyenda span {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.color-presupuesto {
    width: 12px;
    height: 12px;
    background: #3b82f6;
    border-radius: 3px;
    
}

.color-gasto-real {
    width: 12px;
    height: 12px;
    background: #e53e3e;
    border-radius: 3px;
}

/* Gráfico de dona */
.donut-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 20px 0;
}

.donut {
    width: 180px;
    height: 180px;
    transform: rotate(-90deg);
}

.donut-center {
    position: absolute;
    text-align: center;
}

.donut-total {
    font-size: 22px;
    font-weight: bold;
}

.donut-label {
    font-size: 10px;
    color: #6b7280;
}

.categorias {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
}

.categoria {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 13px;
}

.cat-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: inline-block;
    margin-right: 8px;
}

/* ============================================
   CARDS Y TABLAS
   ============================================ */

.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 25px;
    margin-bottom: 35px;
}

.card {
    background: white;
    padding: 22px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.card h3 {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 12px;
    font-weight: 500;
}

.card p {
    font-size: 32px;
    font-weight: 700;
}

.trend {
    font-size: 11px;
    display: inline-block;
    margin-top: 10px;
}

.trend.positivo {
    color: #2dbb73;
}

.trend.negativo {
    color: #e53e3e;
}

.positivo {
    color: #2dbb73;
}

/* Tabla de usuarios */
.tabla-movimientos {
    background: white;
    padding: 20px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    margin-top: 25px;
    overflow-x: auto;
}

.tabla-movimientos h3 {
    margin-bottom: 20px;
    font-size: 18px;
}

table {
    width: 100%;
    border-collapse: collapse;
    min-width: 600px;
}

th {
    text-align: left;
    padding: 14px 12px;
    background: #f9fafb;
    color: #6b7280;
    font-weight: 600;
    font-size: 13px;
}

td {
    padding: 14px 12px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
}

tr:hover {
    background: #f9fafb;
}

/* Badges */
.badge-excelente {
    background: #2dbb73;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.badge-bueno {
    background: #3b82f6;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.badge-regular {
    background: #f59e0b;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.badge-atencion {
    background: #e53e3e;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 1024px) {
    .chart-barras {
        flex-direction: column;
        align-items: center;
    }
    
    .barra-container {
        flex-direction: row;
        height: auto;
        gap: 20px;
    }
    
    .barra-presupuesto, .barra-gasto-real {
        width: 50px;
        height: 30px !important;
        border-radius: 5px;
    }
}

@media (max-width: 768px) {
    .presupuesto-header {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .graficas {
        grid-template-columns: 1fr;
    }
    
    .presupuesto-input {
        width: 100px;
    }
    
    .resumen-presupuesto {
        grid-template-columns: 1fr;
    }
    
    .categoria-nombre {
        font-size: 12px;
    }
    
    .categoria-icono {
        width: 28px;
        height: 28px;
        font-size: 14px;
    }
}

@media (max-width: 480px) {
    .presupuesto-tabla th,
    .presupuesto-tabla td {
        padding: 10px 8px;
        font-size: 12px;
    }
    
    .presupuesto-input {
        width: 80px;
        font-size: 12px;
        padding: 6px 8px;
    }
    
    .btn-editar-presupuesto {
        padding: 4px 10px;
        font-size: 10px;
    }
}

/* ============================================
   REPORTES.CSS - Estilos para Reportes
   Diseño basado en la imagen proporcionada
   ============================================ */

/* Contenedor principal */
.reportes-container {
    padding: 20px;
}

/* ============================================
   HEADER CON SELECTOR DE FECHA
   ============================================ */
.reportes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 15px;
}

.reportes-header h1 {
    font-size: 24px;
    color: #1a202c;
    margin: 0;
}

.reportes-header p {
    color: #6b7280;
    font-size: 14px;
    margin-top: 5px;
}

.fecha-selector {
    background: white;
    padding: 8px 16px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.fecha-selector span {
    color: #6b7280;
    font-size: 14px;
}

.fecha-selector select {
    border: none;
    background: transparent;
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #1a202c;
    cursor: pointer;
    padding: 5px;
}

.fecha-selector select:focus {
    outline: none;
}

/* ============================================
   CARDS DE ESTADÍSTICAS
   ============================================ */
.stats-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 30px;
}

.stat-card {
    background: white;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    transition: transform 0.3s ease;
}

.stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

.stat-card h3 {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 12px;
    font-weight: 500;
}

.stat-card .valor {
    font-size: 28px;
    font-weight: 700;
    color: #1a202c;
    margin-bottom: 8px;
}

.stat-card .trend {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.stat-card .trend.up {
    color: #2dbb73;
}

.stat-card .trend.down {
    color: #e53e3e;
}

.stat-card .subtitulo {
    font-size: 12px;
    color: #6b7280;
    margin-top: 8px;
}

/* Card de Metas */
.metas-card {
    background: linear-gradient(135deg, #2dbb73 0%, #1a8a4a 100%);
    color: white;
}

.metas-card h3 {
    color: rgba(255,255,255,0.8);
}

.metas-card .valor {
    color: white;
}

.metas-card .subtitulo {
    color: rgba(255,255,255,0.7);
}

/* ============================================
   GRÁFICO PRINCIPAL
   ============================================ */
.chart-section {
    background: white;
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.chart-header h3 {
    font-size: 18px;
    color: #1a202c;
}

.chart-legend {
    display: flex;
    gap: 20px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #6b7280;
}

.legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
}

.legend-color.ingresos {
    background: #2dbb73;
}

.legend-color.gastos {
    background: #e53e3e;
}

.legend-color.balance {
    background: #3b82f6;
}

/* Gráfico de barras */
.chart-container {
    position: relative;
    padding: 20px 0 40px 0;
}

.chart-bars {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    gap: 15px;
    height: 300px;
}

.bar-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.bar-wrapper {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    height: 250px;
}

.bar-ingreso {
    width: 30px;
    background: linear-gradient(180deg, #2dbb73, #1a8a4a);
    border-radius: 8px 8px 0 0;
    transition: height 0.5s ease;
}

.bar-gasto {
    width: 30px;
    background: linear-gradient(180deg, #e53e3e, #c53030);
    border-radius: 8px 8px 0 0;
    transition: height 0.5s ease;
}

.bar-label {
    font-size: 12px;
    color: #6b7280;
    text-align: center;
}

.bar-value {
    font-size: 10px;
    color: #9ca3af;
}

/* Anotación del balance */
.chart-annotation {
    text-align: center;
    margin-top: 20px;
    padding: 12px;
    background: #f0fdf4;
    border-radius: 12px;
    display: inline-block;
    width: auto;
}

.chart-annotation span {
    color: #2dbb73;
    font-weight: 700;
    font-size: 18px;
}

/* ============================================
   GRID DE DOS COLUMNAS
   ============================================ */
.reportes-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    margin-bottom: 30px;
}

/* ============================================
   REPORTES RECIENTES
   ============================================ */
.recientes-section {
    background: white;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.recientes-section h3 {
    font-size: 18px;
    color: #1a202c;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.recientes-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.reporte-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: #f9fafb;
    border-radius: 12px;
    transition: all 0.3s ease;
    cursor: pointer;
}

.reporte-item:hover {
    background: #f3f4f6;
    transform: translateX(5px);
}

.reporte-info h4 {
    font-size: 16px;
    color: #1a202c;
    margin-bottom: 5px;
}

.reporte-info p {
    font-size: 12px;
    color: #6b7280;
}

.reporte-icono {
    font-size: 24px;
}

/* ============================================
   CATEGORÍAS DE GASTOS
   ============================================ */
.categorias-section {
    background: white;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.categorias-section h3 {
    font-size: 18px;
    color: #1a202c;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.categorias-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.categoria-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #e5e7eb;
}

.categoria-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.categoria-icono {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.categoria-icono.comida { background: rgba(45, 187, 115, 0.15); }
.categoria-icono.vivienda { background: rgba(59, 130, 246, 0.15); }
.categoria-icono.transporte { background: rgba(245, 158, 11, 0.15); }
.categoria-icono.entretenimiento { background: rgba(139, 92, 246, 0.15); }
.categoria-icono.otros { background: rgba(107, 114, 128, 0.15); }

.categoria-texto h4 {
    font-size: 14px;
    color: #1a202c;
    margin-bottom: 4px;
}

.categoria-texto p {
    font-size: 12px;
    color: #6b7280;
}

.categoria-monto {
    text-align: right;
}

.categoria-monto .monto {
    font-size: 16px;
    font-weight: 700;
    color: #1a202c;
}

.categoria-monto .porcentaje {
    font-size: 12px;
    color: #6b7280;
}

/* Barra de progreso de categoría */
.categoria-progreso {
    width: 100%;
    margin-top: 8px;
}

.progreso-bg {
    background: #e5e7eb;
    border-radius: 10px;
    height: 6px;
    overflow: hidden;
}

.progreso-fill {
    height: 100%;
    border-radius: 10px;
    transition: width 0.5s ease;
}

/* ============================================
   BOTÓN VER TOTALES
   ============================================ */
.btn-ver-totales {
    text-align: center;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
}

.btn-ver-totales button {
    background: transparent;
    border: 1px solid #2dbb73;
    color: #2dbb73;
    padding: 10px 24px;
    border-radius: 12px;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-ver-totales button:hover {
    background: #2dbb73;
    color: white;
    transform: translateY(-2px);
}

/* ============================================
   RESPONSIVE
   ============================================ */
@media (max-width: 1200px) {
    .stats-cards {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .reportes-grid {
        grid-template-columns: 1fr;
    }
    
    .stats-cards {
        grid-template-columns: 1fr;
    }
    
    .chart-bars {
        gap: 8px;
    }
    
    .bar-ingreso, .bar-gasto {
        width: 20px;
    }
    
    .reportes-header {
        flex-direction: column;
        align-items: flex-start;
    }
}

/* ============================================
   GRÁFICO CIRCULAR (DONA)
   ============================================ */

.dona-section {
    background: white;
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.dona-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 15px;
}

.dona-header h3 {
    font-size: 18px;
    color: #1a202c;
    display: flex;
    align-items: center;
    gap: 10px;
}

.dona-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
}

.dona-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #6b7280;
}

.dona-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
}

.dona-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 40px;
    flex-wrap: wrap;
    padding: 20px;
}

.dona-grafico {
    position: relative;
    width: 220px;
    height: 220px;
}

.dona-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
}

.dona-centro {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
}

.dona-total {
    font-size: 24px;
    font-weight: 700;
    color: #1a202c;
}

.dona-label {
    font-size: 11px;
    color: #6b7280;
}

.dona-lista {
    flex: 1;
    min-width: 200px;
}

.dona-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #e5e7eb;
}

.dona-item-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.dona-item-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
}

.dona-item-nombre {
    font-size: 14px;
    color: #374151;
}

.dona-item-valor {
    font-weight: 600;
    color: #1a202c;
}

.dona-item-porcentaje {
    font-size: 12px;
    color: #6b7280;
    margin-left: 10px;
}

#tituloM{
    color: white;
}
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.texto-rojo { color: #e74c3c !important; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.bar-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 250px; /* Altura fija del contenedor de barras */
}

/* Transiciones suaves para las barras */
.bar-ingreso, .bar-gasto {
  transition: height 0.5s ease;
  width: 15px;
  border-radius: 4px 4px 0 0;
}

.bar-ingreso { background-color: #2dbb73; }
.bar-gasto { background-color: #ef4444; }

.categoria-group {
  margin-bottom: 1.5rem;
}
</style>
<style scoped>
/* --- Reportes recientes --- */
.recientes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}
.recientes-header h3 { margin: 0; }
.btn-borrar-todos {
  background: none;
  color: var(--danger-red);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
}
.btn-borrar-todos:hover { background: rgba(229, 62, 62, 0.1); }
.recientes-list { max-height: 520px; overflow-y: auto; gap: 10px; }
.reporte-item:hover { transform: none; }
.reporte-item {
  display: block;
  padding: 0;
  border: 1px solid var(--gray-light);
  border-radius: 12px;
  margin-bottom: 0;
  flex-shrink: 0; /* la lista es flex con altura máxima: sin esto se aplastan */
  background: transparent;
  overflow: hidden;
  transition: border-color 0.2s;
}
.reporte-item.abierto { border-color: var(--primary-green); }
.reporte-cabecera {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
}
.reporte-cabecera:hover { background: var(--gray-bg); }
.reporte-cabecera .reporte-info { flex: 1; min-width: 0; }
.reporte-cabecera .reporte-info h4 { margin: 0 0 2px; font-size: 14px; }
.reporte-cabecera .reporte-info p { margin: 0; font-size: 12px; color: var(--gray-text); }
.reporte-flecha { font-size: 11px; color: var(--gray-text); }
.btn-borrar-reporte {
  background: none;
  font-size: 15px;
  padding: 6px 8px;
  border-radius: 8px;
  opacity: 0.6;
}
.btn-borrar-reporte:hover { opacity: 1; background: rgba(229, 62, 62, 0.12); }
.reporte-detalle {
  padding: 4px 14px 14px;
  border-top: 1px solid var(--gray-light);
}
.detalle-totales {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0;
}
.detalle-totales div {
  background: var(--gray-bg);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.detalle-totales span { font-size: 11px; color: var(--gray-text); }
.detalle-totales b { font-size: 14px; }
.verde { color: var(--primary-dark); }
.rojo { color: var(--danger-red); }
.detalle-categoria {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 4px 0;
}
.detalle-barra { height: 6px; background: var(--gray-light); border-radius: 4px; overflow: hidden; }
.detalle-barra div { height: 100%; background: var(--primary-green); border-radius: 4px; }
.detalle-vacio { font-size: 13px; color: var(--gray-text); margin: 12px 0 0; }
.sin-reportes { text-align: center; color: var(--gray-text); font-size: 14px; padding: 25px 10px; }
.sin-reportes div { font-size: 30px; margin-bottom: 6px; }
</style>
