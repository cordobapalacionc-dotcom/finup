
const API_URL = 'http://localhost:3000/api';
let usuario = { id: null, nombre: '', rol: '' };
let pagoSeleccionado = null;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    checkSesion();
    initDarkMode();
    
    // Listeners
    document.getElementById('dark-mode-checkbox').addEventListener('change', toggleModo);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
    document.getElementById('input-monto-pago').addEventListener('keydown', bloquearNegativos);
    document.getElementById('btn-confirmar-pago').addEventListener('click', confirmarPago);
});

// --- SESIÓN Y FETCH ---
function checkSesion() {
    const sesion = localStorage.getItem('usuario_identificado');
    if (!sesion) {
        window.location.href = '/'; // Redirigir si no hay sesión
        return;
    }
    const data = JSON.parse(sesion);
    usuario = data;
    actualizarUIUsuario();
    cargarDatos(data.id);
}

async function cargarDatos(userId) {
    try {
        const [resResumen, resMetas, resRecurrentes] = await Promise.all([
            fetch(`${API_URL}/resumen/${userId}`),
            fetch(`${API_URL}/metas/${userId}`),
            fetch(`${API_URL}/recurrentes/${userId}`)
        ]);

        if (resResumen.ok) renderResumen(await resResumen.json());
        if (resMetas.ok) renderMetas(await resMetas.json());
        if (resRecurrentes.ok) renderRecurrentes(await resRecurrentes.json());
    } catch (e) {
        console.error("Error cargando datos", e);
    }
}

// --- RENDERIZADO (MANIPULACIÓN DEL DOM) ---
function renderResumen(data) {
    const saldo = data.ingresos - data.gastos;
    const saldoEl = document.getElementById('saldo-total');
    saldoEl.innerText = `$${saldo.toLocaleString()}`;
    saldoEl.className = saldo >= 0 ? 'positive' : 'negative';
    
    document.getElementById('gastos-totales').innerText = `-$${data.gastos.toLocaleString()}`;
    document.getElementById('ingresos-totales').innerText = `+$${data.ingresos.toLocaleString()}`;
}

function renderMetas(metas) {
    const container = document.getElementById('goals-list');
    container.innerHTML = metas.length ? '' : '<p>No hay metas</p>';
    
    metas.forEach(g => {
        const porc = (g.monto_actual / g.monto_objetivo) * 100;
        container.innerHTML += `
            <div class="goal-item">
                <div class="goal-info">
                    <span>${g.nombre}</span>
                    <span>$${Number(g.monto_actual).toLocaleString()} / $${Number(g.monto_objetivo).toLocaleString()}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${porc}%; background: #2dbb73;"></div>
                </div>
            </div>`;
    });
}

function renderRecurrentes(recurrentes) {
    const container = document.getElementById('payments-list');
    container.innerHTML = '';
    
    recurrentes.forEach(p => {
        const estado = getEstadoPago(p);
        const porc = Math.min((p.pago / p.monto) * 100, 100);
        
        const card = document.createElement('div');
        card.className = 'payment-card';
        card.style.borderLeft = `5px solid ${estado.color}`;
        card.innerHTML = `
            <div style="flex:1; cursor:pointer" onclick="abrirModalPago(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                <b class="pay-title">${p.descripcion || p.nombre_categoria}</b>
                <span class="pay-date">Vence: ${new Date(p.fecha_inicio).toLocaleDateString()}</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${porc}%; background:${estado.color}"></div>
                </div>
            </div>
            <div class="pay-amount-zone" style="text-align:right">
                <div style="color:${estado.color}">$${Number(p.pago).toLocaleString()} / $${Number(p.monto).toLocaleString()}</div>
                <span class="pay-status-tag" style="background:${estado.color}; color:white; padding:2px 5px; font-size:10px; border-radius:4px">${estado.texto}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- LÓGICA DE NEGOCIO ---
function getEstadoPago(p) {
    const montoTotal = Number(p.monto);
    const pagoAcumulado = Number(p.pago);
    if (p.pagado === 1 || pagoAcumulado >= montoTotal) return { color: '#2dbb73', texto: 'COMPLETADO' };
    if (pagoAcumulado > 0) return { color: '#ecc94b', texto: 'EN ABONO' };
    
    const hoy = new Date();
    const vence = new Date(p.fecha_inicio);
    if (hoy > vence) return { color: '#e53e3e', texto: 'VENCIDO' };
    return { color: '#718096', texto: 'PENDIENTE' };
}

// --- MODALES ---
window.abrirModalPago = (p) => {
    if (p.pagado) return;
    pagoSeleccionado = p;
    document.getElementById('pago-desc-modal').innerText = p.descripcion;
    document.getElementById('pago-monto-total').innerText = `$${Number(p.monto).toLocaleString()}`;
    document.getElementById('pago-faltante').innerText = `$${(p.monto - p.pago).toLocaleString()}`;
    document.getElementById('modal-pago').classList.remove('hidden');
};

async function confirmarPago() {
    const monto = Number(document.getElementById('input-monto-pago').value);
    const faltante = pagoSeleccionado.monto - pagoSeleccionado.pago;

    if (monto <= 0 || monto > faltante) {
        alert("Monto inválido");
        return;
    }

    const res = await fetch(`${API_URL}/recurrentes/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            usuario_id: usuario.id,
            monto: monto,
            recurrente_id: pagoSeleccionado.id
        })
    });

    if (res.ok) {
        cerrarModal('modal-pago');
        cargarDatos(usuario.id);
    }
}

function cerrarModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// --- MODO OSCURO ---
function initDarkMode() {
    if (localStorage.getItem('tema') === 'oscuro') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-checkbox').checked = true;
        document.getElementById('mode-label').innerText = '🌙 Oscuro';
    }
}

function toggleModo() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('tema', isDark ? 'oscuro' : 'claro');
    document.getElementById('mode-label').innerText = isDark ? '🌙 Oscuro' : '☀️ Claro';
}

function bloquearNegativos(e) {
    if (['-', 'e', '+'].includes(e.key)) e.preventDefault();
}

function actualizarUIUsuario() {
    document.getElementById('welcome-title').innerText = `¡Bienvenido de nuevo, ${usuario.nombre}!`;
    document.getElementById('user-info').innerHTML = `<b>${usuario.nombre}</b><br>${usuario.rol}`;
}

function cerrarSesion() {
    localStorage.removeItem('usuario_identificado');
    window.location.href = '/';
}
