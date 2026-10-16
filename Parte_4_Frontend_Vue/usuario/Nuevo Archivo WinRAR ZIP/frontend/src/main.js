import './api' // añade el token de sesión a las peticiones al backend
import './tema' // aplica el tema claro/oscuro guardado antes de mostrar nada
import { createApp } from 'vue'
import App from './app.vue' // <--- Cambiado de App a app (minúscula)
import router from './router'

const app = createApp(App)

app.use(router)
app.mount('#app')