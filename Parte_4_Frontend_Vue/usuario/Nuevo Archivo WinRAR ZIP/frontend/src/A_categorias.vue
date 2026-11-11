<!-- CU-08 · Gestionar categorías (administrador): catálogo de categorías generales -->
<template>
  <div class="dashboard">
    <aside class="sidebar">
      <h1>Finanzas <span>Personales</span></h1>
      <ul>
        <li v-for="item in menuItems" :key="item.text" :class="{ active: $route.name === item.routeName }">
          <router-link :to="{ name: item.routeName }" class="menu-item">
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

    <main class="contenido">
      <GestionCategorias modo="admin" />
    </main>
  </div>
</template>

<script setup>
import { obtenerSesion } from './api'
import GestionCategorias from './GestionCategorias.vue'

const sesion = obtenerSesion()

const menuItems = [
  { text: 'Inicio', icon: '🏠', routeName: 'admin-inicio' },
  { text: 'Usuarios', icon: '👥', routeName: 'admin-usuarios' },
  { text: 'Categorías', icon: '🏷️', routeName: 'admin-categorias' },
  { text: 'Finanzas', icon: '💰', routeName: 'admin-finanzas' },
  { text: 'Reportes', icon: '📊', routeName: 'admin-reportes' },
  { text: 'Metas', icon: '🎯', routeName: 'admin-metas' },
  { text: 'Configuración', icon: '⚙️', routeName: 'configuracion' }
]
</script>

<style scoped>
/* Mismo menú lateral que las demás pantallas del administrador */
.dashboard { display: flex; min-height: 100vh; background: #f0f4f8; font-family: 'Poppins', sans-serif; }

.sidebar {
  box-sizing: border-box;
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
.sidebar h1 { font-size: 22px; margin: 0 0 40px; text-align: center; letter-spacing: 1px; }
.sidebar h1 span { color: #2dbb73; }
.sidebar ul { list-style: none; flex: 1; margin: 0; padding: 0; }
.sidebar ul li { margin-bottom: 12px; }
.sidebar ul li a {
  display: flex; align-items: center; gap: 14px; text-decoration: none; color: #a0aec0;
  padding: 12px 18px; border-radius: 12px; transition: all 0.3s ease; font-size: 15px; font-weight: 500;
}
.sidebar ul li a:hover { color: white; background: rgba(45, 187, 115, 0.15); transform: translateX(5px); }
.sidebar ul li.active a {
  color: white;
  background: linear-gradient(90deg, rgba(45, 187, 115, 0.25), transparent);
  border-left: 4px solid #2dbb73;
}
.perfil { margin-top: auto; padding-top: 25px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); }
.icono {
  width: 55px; height: 55px; background: #2dbb73; border-radius: 50%; margin: 0 auto 12px;
  display: flex; align-items: center; justify-content: center; font-size: 26px;
}
.perfil p { font-size: 15px; font-weight: 600; margin: 0; }
.perfil span { font-size: 12px; opacity: 0.7; }

.contenido { flex: 1; margin-left: 280px; padding: 30px 35px; min-width: 0; }

@media (max-width: 768px) {
  .sidebar { display: none; }
  .contenido { margin-left: 0; padding: 20px 16px; }
}
</style>
