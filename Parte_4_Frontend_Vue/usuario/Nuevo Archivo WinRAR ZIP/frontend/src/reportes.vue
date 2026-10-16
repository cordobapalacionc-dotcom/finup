<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="logo">🐷 <span>Finanzas <b>Personales</b></span></div>

      <nav class="menu">
        <router-link to="/inicio">Página Principal</router-link>
        <router-link to="/gastos">Gastos e Ingresos</router-link>
        <router-link to="/metas">Metas</router-link>
        <router-link to="/reportes" class="active">Reportes</router-link>
        <router-link to="/configuracion">Configuración</router-link>
      </nav>

      <div class="user-profile">
        <div class="info">
          <b>{{ sesion?.nombre }}</b><br>
          {{ sesion?.rol }}
        </div>
        <button @click="cerrarSesion" class="btn-logout">Cerrar Sesión</button>
      </div>
    </aside>

    <main class="main">
      <header class="header">
        <div>
          <h1>📊 Mis <span>Reportes</span></h1>
          <p>Analiza tus ingresos y gastos por periodo</p>
        </div>
        <div class="acciones-header">
          <select v-model="periodo" @change="cargarDatos" class="selector-periodo">
            <option v-for="(texto, valor) in NOMBRE_PERIODO" :key="valor" :value="valor">📅 {{ texto }}</option>
          </select>
          <button class="btn" @click="generarReporte">📄 Generar reporte</button>
        </div>
      </header>

      <!-- Totales -->
      <section class="stats">
        <div class="card stat">
          <p>💰 Ingresos</p>
          <h3 class="positivo">{{ moneda(resumen.ingresos) }}</h3>
          <span>{{ resumen.transacciones }} movimiento(s)</span>
        </div>
        <div class="card stat">
          <p>💸 Gastos</p>
          <h3 class="negativo">{{ moneda(resumen.gastos) }}</h3>
        </div>
        <div class="card stat">
          <p>⚖️ Balance</p>
          <h3 :class="balance >= 0 ? 'positivo' : 'negativo'">{{ balance >= 0 ? '+' : '-' }}{{ moneda(Math.abs(balance)) }}</h3>
        </div>
        <div class="card stat">
          <p>🎯 Metas cumplidas</p>
          <h3>{{ resumen.metas_cumplidas }}/{{ resumen.metas }}</h3>
          <span>{{ resumen.metas ? Math.round(resumen.metas_cumplidas / resumen.metas * 100) : 0 }}% completado</span>
        </div>
      </section>

      <!-- Gráfica -->
      <section class="card grafica">
        <div class="grafica-header">
          <h3>Ingresos vs Gastos</h3>
          <div class="leyenda">
            <span><i class="punto verde"></i> Ingresos</span>
            <span><i class="punto rojo"></i> Gastos</span>
          </div>
        </div>
        <div class="barras">
          <div v-for="(g, i) in serie" :key="i" class="grupo" :title="`${g.label}: ingresos ${moneda(g.ingresos)} · gastos ${moneda(g.gastos)}`">
            <div class="columnas">
              <div class="barra verde" :style="{ height: altura(g.ingresos) }"></div>
              <div class="barra rojo" :style="{ height: altura(g.gastos) }"></div>
            </div>
            <span class="etiqueta">{{ g.label }}</span>
          </div>
        </div>
      </section>

      <div class="dos-columnas">
        <!-- Gasto por categoría -->
        <section class="card">
          <h3>📂 Gastos por categoría</h3>
          <div v-if="totalGastos === 0" class="vacio">No tienes gastos en este periodo.</div>
          <div v-for="c in categoriasConGasto" :key="c.id" class="categoria">
            <div class="categoria-fila">
              <span>{{ etiqueta(c.nombre) }}</span>
              <b>{{ moneda(c.monto) }} <small>{{ c.porcentaje }}%</small></b>
            </div>
            <div class="barra-fondo"><div class="barra-relleno" :style="{ width: c.porcentaje + '%' }"></div></div>
          </div>
        </section>

        <!-- Reportes guardados -->
        <section class="card">
          <div class="guardados-header">
            <h3>📄 Reportes guardados</h3>
            <button v-if="guardados.length > 1" class="btn-texto-rojo" @click="borrarTodos">Borrar todos</button>
          </div>
          <div v-if="guardados.length === 0" class="vacio">
            Aún no tienes reportes. Pulsa <b>Generar reporte</b> para guardar los totales del periodo elegido.
          </div>
          <div v-for="rep in guardados" :key="rep.id" class="reporte" :class="{ abierto: abierto === rep.id }">
            <div class="reporte-cabecera" @click="abierto = abierto === rep.id ? null : rep.id">
              <div class="reporte-texto">
                <b>{{ rep.tipo }}</b>
                <span>{{ fechaHora(rep.fecha_generado) }}</span>
              </div>
              <span class="flecha">{{ abierto === rep.id ? '▲' : '▼' }}</span>
              <button class="btn-borrar" title="Eliminar reporte" @click.stop="eliminarReporte(rep.id)">🗑️</button>
            </div>
            <div v-if="abierto === rep.id && rep.datos" class="reporte-detalle">
              <div class="mini-totales">
                <div><span>Ingresos</span><b class="positivo">{{ moneda(rep.datos.ingresos) }}</b></div>
                <div><span>Gastos</span><b class="negativo">{{ moneda(rep.datos.gastos) }}</b></div>
                <div><span>Balance</span><b>{{ moneda(rep.datos.ingresos - rep.datos.gastos) }}</b></div>
              </div>
              <div v-for="c in rep.datos.categorias" :key="c.nombre" class="mini-categoria">
                <span>{{ c.nombre }}</span><b>{{ moneda(c.monto) }}</b>
              </div>
              <p v-if="!rep.datos.categorias.length" class="vacio">Sin gastos en ese periodo.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, moneda, obtenerSesion } from './api';

const router = useRouter();
const sesion = obtenerSesion();

const NOMBRE_PERIODO = { '7': 'Últimos 7 días', '30': 'Últimos 30 días', '90': 'Últimos 90 días', '365': 'Último año' };
// Cómo se agrupa la gráfica en cada periodo
const AGRUPACION = { '7': 'dias=7', '30': 'dias=30&agrupar=semana', '90': 'meses=3', '365': 'meses=12' };
const EMOJI = {
  'Alimentación': '🛒', 'Transporte': '🚗', 'Entretenimiento': '🎬', 'Servicios': '💡',
  'Salud': '🏥', 'Educación': '🎓', 'Otros gastos': '📦'
};

const periodo = ref('30');
const resumen = ref({ ingresos: 0, gastos: 0, transacciones: 0, metas: 0, metas_cumplidas: 0 });
const serie = ref([]);
const gastosCategoria = ref([]);
const guardados = ref([]);
const abierto = ref(null);

const balance = computed(() => resumen.value.ingresos - resumen.value.gastos);
const totalGastos = computed(() => gastosCategoria.value.reduce((a, c) => a + c.monto, 0));
const categoriasConGasto = computed(() => gastosCategoria.value
  .filter(c => c.monto > 0)
  .map(c => ({ ...c, porcentaje: Math.round(c.monto / totalGastos.value * 100) })));
const maximo = computed(() => Math.max(1, ...serie.value.flatMap(g => [g.ingresos, g.gastos])));

const altura = (valor) => `${Math.max((valor / maximo.value) * 100, valor > 0 ? 2 : 0)}%`;
const etiqueta = (nombre) => `${EMOJI[nombre] || '🏷️'} ${nombre}`;
const fechaHora = (texto) => {
  const d = new Date(texto.replace(' ', 'T'));
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const cargarGuardados = async () => {
  guardados.value = await api('/reportes/guardados');
};

const cargarDatos = async () => {
  try {
    const [r, s, g] = await Promise.all([
      api(`/reportes/resumen?dias=${periodo.value}`),
      api(`/reportes/serie?${AGRUPACION[periodo.value]}`),
      api(`/reportes/gastos-categoria?dias=${periodo.value}`)
    ]);
    resumen.value = r;
    serie.value = s;
    gastosCategoria.value = g;
  } catch (e) {
    console.error(e);
  }
};

// Guarda una foto de los totales del periodo elegido
const generarReporte = async () => {
  try {
    const { id } = await api('/reportes/guardados', {
      method: 'POST',
      body: {
        tipo: `Resumen: ${NOMBRE_PERIODO[periodo.value].toLowerCase()}`,
        datos: {
          periodo: periodo.value,
          ingresos: resumen.value.ingresos,
          gastos: resumen.value.gastos,
          metas: resumen.value.metas,
          metas_cumplidas: resumen.value.metas_cumplidas,
          categorias: categoriasConGasto.value.map(c => ({ nombre: c.nombre, monto: c.monto, porcentaje: c.porcentaje }))
        }
      }
    });
    await cargarGuardados();
    abierto.value = id;
  } catch (e) {
    console.error(e);
  }
};

const eliminarReporte = async (id) => {
  try {
    await api(`/reportes/guardados/${id}`, { method: 'DELETE' });
    await cargarGuardados();
  } catch (e) {
    console.error(e);
  }
};

const borrarTodos = async () => {
  try {
    await api('/reportes/guardados', { method: 'DELETE' });
    abierto.value = null;
    await cargarGuardados();
  } catch (e) {
    console.error(e);
  }
};

const cerrarSesion = async () => {
  try {
    await api('/logout', { method: 'POST', body: {} });
  } catch (e) {
    console.error(e);
  } finally {
    localStorage.removeItem('usuario_identificado');
    router.push('/');
  }
};

onMounted(() => {
  cargarDatos();
  cargarGuardados().catch(e => console.error(e));
});
</script>

<style scoped>
/* --- Estructura y menú (igual que las demás pantallas del usuario) --- */
.dashboard { display: flex; min-height: 100vh; background: #f0f4f8; font-family: 'Poppins', sans-serif; }
.sidebar {
  width: 10%;
  min-width: 170px;
  background: #122326;
  color: white;
  padding: 25px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}
.logo { font-size: 1.2rem; margin-bottom: 40px; }
.logo b { color: #2dbb73; }
.menu a { color: #a0aec0; text-decoration: none; padding: 12px 15px; margin-bottom: 8px; border-radius: 12px; display: block; }
.menu a.active,
.menu a:hover { color: white; background: rgba(45, 187, 115, 0.15); border-left: 4px solid #2dbb73; }
.user-profile { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2d3748; }
.user-profile .info { color: #5778a4; margin-bottom: 12px; }
.btn-logout { width: 100%; padding: 8px; background: #e53e3e; color: white; border: none; border-radius: 8px; cursor: pointer; }

.main { flex: 1; padding: 40px; min-width: 0; }

/* --- Encabezado --- */
.header { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 30px; }
.header h1 { margin: 0; color: #1a202c; }
.header h1 span { color: #2dbb73; }
.header p { margin: 6px 0 0; color: #718096; }
.acciones-header { display: flex; gap: 10px; flex-wrap: wrap; }
.selector-periodo {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  font-size: 14px;
  cursor: pointer;
}
.btn {
  background: #2dbb73;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover { background: #1a8a4a; }

/* --- Tarjetas --- */
.card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04); }
.card h3 { margin: 0 0 16px; color: #1a202c; font-size: 17px; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; margin-bottom: 24px; }
.stat p { margin: 0 0 8px; color: #718096; font-size: 14px; }
.stat h3 { font-size: 24px; margin: 0 0 4px; }
.stat span { font-size: 12px; color: #a0aec0; }
.positivo { color: #2dbb73; }
.negativo { color: #e53e3e; }

/* --- Gráfica --- */
.grafica { margin-bottom: 24px; }
.grafica-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.leyenda { display: flex; gap: 16px; font-size: 13px; color: #718096; }
.punto { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; }
.punto.verde, .barra.verde { background: #2dbb73; }
.punto.rojo, .barra.rojo { background: #e53e3e; }
.barras { display: flex; align-items: flex-end; justify-content: space-around; gap: 8px; height: 230px; margin-top: 10px; }
.grupo { flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; }
.columnas { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 4px; border-bottom: 1px solid #e2e8f0; }
.barra { width: 16px; max-width: 40%; border-radius: 6px 6px 0 0; transition: height 0.4s ease; }
.etiqueta { font-size: 12px; color: #718096; margin-top: 8px; }

/* --- Categorías --- */
.dos-columnas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.categoria { margin-bottom: 14px; }
.categoria-fila { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
.categoria-fila small { color: #a0aec0; font-weight: 400; margin-left: 4px; }
.barra-fondo { height: 8px; background: #edf2f7; border-radius: 5px; overflow: hidden; }
.barra-relleno { height: 100%; background: #2dbb73; border-radius: 5px; }
.vacio { color: #a0aec0; font-size: 14px; text-align: center; padding: 20px 0; }

/* --- Reportes guardados --- */
.guardados-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.guardados-header h3 { margin: 0; }
.btn-texto-rojo { background: none; border: none; color: #e53e3e; font-weight: 600; font-size: 13px; cursor: pointer; padding: 6px 8px; border-radius: 8px; }
.btn-texto-rojo:hover { background: rgba(229, 62, 62, 0.1); }
.reporte { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 10px; overflow: hidden; }
.reporte.abierto { border-color: #2dbb73; }
.reporte-cabecera { display: flex; align-items: center; gap: 10px; padding: 12px 14px; cursor: pointer; }
.reporte-cabecera:hover { background: #f7fafc; }
.reporte-texto { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.reporte-texto b { font-size: 14px; color: #1a202c; }
.reporte-texto span { font-size: 12px; color: #a0aec0; }
.flecha { font-size: 11px; color: #a0aec0; }
.btn-borrar { background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px 6px; border-radius: 8px; opacity: 0.6; }
.btn-borrar:hover { opacity: 1; background: rgba(229, 62, 62, 0.12); }
.reporte-detalle { padding: 4px 14px 14px; border-top: 1px solid #e2e8f0; }
.mini-totales { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
.mini-totales div { background: #f7fafc; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; }
.mini-totales span { font-size: 11px; color: #a0aec0; }
.mini-categoria { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }

@media (max-width: 1000px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dos-columnas { grid-template-columns: 1fr; }
}
</style>
