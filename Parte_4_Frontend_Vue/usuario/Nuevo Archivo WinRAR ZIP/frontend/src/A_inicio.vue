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

    <!-- CONTENIDO -->
    <main class="contenido">
      <h1>Pagina Principal</h1>
      <p class="subtitulo">Bienvenido al panel de administración</p>
      <p v-if="error" class="subtitulo" style="color:#e74c3c">⚠️ {{ error }}</p>

      <!-- CARDS -->
      <div class="cards">
        <div v-for="card in statsCards" :key="card.title" class="card">
          <h3>{{ card.icon }} {{ card.title }}</h3>
          <p :class="{ positivo: card.isSaving }">{{ card.value }}</p>
          <span v-if="card.variacion !== null" :class="['trend', card.trendType]">
            {{ card.variacion >= 0 ? '▲' : '▼' }} {{ Math.abs(card.variacion) }}% vs mes anterior
          </span>
          <span v-else class="trend">{{ card.nota }}</span>
        </div>
      </div>

      <!-- GRAFICA -->
      <div class="chart-container">
        <h3>📊 Ingresos vs Gastos (Última semana)</h3>
        <div class="chart-content">
          <div class="bars" id="graficaPrincipal">
            <div 
              v-for="(day, index) in chartData" 
              :key="day.label" 
              class="bar-group"
            >
              <div 
                class="bar green" 
                :style="{ height: (day.ingreso / maxVal * 100) + '%' }"
                @mouseover="showTooltip($event, `Ingresos: $${day.ingreso}`)"
                @mousemove="moveTooltip"
                @mouseleave="hideTooltip"
              ></div>
              <div 
                class="bar red" 
                :style="{ height: (day.gasto / maxVal * 100) + '%' }"
                @mouseover="showTooltip($event, `Gastos: $${day.gasto}`)"
                @mousemove="moveTooltip"
                @mouseleave="hideTooltip"
              ></div>
              <span class="day-label">{{ day.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- TOOLTIP REACTIVO -->
    <div 
      v-show="tooltip.visible" 
      id="chart-tooltip" 
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { api, moneda, obtenerSesion } from './api';

const sesion = obtenerSesion();
const error = ref('');

// --- DATOS DEL MENÚ ---
const menuItems = ref([
  { text: 'Inicio', icon: '🏠', routeName: 'admin-inicio', active: true },
  { text: 'Usuarios', icon: '👥', routeName: 'admin-usuarios', active: false },
  { text: 'Finanzas', icon: '💰', routeName: 'admin-finanzas', active: false }, // O el nombre que uses para finanzas
  { text: 'Reportes', icon: '📊', routeName: 'admin-reportes', active: false },
  { text: 'Metas', icon: '🎯', routeName: 'admin-metas', active: false },
  { text: 'Configuración', icon: '⚙️', routeName: 'configuracion', active: false },
]);

// --- DATOS DE TARJETAS ---
const resumen = ref(null);

// Para los gastos, subir es malo (rojo); para lo demás, subir es bueno (verde)
const tarjeta = (title, icon, value, variacion, subirEsBueno = true, extra = {}) => ({
  title, icon, value, variacion,
  trendType: variacion === null ? '' : ((variacion >= 0) === subirEsBueno ? 'positivo' : 'negativo'),
  nota: 'Sin datos del mes anterior',
  ...extra
});

const statsCards = computed(() => {
  const r = resumen.value;
  if (!r) return [];
  return [
    tarjeta('Total Usuarios', '👥', r.usuarios.toLocaleString('es-CO'), r.tendencia.usuarios, true,
      { nota: `${r.usuarios_conectados} conectado(s) ahora` }),
    tarjeta('Ingresos Totales', '💰', moneda(r.ingresos), r.tendencia.ingresos),
    tarjeta('Gastos Totales', '💸', moneda(r.gastos), r.tendencia.gastos, false),
    tarjeta('Ahorro Global', '📈', moneda(r.ingresos - r.gastos), r.tendencia.ahorro, true, { isSaving: true }),
  ];
});

// --- LÓGICA DE LA GRÁFICA ---
const chartData = ref([]);
const maxVal = computed(() => Math.max(1, ...chartData.value.flatMap(d => [d.ingreso, d.gasto])));

onMounted(async () => {
  try {
    const [r, serie] = await Promise.all([api('/admin/resumen'), api('/admin/serie?dias=7')]);
    resumen.value = r;
    chartData.value = serie.map(d => ({ label: d.label, ingreso: d.ingresos, gasto: d.gastos }));
  } catch (e) {
    error.value = e.message;
  }
});

// --- TOOLTIP ---
const tooltip = reactive({
  visible: false,
  text: '',
  x: 0,
  y: 0
});

const showTooltip = (event, text) => {
  tooltip.text = text;
  tooltip.visible = true;
};

const moveTooltip = (event) => {
  tooltip.x = event.clientX + 10;
  tooltip.y = event.clientY - 10;
};

const hideTooltip = () => {
  tooltip.visible = false;
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
</style>