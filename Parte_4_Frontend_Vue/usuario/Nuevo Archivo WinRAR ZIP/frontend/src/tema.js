// Tema claro / oscuro de toda la aplicación.
// Se guarda en el navegador y se aplica con la clase "tema-oscuro" en <html> (estilos en app.vue).
import { ref, watch } from 'vue'

const leerTema = () => {
  try {
    return localStorage.getItem('tema') === 'oscuro' ? 'oscuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export const tema = ref(leerTema())

const aplicar = (valor) => {
  document.documentElement.classList.toggle('tema-oscuro', valor === 'oscuro')
  try {
    localStorage.setItem('tema', valor)
  } catch {
    // sin almacenamiento: el tema dura hasta recargar
  }
}

aplicar(tema.value)
watch(tema, aplicar)
