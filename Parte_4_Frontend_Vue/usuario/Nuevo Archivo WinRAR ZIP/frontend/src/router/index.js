import { createRouter, createWebHistory } from 'vue-router'

// Importaciones de archivos (Asegúrate que las rutas relativas sean correctas)
import Login from '../login.vue' 
import Inicio from '../inicio.vue' 
import Gastos from '../gastos_ingresos.vue'
import Configuracion from '../configuracion.vue'
import Metas from '../metas.vue'
import Reportes from '../reportes.vue'

// Vistas de Administrador
import A_Inicio from '../A_inicio.vue'
import A_Usuarios from '../A_usuarios.vue' 
import A_Reportes from '../A_Reportes.vue'
import A_metas from '../A_metas.vue'
import A_finanzas from '../A_finanzas.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: Login
    },
    // RUTA DE INICIO DE USUARIO NORMAL
    {
      path: '/inicio',
      name: 'inicio',
      component: Inicio,
      meta: { requiresAuth: true, role: 'usuario' }
    },
    // RUTA DE INICIO DE ADMINISTRADOR
    {
      path: '/admin-inicio',
      name: 'admin-inicio',
      component: A_Inicio,
      meta: { requiresAuth: true, role: 'admin' }
    },
    { 
      path: '/gastos',
      name: 'gastos', 
      component: Gastos,
      meta: { requiresAuth: true }
    },
    {
      path: '/configuracion',
      name: 'configuracion',
      component: Configuracion,
      meta: { requiresAuth: true }
    },
    {
      path: '/metas',
      name: 'metas',
      component: Metas,
      meta: { requiresAuth: true }
    },
    {
      path: '/reportes',
      name: 'reportes',
      component: Reportes,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin-usuarios',
      name: 'admin-usuarios',
      component: A_Usuarios,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/admin-reportes',
      name: 'admin-reportes',
      component: A_Reportes,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/admin-metas',
      name: 'admin-metas',
      component: A_metas,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/admin-finanzas',
      name: 'admin-finanzas',
      component: A_finanzas,
      meta: { requiresAuth: true, role: 'admin' }
    }
  ],
})

// --- GUARDIA DE NAVEGACIÓN (Protección de rutas) ---
router.beforeEach((to, from, next) => {
  const usuarioString = localStorage.getItem('usuario_identificado');
  const usuario = usuarioString ? JSON.parse(usuarioString) : null;

  // Si la ruta requiere autenticación y no hay usuario, al login
  if (to.meta.requiresAuth && !usuario) {
    next({ name: 'login' });
  } 
  // Si la ruta es solo para admin y el usuario no es admin
  else if (to.meta.role === 'admin' && usuario?.rol !== 'admin') {
    next({ name: 'inicio' }); // Redirigir al inicio normal si intenta colarse
  }
  // Si la ruta es solo para usuario y el usuario es admin
  else if (to.meta.role === 'usuario' && usuario?.rol === 'admin') {
    next({ name: 'admin-inicio' }); // Redirigir al inicio de admin
  }
  else {
    next(); // Continuar normalmente
  }
});

export default router