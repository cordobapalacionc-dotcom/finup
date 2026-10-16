<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoginVisible = ref(true)

// Variables para Login
const emailLogin = ref('')
const passwordLogin = ref('')
const errorLogin = ref('')

// El aviso se quita en cuanto se vuelve a escribir
watch([emailLogin, passwordLogin], () => { errorLogin.value = '' })

// Variables para Registro
const nombreReg = ref('')
const emailReg = ref('')
const passwordReg = ref('')
const confirmReg = ref('')

// --- VALIDACIONES ---
const hasMinLength = computed(() => passwordReg.value.length >= 10)
const hasLetter = computed(() => /[a-zA-Z]/.test(passwordReg.value))
const hasNumber = computed(() => /[0-9]/.test(passwordReg.value))
const isPasswordValid = computed(() => hasMinLength.value && hasLetter.value && hasNumber.value)
const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailReg.value))

const isFormValid = computed(() => {
  return nombreReg.value.trim() !== '' && 
         isEmailValid.value && 
         isPasswordValid.value && 
         passwordReg.value === confirmReg.value
})

const toggleSection = (showLogin) => { isLoginVisible.value = showLogin }

// --- REGISTRO CONECTADO A DB ---
const manejarRegistro = async () => {
  if (!isFormValid.value) return;

  try {
    const response = await fetch('http://localhost:3000/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nombre: nombreReg.value, 
        correo: emailReg.value, 
        contraseña: passwordReg.value 
      })
    })

    const data = await response.json()

    if (response.ok) {
      toggleSection(true)
      nombreReg.value = emailReg.value = passwordReg.value = confirmReg.value = ''
    } else {
    }
  } catch (error) { 
  }
}

// --- LOGIN CONECTADO A DB CON REDIRECCIÓN POR ROL ---
const manejarLogin = async () => {
  if (!emailLogin.value || !passwordLogin.value) return;

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        correo: emailLogin.value, 
        contraseña: passwordLogin.value 
      })
    })
    
    const usuario = await response.json()
    
    if (response.ok) {
      // 1. Guardamos la sesión completa en LocalStorage
      localStorage.setItem('usuario_identificado', JSON.stringify(usuario))
      
      
      // 2. Lógica de Redirección Inteligente
      if (usuario.rol === 'admin') {
        // Si es admin, lo mandamos a la vista de administrador
        router.push('/admin-inicio') 
      } else {
        // Si es usuario normal, lo mandamos al inicio estándar
        router.push('/inicio')
      }

    } else {
      errorLogin.value = 'Correo o contraseña incorrectos'
    }
  } catch (error) {
    console.error("Error de login:", error)
    errorLogin.value = 'No se pudo conectar con el servidor'
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="wrapper">
      
      <div class="container" :class="{ 'hidden': !isLoginVisible }" id="loginSection">
        <div class="logo">
          <div class="logo-circle">$</div>
          <div class="logo-text">Finanzas Personales</div>
        </div>
        <h1>Iniciar sesión</h1>
        <div class="input-group">
          <label>Correo electrónico</label>
          <input v-model="emailLogin" type="email" placeholder="Tu@email.com" required>
        </div>
        <div class="input-group">
          <label>Contraseña</label>
          <input v-model="passwordLogin" type="password" placeholder="••••••••" required>
        </div>
        <p v-if="errorLogin" class="aviso-error">{{ errorLogin }}</p>
        <button @click="manejarLogin">Ingresar</button>
        <div class="register">
          ¿No tienes cuenta? 
          <a href="#" @click.prevent="toggleSection(false)">Registrarte</a>
        </div>
        <div class="image">
          <img src="./cartera.jpeg" alt="Imagen">
        </div>
      </div>

      <div class="container registro-init" :class="{ 'visible': !isLoginVisible }" id="registroSection">
        <div class="logo">
          <div class="logo-circle">$</div>
          <div class="logo-text">Finanzas <span>Personales</span></div>
        </div>

        <div class="input-group">
          <label>Nombre de Usuario</label>
          <input v-model="nombreReg" type="text" placeholder="name" required
                 :class="{ 'valid': nombreReg.trim() !== '' }">
        </div>

        <div class="input-group">
          <label>Ingrese su Correo</label>
          <input v-model="emailReg" type="email" placeholder="Tu@email.com" required
                 :class="{ 'error': emailReg && !isEmailValid, 'valid': emailReg && isEmailValid }">
          <div v-if="emailReg && !isEmailValid" class="error-message">⚠️ Correo inválido</div>
        </div>

        <div class="input-group">
          <label>Crear contraseña</label>
          <input v-model="passwordReg" type="password" placeholder="••••••••" required
                 :class="{ 'error': passwordReg && !isPasswordValid, 'valid': passwordReg && isPasswordValid }">
          
          <div class="password-requirements">
            <div class="requirement" :class="{ 'valid': hasMinLength, 'invalid': passwordReg && !hasMinLength }">
              <span class="requirement-icon">{{ hasMinLength ? '✓' : '○' }}</span>
              <span>Mínimo 10 caracteres</span>
            </div>
            <div class="requirement" :class="{ 'valid': hasLetter, 'invalid': passwordReg && !hasLetter }">
              <span class="requirement-icon">{{ hasLetter ? '✓' : '○' }}</span>
              <span>Al menos una letra</span>
            </div>
            <div class="requirement" :class="{ 'valid': hasNumber, 'invalid': passwordReg && !hasNumber }">
              <span class="requirement-icon">{{ hasNumber ? '✓' : '○' }}</span>
              <span>Al menos un número</span>
            </div>
          </div>
        </div>

        <div class="input-group">
          <label>Confirmar contraseña</label>
          <input v-model="confirmReg" type="password" placeholder="••••••••" required
                 :class="{ 'error': confirmReg && passwordReg !== confirmReg, 'valid': confirmReg && passwordReg === confirmReg && passwordReg }">
          <div v-if="confirmReg && passwordReg !== confirmReg" class="error-message">⚠️ No coinciden</div>
        </div>

        <button @click="manejarRegistro" :disabled="!isFormValid">Crear sesión</button>

        <div id="volverLogin" @click="toggleSection(true)">
          <span class="arrow">←</span>
          <span class="back-text">Back</span>
        </div>

        <div class="image">
          <img src="./cartera.jpeg" alt="Imagen">
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Estilos base y contenedores */
.auth-wrapper { 
    background: #f0f0f0; 
    display: flex; 
    justify-content: center; 
    align-items: flex-start; 
    padding-top: 60px; 
    min-height: 100vh; 
    width: 100%; 
}

.wrapper { 
    position: relative; 
    width: 30%; 
}

.container { 
    background: white; 
    padding: 25px; 
    border-radius: 12px; 
    box-shadow: 0 0 15px rgba(0,0,0,0.1); 
    position: absolute; 
    top: 0; 
    left: 0; 
    width: 100%; 
    transition: all 0.5s ease; 
    margin-bottom: 60px; 
    box-sizing: border-box;
}

/* Manejo de visibilidad y transiciones */
.hidden { 
    transform: translateY(-30px); 
    opacity: 0; 
    pointer-events: none; 
}

.registro-init { 
    opacity: 0; 
    pointer-events: none; 
    transform: translateY(30px); 
}

.visible { 
    opacity: 1 !important; 
    transform: translateY(0) !important; 
    pointer-events: auto !important; 
}

/* Logo y Tipografía */
.logo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.logo-circle { 
    width: 40px; 
    height: 40px; 
    background: #2ecc71; 
    border-radius: 50%; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    color: white; 
    font-size: 22px; 
    font-weight: bold; 
}
.logo-text { font-weight: bold; font-size: 20px; text-align: left; }
.logo-text span { display: block; font-weight: normal; font-size: 14px; }
h1 { font-size: 28px; margin-bottom: 20px; color: #333; }

/* Grupos de entrada e Inputs */
.input-group { margin-bottom: 15px; text-align: left; }
.input-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; }
.input-group input { 
    width: 100%; 
    padding: 12px; 
    border-radius: 8px; 
    border: 1px solid #ccc; 
    font-size: 14px; 
    box-sizing: border-box;
    transition: border-color 0.3s;
}

/* Estados de validación en Inputs */
.input-group input.error { border-color: #e74c3c; }
.input-group input.valid { border-color: #27ae60; }
.error-message { color: #e74c3c; font-size: 12px; margin-top: 5px; display: block; }
.success-message { color: #27ae60; font-size: 12px; margin-top: 5px; display: block; }

/* Requisitos de contraseña */
.password-requirements { 
    font-size: 12px; 
    margin-top: 8px; 
    padding: 10px; 
    background: #f8f9fa; 
    border-radius: 6px; 
}
.requirement { 
    margin: 4px 0; 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    color: #7f8c8d;
}
.requirement.valid { color: #27ae60; }
.requirement.invalid { color: #e74c3c; }
.requirement-icon { font-size: 14px; width: 18px; text-align: center; }

/* Botones */
button { 
    width: 100%; 
    background: #1f8f3a; 
    color: white; 
    border: none; 
    padding: 12px; 
    border-radius: 8px; 
    font-size: 16px; 
    cursor: pointer; 
    margin-top: 10px; 
    transition: all 0.3s; 
}
button:hover:not(:disabled) { 
    background: #18742e; 
    box-shadow: 0 4px 10px rgba(0,0,0,0.2); 
    transform: translateY(-2px); 
}
button:disabled { 
    background: #cccccc; 
    cursor: not-allowed; 
}

/* Enlaces y navegación */
.register { text-align: left; margin-top: 10px; font-size: 14px; }
.register a { color: #1f8f3a; text-decoration: none; font-weight: bold; }

#volverLogin { 
    padding-top: 10px; 
    color: #1f8f3a; 
    text-decoration: none; 
    font-weight: bold; 
    display: flex; 
    flex-direction: column; 
    cursor: pointer; 
    align-items: flex-start; 
    margin-bottom: 10px;
}
.arrow { font-size: 24px; }
.back-text { font-size: 14px; margin-top: 2px; }

/* Imágenes */
.image { margin-top: 20px; text-align: center; }
.image img { width: 100%; border-radius: 8px; display: block; }
</style>
<style scoped>
.aviso-error {
  color: #e74c3c;
  font-size: 0.85rem;
  margin: 0.25rem 0 0.75rem;
  text-align: center;
}
</style>
