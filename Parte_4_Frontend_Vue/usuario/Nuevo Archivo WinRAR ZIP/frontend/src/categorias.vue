<!-- CU-01 · Gestionar categorías (usuario) -->
<template>
  <div class="dashboard">
    <MenuUsuario />
    <main class="main">
      <GestionCategorias modo="usuario" />
    </main>
  </div>
</template>

<script setup>
import MenuUsuario from './MenuUsuario.vue';
import GestionCategorias from './GestionCategorias.vue';
</script>

<style scoped>
.dashboard { display: flex; min-height: 100vh; background: #f0f4f8; font-family: 'Poppins', sans-serif; }
.main { flex: 1; padding: 40px; min-width: 0; }
</style>
