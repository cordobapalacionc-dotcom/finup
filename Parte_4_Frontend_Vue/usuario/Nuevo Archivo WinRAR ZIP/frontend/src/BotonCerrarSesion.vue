<!-- Botón "Cerrar Sesión" del menú lateral del administrador (CU-11). Invalida el token y vuelve al inicio de sesión. -->
<template>
  <button class="btn-cerrar-sesion" @click="cerrarSesion">Cerrar Sesión</button>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { api } from './api'

const router = useRouter()

const cerrarSesion = async () => {
  try {
    await api('/logout', { method: 'POST', body: {} })
  } catch (e) {
    console.error(e)
  } finally {
    localStorage.removeItem('usuario_identificado')
    router.push('/')
  }
}
</script>

<style scoped>
.btn-cerrar-sesion {
  width: 100%;
  margin-top: 16px;
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
.btn-cerrar-sesion:hover { background: #c53030; }
</style>
