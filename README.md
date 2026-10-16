# FinUp — Finanzas Personales

Aplicación web para registrar ingresos, gastos, metas de ahorro, presupuestos y pagos recurrentes, con un panel de administración.

- **Frontend:** Vue 3 + Vite (`Parte_4_Frontend_Vue/usuario/Nuevo Archivo WinRAR ZIP/frontend`)
- **Backend:** Node.js + Express (`Parte_3_Backend_Servidor/usuario/Nuevo Archivo WinRAR ZIP`)
- **Base de datos:** SQLite, incluida en Node.js 22 o superior (no hace falta instalar MySQL)

## Requisitos

- [Node.js](https://nodejs.org) 22.12 o superior

## Cómo ejecutarlo

**En Windows:** doble clic en `iniciar.bat`. Instala las dependencias si faltan, arranca el backend y el frontend, y abre el navegador en http://localhost:5180.

**A mano:**

```bash
# Backend (http://localhost:3000)
cd "Parte_3_Backend_Servidor/usuario/Nuevo Archivo WinRAR ZIP"
npm install
npm start

# Frontend (en otra terminal)
cd "Parte_4_Frontend_Vue/usuario/Nuevo Archivo WinRAR ZIP/frontend"
npm install
npm run dev -- --port 5180
```

La primera vez que arranca, el backend crea la base `finanzas_app.db` a partir de `finanzas_app.sqlite.sql`, con las categorías y un usuario administrador:

| Correo | Contraseña |
|---|---|
| `admin@finanzas.com` | `Admin123` |

**Cambia esa contraseña** desde Configuración después del primer inicio de sesión.

## Seguridad

- Sesiones con token (caducan a los 7 días); el servidor comprueba el token en cada petición.
- Cada usuario solo puede ver y modificar sus propios datos; las rutas `/api/admin` son solo para administradores.
- Contraseñas guardadas con `scrypt` y sal.

## Notas

- `Parte_1_Interfaz_Usuario` y `Parte_2_Panel_Administrador` son la versión antigua en HTML. No envían el token de sesión, así que **no funcionan con el backend actual**; la versión en uso es la de Vue.
