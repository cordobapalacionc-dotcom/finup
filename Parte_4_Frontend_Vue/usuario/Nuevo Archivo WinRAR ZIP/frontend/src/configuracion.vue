<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="logo">
        <span>🐷 Finanzas <b>Personales</b></span>
      </div>

      <nav class="menu">
        <router-link to="/inicio">Página Principal</router-link>
        <router-link to="/gastos">Gastos e Ingresos</router-link>
        <router-link to="/metas">Metas</router-link>
        <router-link to="/reportes">Reportes</router-link>
        <router-link to="/configuracion" class="active">Configuración</router-link>
      </nav>

      
      <div class="user-profile">
        <div class="info">
          <b>{{ perfil.nombre }}</b><br>
          <span>Estudiante</span>
        </div>
        

        <button class="btn-logout" @click="cerrarSesion">Cerrar Sesión</button>
      </div>
    </aside>

    <main class="contenido">
      <header class="header-section">
        <h1>Configuración</h1>
        <p class="subtitulo">Ajustes de cuenta y preferencias del sistema</p>
      </header>
      
      <div class="config-grid">
        
        <div class="card">
          <div class="card-header">
            <span class="icon">👤</span>
            <h3>Perfil</h3>
          </div>
          <div class="input-group">
            <label>Nombre de Usuario</label>
            <input type="text" v-model="perfil.nombre" placeholder="Tu nombre">
          </div>
          <div class="input-group">
            <label>Correo Electrónico</label>
            <input type="email" v-model="perfil.correo" placeholder="correo@ejemplo.com">
          </div>
          <button class="btn-save" @click="guardarCambios">Guardar Cambios</button>
        </div>
        
        <div class="card">
          <div class="card-header">
            <span class="icon">🔒</span>
            <h3>Seguridad</h3>
          </div>
          <div class="input-group">
            <label>Contraseña Actual</label>
            <input type="password" v-model="seguridad.actual" placeholder="Ingresa tu clave actual">
          </div>
          <div class="input-group">
            <label>Nueva Contraseña</label>
            <input type="password" v-model="seguridad.nueva" placeholder="Mín. 8 caracteres, letra y número">
            <small v-if="seguridad.nueva && !passwordValida" style="color: #ff4d4d; font-size: 11px; display: block; margin-top: 5px;">
              Debe tener 10 caracteres, una letra y un número.
            </small>
            <small v-if="seguridad.nueva && seguridad.nueva === seguridad.actual" style="color: #ff4d4d; font-size: 11px; display: block; margin-top: 5px;">
              La nueva contraseña no puede ser igual a la actual.
            </small>
          </div>
          <button class="btn-save security" @click="guardarCambios">Actualizar Contraseña</button>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="icon">🎨</span>
            <h3>Apariencia</h3>
          </div>
          <p class="tema-descripcion">Elige cómo quieres ver la aplicación.</p>
          <div class="tema-opciones">
            <button type="button" class="tema-opcion" :class="{ seleccionada: tema === 'claro' }" @click="tema = 'claro'">
              <span class="tema-muestra claro no-invertir"></span>
              ☀️ Claro
            </button>
            <button type="button" class="tema-opcion" :class="{ seleccionada: tema === 'oscuro' }" @click="tema = 'oscuro'">
              <span class="tema-muestra oscuro no-invertir"></span>
              🌙 Oscuro
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { tema } from "./tema";
import { useRouter } from 'vue-router';

const router = useRouter();
const usuarioId = ref(null);

const perfil = ref({ nombre: '', correo: '' });
const seguridad = ref({ actual: '', nueva: '' });
const sistema = ref({ idioma: 'es', modo: 'claro' });
const notificaciones = ref({ correos: true, alertas: false });

// --- VALIDACIONES DE CONTRASEÑA ---
const tieneOchoCaracteres = computed(() => seguridad.value.nueva.length >= 8);
const tieneNumero = computed(() => /\d/.test(seguridad.value.nueva));
const tieneLetra = computed(() => /[a-zA-Z]/.test(seguridad.value.nueva));

const passwordValida = computed(() => {
  // Si el campo está vacío, es válido (porque no se está intentando cambiar)
  if (!seguridad.value.nueva) return true;
  return tieneOchoCaracteres.value && tieneNumero.value && tieneLetra.value;
});

onMounted(() => {
  const sesion = localStorage.getItem('usuario_identificado');
  if (sesion) {
    const data = JSON.parse(sesion);
    usuarioId.value = data.id;
    perfil.value.nombre = data.nombre;
    perfil.value.correo = data.correo;
  } else {
    router.push('/');
  }
});

// FUNCIÓN PRINCIPAL: GUARDA EN DB NOMBRE, CORREO Y/O CONTRASEÑA
const guardarCambios = async () => {
  // 1. Validaciones básicas de campos obligatorios
  if (!perfil.value.nombre || !perfil.value.correo) {
    return;
  }

  // 2. Lógica de Seguridad: Validaciones antes de enviar al servidor
  if (seguridad.value.nueva) {
    if (!seguridad.value.actual) {
      return;
    }
    if (seguridad.value.nueva === seguridad.value.actual) {
      return;
    }
    if (!passwordValida.value) {
      return;
    }
  }

  try {
    const res = await fetch(`http://localhost:3000/api/usuario/actualizar/${usuarioId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: perfil.value.nombre,
        correo: perfil.value.correo,
        contraseña_actual: seguridad.value.actual, // Coincide con el servidor
        contraseña_nueva: seguridad.value.nueva    // Coincide con el servidor
      })
    });

    const data = await res.json();

    if (res.ok) {
      // 3. Sincronizar la sesión local (LocalStorage)
      const sesionData = JSON.parse(localStorage.getItem('usuario_identificado'));
      const sesionActualizada = { 
        ...sesionData,
        nombre: perfil.value.nombre,
        correo: perfil.value.correo
      };
      localStorage.setItem('usuario_identificado', JSON.stringify(sesionActualizada));
      
      
      // Limpiar campos de seguridad tras éxito
      seguridad.value.actual = '';
      seguridad.value.nueva = '';
    } else {
      // Aquí el servidor responderá si la contraseña actual fue incorrecta
    }
  } catch (error) {
    console.error("Error en la petición:", error);
  }
};

const cerrarSesion = async () => {
  try {
    if (usuarioId.value) {
      await fetch('http://localhost:3000/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId.value })
      });
    }
  } catch (err) {
    console.error("Error al cerrar sesión en servidor:", err);
  } finally {
    localStorage.removeItem('usuario_identificado');
    router.push('/');
  }
};

const aplicarSistema = () => {};
const guardarNotificaciones = () => {};



// Al montar el componente, verificamos si ya estaba en modo oscuro
onMounted(() => {
  // ... resto de tu onMounted existente
});

</script>


<style scoped>
/* FUENTE Y LAYOUT */
.dashboard {
  display: flex;
  min-height: 100vh;
  background: #f0f4f8;
  font-family: 'Poppins', sans-serif;
}

/* SIDEBAR */
.sidebar {
  width: 10%;
  background: #122326;
  color: white;
  padding: 25px;
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  z-index: 100;
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
  transition: 0.3s;
}

.menu a:hover, .menu a.router-link-active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.menu a.active {
  background: rgba(45, 187, 115, 0.15);
  border-left: 4px solid #2dbb73;
  color: white;
}

.user-profile { 
  margin-top: 30px; 
  border-top: 1px solid rgba(255,255,255,0.1); 
  padding-top: 20px; 
}

.info { font-size: 0.9rem; color: #5778a4; margin-bottom: 15px; }

.btn-logout {
  width: 100%; 
  padding: 10px; 
  background: #e53e3e; 
  color: white; 
  border: none; 
  border-radius: 10px; 
  cursor: pointer; 
  font-weight: bold;
  transition: 0.3s;
}
.btn-logout:hover { background: #c53030; }

/* CONTENIDO */
.contenido {
  flex: 1;
  padding: 40px 60px;
  margin-left: 250px; /* Espacio para el sidebar fixed */
}

h1 { margin: 0; color: #1a202c; font-size: 2.2rem; }
.subtitulo { color: #718096; margin-bottom: 40px; }

/* GRID DE TARJETAS */
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 30px;
}

.card {
  background: white;
  padding: 30px;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f4f8;
}

.card-header h3 { margin: 0; font-size: 1.1rem; color: #2d3748; }

.icon {
  background: #f0fdf4;
  padding: 6px;
  border-radius: 10px;
  font-size: 1.2rem;
}

.input-group { margin-bottom: 20px; }
label { display: block; font-size: 0.85rem; font-weight: 600; color: #4a5568; margin-bottom: 8px; }

input, select {
  width: 90%;
  padding: 12px 15px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-family: inherit;
  font-size: 0.95rem;
  transition: 0.3s;
}

input:focus, select:focus {
  outline: none;
  border-color: #2dbb73;
  box-shadow: 0 0 0 3px rgba(45, 187, 115, 0.1);
}

/* BOTONES */
.btn-save {
  margin-top: auto;
  background: #2dbb73;
  color: white;
  border: none;
  padding: 14px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}

.btn-save:hover { background: #24965d; transform: translateY(-2px); }

.btn-save.security { background: #4a5568; }
.btn-save.security:hover { background: #2d3748; }

.btn-save.secondary {
  background: #edf2f7;
  color: #4a5568;
}
.btn-save.secondary:hover { background: #e2e8f0; }

/* TOGGLES */
.toggle-group { margin-bottom: 25px; }
.toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px dashed #edf2f7;
}
.toggle span { font-size: 0.95rem; color: #4a5568; }

/* CHECKBOX ESTILIZADO (OPCIONAL) */
input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: #2dbb73;
  cursor: pointer;
}
</style>
<style scoped>
.tema-descripcion {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  opacity: 0.75;
}
.tema-opciones {
  display: flex;
  gap: 0.75rem;
}
.tema-opcion {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: transparent;
  font-family: inherit;
  font-size: 0.95rem;
  cursor: pointer;
}
.tema-opcion.seleccionada {
  border-color: #2dbb73;
}
.tema-muestra {
  width: 100%;
  height: 48px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
}
.tema-muestra.claro { background: linear-gradient(90deg, #122326 25%, #f0f4f8 25%); }
.tema-muestra.oscuro { background: linear-gradient(90deg, #122326 25%, #15191c 25%); }
</style>
