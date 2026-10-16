<!--
  Menú lateral de las pantallas del usuario (Página Principal, Gastos, Metas, Reportes y Configuración).
  Es un único componente para que el menú tenga siempre el mismo ancho, alto, posición y tipografía:
  antes cada pantalla tenía su propia copia con estilos distintos.
-->
<template>
  <aside class="sidebar">
    <div class="logo">🐷 <span>Finanzas <b>Personales</b></span></div>

    <nav class="menu">
      <router-link to="/inicio">Página Principal</router-link>
      <router-link to="/gastos">Gastos e Ingresos</router-link>
      <router-link to="/metas">Metas</router-link>
      <router-link to="/reportes">Reportes</router-link>
      <router-link to="/configuracion">Configuración</router-link>
    </nav>

    <div class="user-profile">
      <div class="info">
        <b>{{ sesion?.nombre }}</b><br>
        {{ sesion?.rol }}
      </div>
      <button class="btn-logout" @click="cerrarSesion">Cerrar Sesión</button>
    </div>
  </aside>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { api, obtenerSesion } from './api';

const router = useRouter();
const sesion = obtenerSesion();

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
</script>

<style scoped>
.sidebar {
  box-sizing: border-box;   /* el ancho incluye el relleno: mide lo mismo en todas las pantallas */
  width: 240px;
  flex: 0 0 240px;          /* el contenido de la página no puede estirarlo ni encogerlo */
  height: 100vh;
  position: sticky;
  top: 0;
  align-self: flex-start;   /* necesario para que "sticky" funcione dentro de un contenedor flex */
  overflow-y: auto;
  padding: 25px;
  display: flex;
  flex-direction: column;
  background: #122326;
  color: white;
  font-family: 'Poppins', sans-serif;
  font-size: 16px;
  line-height: 1.5;
}

.logo { font-size: 1.2rem; margin-bottom: 40px; }
.logo b { color: #2dbb73; }

.menu a {
  display: block;
  color: #a0aec0;
  text-decoration: none;
  padding: 12px 15px;
  margin-bottom: 8px;
  border-radius: 12px;
  border-left: 4px solid transparent; /* reserva el borde para que el texto no salte al marcarse */
  transition: 0.3s;
}
.menu a:hover,
.menu a.router-link-active {
  color: white;
  background: rgba(45, 187, 115, 0.15);
  border-left-color: #2dbb73;
}

.user-profile { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2d3748; }
.info { font-size: 0.9rem; color: #5778a4; margin-bottom: 15px; }

.btn-logout {
  width: 100%;
  padding: 8px;
  background: #e53e3e;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: bold;
  transition: 0.2s;
}
.btn-logout:hover { background: #c53030; }
</style>
