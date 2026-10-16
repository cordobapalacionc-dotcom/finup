const API_URL = 'http://localhost:3000/api';

// --- ELEMENTOS DEL DOM ---
const loginSection    = document.getElementById('loginSection');
const registroSection = document.getElementById('registroSection');
const btnIngresar     = document.getElementById('btnIngresar');
const btnCrearSesion  = document.getElementById('btnCrearSesion');
const nombreReg       = document.getElementById('nombreReg');
const emailReg        = document.getElementById('emailReg');
const passwordReg     = document.getElementById('passwordReg');
const confirmReg      = document.getElementById('confirmReg');
const errorLogin      = document.getElementById('errorLogin');
const errorRegistro   = document.getElementById('errorRegistro');
const linkRegistro    = document.getElementById('linkRegistro');
const volverLogin     = document.getElementById('volverLogin');

// Verificar que todos los elementos existen
if (!loginSection || !registroSection) {
    console.error('Error: No se encontraron las secciones de login/registro');
}

// --- NAVEGACIÓN ENTRE SECCIONES ---
if (linkRegistro) {
    linkRegistro.addEventListener('click', () => {
        loginSection.classList.add('hidden');
        registroSection.classList.remove('hidden');
        if (errorRegistro) errorRegistro.style.display = 'none';
    });
}

if (volverLogin) {
    volverLogin.addEventListener('click', () => {
        registroSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        if (errorRegistro) errorRegistro.style.display = 'none';
    });
}

// --- LOGIN ---
if (btnIngresar) {
    btnIngresar.addEventListener('click', async () => {
        const correo     = document.getElementById('emailLogin').value.trim();
        const contraseña = document.getElementById('passwordLogin').value;

        if (errorLogin) errorLogin.style.display = 'none';

        if (!correo || !contraseña) {
            mostrarError(errorLogin, 'Ingresa tu correo y contraseña');
            return;
        }

        btnIngresar.disabled = true;
        btnIngresar.textContent = 'Ingresando...';

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, contraseña })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('usuario_identificado', JSON.stringify(data.usuario));

                if (data.usuario.rol === 'admin') {
                    window.location.href = '../administrador/principal.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                mostrarError(errorLogin, data.error || 'Credenciales incorrectas');
            }
        } catch (error) {
            console.error('Error de conexión:', error);
            mostrarError(errorLogin, 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
        } finally {
            btnIngresar.disabled = false;
            btnIngresar.textContent = 'Ingresar';
        }
    });

    // Permitir login con Enter
    const passwordLogin = document.getElementById('passwordLogin');
    if (passwordLogin) {
        passwordLogin.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnIngresar.click();
        });
    }
}

// --- VALIDACIONES DE REGISTRO EN TIEMPO REAL ---
function validarRegistro() {
    if (!nombreReg || !emailReg || !passwordReg || !confirmReg) return;

    const nombre    = nombreReg.value.trim();
    const email     = emailReg.value.trim();
    const pass      = passwordReg.value;
    const confirm   = confirmReg.value;

    // Validar email
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const emailError = document.getElementById('emailError');
    if (emailError) {
        emailError.textContent = (email && !emailValido) ? 'Correo inválido' : '';
    }

    // Validar contraseña
    const tieneMinimo = pass.length >= 10;
    const tieneLetter = /[a-zA-Z]/.test(pass);
    const tieneNumber = /[0-9]/.test(pass);

    actualizarRequisito('reqMin', tieneMinimo, pass.length > 0);
    actualizarRequisito('reqLetter', tieneLetter, pass.length > 0);
    actualizarRequisito('reqNumber', tieneNumber, pass.length > 0);

    const passValida = tieneMinimo && tieneLetter && tieneNumber;

    // Validar confirmación
    const coinciden = pass === confirm && confirm !== '';
    const confirmError = document.getElementById('confirmError');
    if (confirmError) {
        confirmError.textContent = (confirm && !coinciden) ? 'Las contraseñas no coinciden' : '';
    }

    // Habilitar botón solo si todo está bien
    if (btnCrearSesion) {
        btnCrearSesion.disabled = !(nombre && emailValido && passValida && coinciden);
    }
}

function actualizarRequisito(id, cumple, activo) {
    const el = document.getElementById(id);
    if (!el) return;
    const textoOriginal = el.textContent;
    const textoLimpio = textoOriginal.slice(2);
    el.className = 'requirement' + (activo ? (cumple ? ' valid' : ' invalid') : '');
    el.textContent = (cumple ? '✓ ' : '○ ') + textoLimpio;
}

if (nombreReg) nombreReg.addEventListener('input', validarRegistro);
if (emailReg) emailReg.addEventListener('input', validarRegistro);
if (passwordReg) passwordReg.addEventListener('input', validarRegistro);
if (confirmReg) confirmReg.addEventListener('input', validarRegistro);

// --- REGISTRO ---
if (btnCrearSesion) {
    btnCrearSesion.addEventListener('click', async () => {
        if (errorRegistro) errorRegistro.style.display = 'none';
        btnCrearSesion.disabled = true;
        btnCrearSesion.textContent = 'Creando cuenta...';

        try {
            const res = await fetch(`${API_URL}/registrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre:     nombreReg.value.trim(),
                    correo:     emailReg.value.trim(),
                    contraseña: passwordReg.value
                })
            });

            const data = await res.json();

            if (res.ok) {
                // Volver al login con mensaje de éxito
                registroSection.classList.add('hidden');
                loginSection.classList.remove('hidden');
                mostrarError(errorLogin, '✅ Cuenta creada. Ya puedes iniciar sesión.', true);
                // Limpiar campos
                if (nombreReg) nombreReg.value = '';
                if (emailReg) emailReg.value = '';
                if (passwordReg) passwordReg.value = '';
                if (confirmReg) confirmReg.value = '';
                validarRegistro();
            } else {
                mostrarError(errorRegistro, data.error || 'Error al crear la cuenta');
            }
        } catch (error) {
            console.error('Error de registro:', error);
            mostrarError(errorRegistro, 'No se pudo conectar con el servidor.');
        } finally {
            btnCrearSesion.disabled = false;
            btnCrearSesion.textContent = 'Crear cuenta';
        }
    });
}

// --- HELPERS ---
function mostrarError(elemento, mensaje, esExito = false) {
    if (!elemento) return;
    elemento.textContent = mensaje;
    elemento.style.display = 'block';
    elemento.style.color = esExito ? '#2dbb73' : '#e74c3c';
    setTimeout(() => {
        if (elemento) elemento.style.display = 'none';
    }, 5000);
}