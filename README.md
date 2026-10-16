# 💰 FinUp — Finanzas Personales

Aplicación web para llevar tus finanzas personales: registra ingresos y gastos, define metas de ahorro y presupuestos, controla tus pagos recurrentes y consulta todo en gráficas. Incluye un **panel de administración** para gestionar usuarios. Cada cuenta, también la del administrador, ve **solo su propio dinero**.

![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22.13%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-integrado-003b57?logo=sqlite&logoColor=white)

---

## 📑 Contenido

- [Funcionalidades](#-funcionalidades)
- [Tecnologías](#-tecnologías)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Instalación y ejecución](#-instalación-y-ejecución)
- [Primer inicio de sesión](#-primer-inicio-de-sesión)
- [Base de datos](#-base-de-datos)
- [API](#-api)
- [Seguridad](#-seguridad)
- [Solución de problemas](#-solución-de-problemas)
- [Limitaciones conocidas](#-limitaciones-conocidas)

---

## ✨ Funcionalidades

### Para los usuarios

| Sección | Qué permite |
|---|---|
| **Página principal** | Resumen de ingresos, gastos y saldo, metas activas y pagos recurrentes con su progreso. |
| **Gastos e Ingresos** | Registrar, editar y eliminar movimientos por categoría, con gráfica semanal. |
| **Metas** | Crear metas de ahorro, **abonarles dinero** (o completarlas de un clic) y definir presupuestos por categoría. |
| **Reportes** | Sus estadísticas por periodo (7, 30, 90 o 365 días), gráfica, gasto por categoría y reportes guardados que se pueden desplegar y borrar. |
| **Pagos recurrentes** | Programar pagos (luz, arriendo, etc.) y registrar abonos hasta completarlos. |
| **Configuración** | Cambiar nombre, correo y contraseña, y elegir **tema claro u oscuro**. |

### Para el administrador

| Sección | Qué permite |
|---|---|
| **Inicio** | Total de usuarios y sus propios ingresos, gastos y ahorro, con la variación frente al mes anterior y gráfica de la última semana. |
| **Usuarios** | Buscar, crear, editar (incluida la contraseña) y eliminar usuarios. |
| **Finanzas** | Sus totales, evolución de los últimos 6 meses y sus transacciones recientes. |
| **Reportes** | Sus estadísticas por periodo (7, 30, 90 o 365 días), gasto por categoría y **reportes guardados** que se pueden desplegar y borrar. |
| **Metas** | Sus presupuestos por categoría frente a lo gastado en el mes, y sus metas de ahorro (crear, **abonar**, editar y eliminar). |

---

## 🛠 Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | [Vue 3](https://vuejs.org) · [Vue Router](https://router.vuejs.org) · [Vite](https://vite.dev) |
| Backend | [Node.js](https://nodejs.org) · [Express 5](https://expressjs.com) |
| Base de datos | SQLite mediante el módulo integrado `node:sqlite` (no hace falta instalar ningún servidor de base de datos) |
| Tipografía | [Poppins](https://fonts.google.com/specimen/Poppins) (Google Fonts) |

---

## 📁 Estructura del proyecto

```
finup/
├── iniciar.bat                      # Arranca todo con doble clic (Windows)
├── finanzas_app.sqlite.sql          # Esquema de la base de datos y datos iniciales
├── README.md
│
├── Parte_3_Backend_Servidor/
│   └── usuario/Nuevo Archivo WinRAR ZIP/
│       ├── package.json
│       └── bakend - copia/
│           └── server.js            # API REST (Express + SQLite)
│
├── Parte_4_Frontend_Vue/
│   └── usuario/Nuevo Archivo WinRAR ZIP/frontend/
│       ├── index.html
│       ├── package.json
│       └── src/
│           ├── main.js              # Punto de entrada
│           ├── app.vue              # Estilos globales, paleta y tema oscuro
│           ├── api.js               # Conexión con el backend (añade el token de sesión)
│           ├── tema.js              # Tema claro / oscuro
│           ├── categorias.js        # Categorías compartidas por los formularios
│           ├── router/index.js      # Rutas y protección por rol
│           ├── login.vue, inicio.vue, gastos_ingresos.vue, metas.vue, reportes.vue, configuracion.vue
│           └── A_inicio.vue, A_usuarios.vue, A_finanzas.vue, A_Reportes.vue, A_metas.vue   # Panel de administración
│
├── Parte_1_Interfaz_Usuario/        # Versión antigua en HTML (ver Limitaciones)
└── Parte_2_Panel_Administrador/     # Versión antigua en HTML (ver Limitaciones)
```

---

## 🚀 Instalación y ejecución

### Requisitos

- **[Node.js](https://nodejs.org) 22.13 o superior** (recomendado: la versión LTS más reciente). Incluye `npm` y el módulo `node:sqlite`.
- Conexión a internet la primera vez, para instalar las dependencias.

### Opción 1 — Windows, con un clic

1. Descarga o clona el repositorio:
   ```bash
   git clone https://github.com/cordobapalacionc-dotcom/finup.git
   ```
2. Haz doble clic en **`iniciar.bat`**.

El script instala las dependencias si faltan, abre dos ventanas (backend y frontend) y abre el navegador en **http://localhost:5180**. Para detener la aplicación, cierra esas dos ventanas.

### Opción 2 — Manual (cualquier sistema)

Abre **dos terminales**.

**Terminal 1 — Backend** (http://localhost:3000):

```bash
cd "Parte_3_Backend_Servidor/usuario/Nuevo Archivo WinRAR ZIP"
npm install
npm start
```

**Terminal 2 — Frontend** (http://localhost:5180):

```bash
cd "Parte_4_Frontend_Vue/usuario/Nuevo Archivo WinRAR ZIP/frontend"
npm install
npm run dev -- --port 5180
```

Después abre http://localhost:5180 en el navegador.

### Variables de entorno (opcionales)

El backend funciona sin configurar nada. Si lo necesitas, acepta:

| Variable | Valor por defecto | Para qué sirve |
|---|---|---|
| `PORT` | `3000` | Puerto del backend. |
| `DB_PATH` | `finanzas_app.db` (junto a `package.json`) | Ruta del archivo de la base de datos. |

> Si cambias el puerto del backend, actualiza también `API_URL` en `frontend/src/api.js`.

---

## 🔑 Primer inicio de sesión

La primera vez que arranca, el backend crea la base de datos con un único administrador:

| Correo | Contraseña |
|---|---|
| `admin@finanzas.com` | `Admin123` |

> ⚠️ **Cambia esta contraseña** desde *Configuración → Seguridad* nada más entrar. Es pública porque aparece en este repositorio.

Los usuarios normales se registran desde la pantalla de inicio de sesión, o los crea el administrador en *Usuarios*.

---

## 🗄 Base de datos

La base es un archivo SQLite (`finanzas_app.db`) que el backend crea automáticamente a partir de [`finanzas_app.sqlite.sql`](finanzas_app.sqlite.sql). Ese archivo **no se sube al repositorio**, porque contiene los datos reales de los usuarios.

| Tabla | Contenido |
|---|---|
| `usuarios` | Cuentas, rol (`admin` / `usuario`) y estado de conexión. |
| `sesiones` | Tokens de sesión (guardados como hash) y su caducidad. |
| `categorias` | Categorías de ingreso y de gasto. |
| `transacciones` | Ingresos y gastos de cada usuario. |
| `historial_cambios` | Registro automático (triggers) de cada movimiento editado o eliminado. |
| `metas` | Metas de ahorro: objetivo, ahorro actual y fecha límite. |
| `presupuestos` | Límites de gasto por categoría (mensuales o semanales). |
| `transacciones_recurrentes` | Pagos periódicos y lo abonado. |
| `reportes` | Reportes guardados por el administrador, con una foto de los datos en JSON. |

**Categorías incluidas**

- **Ingresos:** Sueldo, Freelance, Otros ingresos
- **Gastos:** Alimentación, Transporte, Entretenimiento, Servicios, Salud, Educación, Otros gastos

Para **empezar de cero**, detén el backend, borra `finanzas_app.db` y vuelve a arrancarlo. ⚠️ Se pierden todos los datos.

---

## 🔌 API

Base: `http://localhost:3000/api`. Todas las rutas, excepto `login` y `registrar`, requieren la cabecera:

```
Authorization: Bearer <token>
```

El token se obtiene al iniciar sesión. El frontend lo añade solo a cada petición.

<details>
<summary><b>Autenticación y cuenta</b></summary>

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/login` | Inicia sesión. Devuelve los datos del usuario y su `token`. |
| `POST` | `/registrar` | Crea una cuenta de usuario. |
| `POST` | `/logout` | Cierra la sesión e invalida el token. |
| `PUT` | `/usuario/actualizar/:id` | Cambia nombre, correo y contraseña (pide la contraseña actual). |
| `GET` | `/categorias` | Lista de categorías. |

</details>

<details>
<summary><b>Usuario: movimientos, metas, presupuestos y recurrentes</b></summary>

Cada usuario solo puede leer y modificar **sus propios** datos.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/resumen/:usuario_id` | Totales de ingresos y gastos. |
| `GET` | `/movimientos/:usuario_id` | Lista de movimientos. |
| `POST` | `/movimientos` | Crea un movimiento. |
| `PUT` | `/movimientos/:id` | Edita un movimiento. |
| `DELETE` | `/movimientos/:id` | Elimina un movimiento. |
| `GET` | `/metas/:usuario_id` | Lista de metas. |
| `POST` | `/metas` | Crea una meta, o la edita si se envía `id`. |
| `POST` | `/metas/:id/abonar` | Suma dinero (`monto`) al ahorro de una meta propia. También lo usa el administrador. |
| `DELETE` | `/metas/:id` | Elimina una meta. |
| `GET` | `/presupuestos/:usuario_id` | Lista de presupuestos. |
| `POST` | `/presupuestos` | Crea un presupuesto, o lo edita si se envía `id`. |
| `DELETE` | `/presupuestos/:id` | Elimina un presupuesto. |
| `GET` | `/recurrentes/:usuario_id` | Lista de pagos recurrentes. |
| `POST` | `/recurrentes` | Crea un pago recurrente. |
| `PUT` | `/recurrentes/:id` | Edita un pago recurrente. |
| `DELETE` | `/recurrentes/:id` | Elimina un pago recurrente. |
| `POST` | `/recurrentes/pagar` | Registra un abono (crea también el gasto). |

</details>

<details>
<summary><b>Reportes</b> (cualquier usuario, con sus propios datos)</summary>

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/reportes/resumen` | Totales propios. Acepta `?dias=N`. |
| `GET` | `/reportes/serie` | Ingresos y gastos propios agrupados (mismos parámetros que `/admin/serie`). |
| `GET` | `/reportes/gastos-categoria` | Gasto propio por categoría. Acepta `?dias=N`. |
| `GET` | `/reportes/guardados` | Reportes guardados propios. |
| `POST` | `/reportes/guardados` | Guarda un reporte con sus datos. |
| `DELETE` | `/reportes/guardados/:id` | Elimina un reporte propio. |
| `DELETE` | `/reportes/guardados` | Elimina todos los reportes propios. |

</details>

<details>
<summary><b>Administrador</b> (solo rol <code>admin</code>)</summary>

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/resumen` | Número de usuarios y totales propios con variación mensual. Acepta `?dias=N`. |
| `GET` | `/admin/serie` | Ingresos y gastos propios agrupados: `?dias=7`, `?dias=30&agrupar=semana` o `?meses=6`. |
| `GET` | `/admin/gastos-categoria` | Gasto propio por categoría. Acepta `?dias=N`. |
| `GET` | `/admin/transacciones` | Últimas transacciones propias. Acepta `?limite=N`. |
| `GET` | `/admin/usuarios` | Lista de usuarios. |
| `POST` | `/admin/usuarios` | Crea un usuario. |
| `PUT` | `/admin/usuarios/:id` | Edita un usuario (rol y contraseña incluidos). |
| `DELETE` | `/admin/usuarios/:id` | Elimina un usuario y todos sus datos. |
| `GET` | `/admin/metas` | Metas propias. |
| `POST` | `/admin/metas` | Crea una meta propia. |
| `PUT` | `/admin/metas/:id` | Edita una meta. |
| `DELETE` | `/admin/metas/:id` | Elimina una meta. |
| `GET` | `/admin/presupuestos` | Presupuestos propios por categoría y gastado en el mes. Acepta `?mes=AAAA-MM`. |
| `GET` | `/admin/reportes` | Reportes guardados propios. |
| `POST` | `/admin/reportes` | Guarda un reporte con sus datos. |
| `DELETE` | `/admin/reportes/:id` | Elimina un reporte propio. |
| `DELETE` | `/admin/reportes` | Elimina todos los reportes propios. |

</details>

---

## 🔒 Seguridad

- **Sesiones con token:** se generan al iniciar sesión, caducan a los 7 días y se invalidan al cerrar sesión. En la base solo se guarda su hash.
- **Aislamiento de datos:** el servidor comprueba en cada petición quién es el usuario. Nadie, ni siquiera el administrador, puede ver el dinero, las metas o los presupuestos de otra persona. El administrador solo gestiona las cuentas (crear, editar y eliminar usuarios).
- **Control de rol en el servidor:** las rutas `/api/admin` rechazan a cualquier usuario que no sea administrador, aunque modifique su navegador.
- **Contraseñas con `scrypt` y sal.** Las contraseñas antiguas en SHA-256 se actualizan solas al iniciar sesión.
- **Protección del administrador:** no puede eliminar su propia cuenta ni quitarse el rol.

---

## 🧯 Solución de problemas

| Problema | Solución |
|---|---|
| La página carga pero no muestra datos | El backend no está en marcha. Abre `iniciar.bat` o ejecuta `npm start` en la carpeta del backend. |
| `Error: listen EADDRINUSE :::3000` | Otro programa usa el puerto 3000. Ciérralo o arranca con otro `PORT`. |
| El frontend no abre en el puerto 5180 | Otro programa lo está usando. Ciérralo o cambia el puerto en `iniciar.bat`. |
| `No such built-in module: node:sqlite` | Tu versión de Node.js es antigua. Instala la 22.13 o superior. |
| Me devuelve al inicio de sesión | Tu sesión caducó (7 días) o se cerró. Vuelve a entrar. |
| Olvidé la contraseña del administrador | Detén el backend y borra `finanzas_app.db`: se recrea con `admin@finanzas.com` / `Admin123`. ⚠️ Se pierden todos los datos. |

---

## ⚠️ Limitaciones conocidas

- **`Parte_1_Interfaz_Usuario` y `Parte_2_Panel_Administrador`** son la versión antigua en HTML. No envían el token de sesión, así que **no funcionan con el backend actual**. La versión en uso es la de Vue.
- **El tema oscuro** se consigue invirtiendo los colores de la página, así que algunos emojis y detalles cambian ligeramente de tono.
- **La aplicación no muestra mensajes emergentes:** si algo falla (por ejemplo, un dato inválido), simplemente no se guarda. Solo el inicio de sesión muestra un aviso si los datos son incorrectos.
- **Está pensada para uso local** (`localhost`). Para publicarla en internet faltaría configurar HTTPS y la dirección del backend.
