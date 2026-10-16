
document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos
    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    const inputNombre = document.getElementById('perfil-nombre');
    const inputCorreo = document.getElementById('perfil-correo');
    const displayNombre = document.getElementById('display-nombre');
    const inputPassActual = document.getElementById('pass-actual');
    const inputPassNueva = document.getElementById('pass-nueva');
    const errorPass = document.getElementById('error-pass');

    // 1. Cargar Datos Iniciales
    const sesion = JSON.parse(localStorage.getItem('usuario_identificado'));
    if (sesion) {
        inputNombre.value = sesion.nombre;
        inputCorreo.value = sesion.correo;
        displayNombre.textContent = sesion.nombre;
    }

    // 2. Modo Oscuro
    if (localStorage.getItem('tema') === 'oscuro') {
        document.body.classList.add('dark-mode');
        toggleDarkMode.checked = true;
        document.getElementById('tema-icon').textContent = '🌙';
    }

    toggleDarkMode.addEventListener('change', () => {
        if (toggleDarkMode.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('tema', 'oscuro');
            document.getElementById('tema-icon').textContent = '🌙';
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('tema', 'claro');
            document.getElementById('tema-icon').textContent = '☀️';
        }
    });

    // 3. Validación de Contraseña
    inputPassNueva.addEventListener('input', () => {
        const val = inputPassNueva.value;
        const valida = val.length >= 8 && /\d/.test(val) && /[a-zA-Z]/.test(val);
        errorPass.style.display = (val && !valida) ? 'block' : 'none';
    });

    // 4. Guardar Cambios (Fetch API)
    const guardarCambios = async () => {
        const userId = sesion ? sesion.id : null;
        
        if (!inputNombre.value || !inputCorreo.value) {
            alert("Campos obligatorios vacíos");
            return;
        }

        const bodyData = {
            nombre: inputNombre.value,
            correo: inputCorreo.value,
            contraseña_actual: inputPassActual.value,
            contraseña_nueva: inputPassNueva.value
        };

        try {
            const res = await fetch(`http://localhost:3000/api/usuario/actualizar/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('usuario_identificado', JSON.stringify({...sesion, nombre: bodyData.nombre, correo: bodyData.correo}));
                displayNombre.textContent = bodyData.nombre;
                alert("¡Éxito!");
                inputPassActual.value = '';
                inputPassNueva.value = '';
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert("Error de conexión");
        }
    };

    document.getElementById('btn-guardar-perfil').addEventListener('click', guardarCambios);
    document.getElementById('btn-actualizar-pass').addEventListener('click', guardarCambios);

    // 5. Cerrar Sesión
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('usuario_identificado');
        window.location.href = 'index.html'; // O tu ruta de login
    });
});
