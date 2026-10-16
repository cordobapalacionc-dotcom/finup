
const API_URL = 'http://localhost:3000/api';
let usuario = JSON.parse(localStorage.getItem('usuario_identificado'));
let metas = [];
let presupuestos = [];
let editandoId = null; // Para saber si estamos editando o creando

// --- INICIALIZACIÓN ---
if (!usuario) {
    window.location.href = '/';
} else {
    document.getElementById('userName').innerText = usuario.nombre;
    document.getElementById('userRole').innerText = usuario.rol;
    cargarDatos();
}

// --- PETICIONES API ---
async function cargarDatos() {
    try {
        const [resMetas, resPre] = await Promise.all([
            fetch(`${API_URL}/metas/${usuario.id}`),
            fetch(`${API_URL}/presupuestos/${usuario.id}`)
        ]);

        metas = await resMetas.json();
        presupuestos = await resPre.json();

        renderMetas();
        renderPresupuestos();
        actualizarResumen();
    } catch (e) {
        console.error("Error cargando datos", e);
    }
}

// --- RENDERIZADO DE METAS ---
function renderMetas() {
    const container = document.getElementById('metasContainer');
    if (metas.length === 0) {
        container.innerHTML = '<div class="no-data">No tienes metas creadas.</div>';
        return;
    }

    container.innerHTML = metas.map((meta, index) => {
        const ahorro = parseFloat(meta.monto_actual) || 0;
        const monto = parseFloat(meta.monto_objetivo) || 0;
        const porc = monto > 0 ? Math.min(Math.round((ahorro / monto) * 100), 100) : 0;
        const color = porc >= 100 ? 'verde' : (porc >= 50 ? 'naranja' : 'rojo');
        const falta = monto - ahorro;
        const ahorroMensualNecesario = Math.ceil(falta / 6);
        const ahorroActualUsuario = usuario.ahorroMensual || 120000;

        return `
            <div class="goal-card-container">
                <div class="goal-card">
                    <div class="goal-info">
                        <h3>✨ ${meta.nombre}</h3>
                        <p>Meta personal</p>
                    </div>
                    <div class="goal-progress-container">
                        <div class="progress-wrapper">
                            <div class="progress-bar-bg">
                                <div class="progress-fill ${color}" style="width: ${porc}%"></div>
                            </div>
                            <span class="percentage-text">${porc}%</span>
                        </div>
                    </div>
                    <div class="goal-money"><b>$${ahorro.toLocaleString()}</b> / $${monto.toLocaleString()}</div>
                    <div class="status-badge ${porc >= 100 ? 'completed' : ''}">
                        ${porc >= 100 ? '¡Logrado!' : 'En progreso'}
                    </div>
                    <div class="actions">
                        <button onclick="abrirModalMeta(${index})" class="btn-mini">✏️</button>
                        <button onclick="eliminarMeta(${meta.id})" class="btn-icon-delete">🗑️</button>
                    </div>
                </div>
                ${porc < 100 ? `
                <div style="padding-left: 20px; color: #5778a4;" class="goal-analysis">
                    <p>💡 <b>Análisis a 6 meses:</b> Te faltan $${falta.toLocaleString()}. 
                    Necesitas ahorrar <b>$${ahorroMensualNecesario.toLocaleString()}</b> al mes.
                    <br>
                    <span class="${ahorroMensualNecesario > ahorroActualUsuario ? 'rojo-text' : 'verde-text'}">
                        ${ahorroMensualNecesario > ahorroActualUsuario 
                            ? `⚠️ Te faltan $${(ahorroMensualNecesario - ahorroActualUsuario).toLocaleString()} adicionales al mes.` 
                            : '✅ Tu ahorro actual es suficiente.'}
                    </span></p>
                </div>` : ''}
            </div>
        `;
    }).join('');
}

// --- RENDERIZADO DE PRESUPUESTOS ---
function renderPresupuestos() {
    const container = document.getElementById('presupuestosContainer');
    container.innerHTML = presupuestos.map((pre, index) => {
        const gastado = parseFloat(pre.monto_actual) || 0;
        const limite = parseFloat(pre.monto_limite) || 0;
        const porc = Math.min((gastado / limite) * 100, 100);
        const color = gastado > limite ? 'rojo' : (gastado > limite * 0.8 ? 'naranja' : 'verde');

        return `
            <div class="card budget-card ${gastado > limite ? 'border-rojo' : ''}">
                <div class="budget-header">
                    <h3>💰 ${pre.categoria_nombre}</h3>
                    <div class="actions">
                        <button onclick="abrirModalPresupuesto(${index})" class="btn-mini">✏️</button>
                        <button onclick="eliminarPresupuesto(${pre.id})" class="btn-mini">🗑️</button>
                    </div>
                </div>
                <div class="budget-money-info">
                    <span class="gastado">$${gastado.toLocaleString()}</span>
                    <span class="total"> / $${limite.toLocaleString()}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-fill ${color}" style="width: ${porc}%"></div>
                </div>
                <p>${gastado > limite ? '❌ Límite superado' : (gastado > limite * 0.8 ? '⚠️ Casi al límite' : '✅ En control')}</p>
            </div>
        `;
    }).join('');
}

// --- RESUMEN ---
function actualizarResumen() {
    const totalAhorrado = metas.reduce((acc, m) => acc + (parseFloat(m.monto_actual) || 0), 0);
    const totalObjetivo = metas.reduce((acc, m) => acc + (parseFloat(m.monto_objetivo) || 0), 0);
    const porcGeneral = totalObjetivo > 0 ? Math.round((totalAhorrado / totalObjetivo) * 100) : 0;

    document.getElementById('countMetas').innerText = metas.length;
    document.getElementById('totalAhorrado').innerText = `$${totalAhorrado.toLocaleString()}`;
    document.getElementById('progressGeneralBar').style.width = porcGeneral + '%';
    document.getElementById('progressGeneralText').innerText = porcGeneral + '%';
}

// --- LÓGICA DE MODALES ---
const modal = document.getElementById('modalOverlay');

window.abrirModalMeta = (index = null) => {
    editandoId = index !== null ? metas[index].id : null;
    document.getElementById('modalTitle').innerText = editandoId ? '✏️ Editar Meta' : '🎯 Nueva Meta';
    document.getElementById('metaInputs').classList.remove('hidden');
    document.getElementById('presupuestoInputs').classList.add('hidden');
    document.getElementById('editAhorroContainer').classList.toggle('hidden', index === null);
    
    if (index !== null) {
        document.getElementById('metaNombre').value = metas[index].nombre;
        document.getElementById('metaMonto').value = metas[index].monto_objetivo;
        document.getElementById('metaAhorro').value = metas[index].monto_actual;
    } else {
        document.getElementById('modalForm').reset();
    }
    modal.classList.remove('hidden');
};

document.getElementById('modalForm').onsubmit = async (e) => {
    e.preventDefault();
    const esMeta = !document.getElementById('metaInputs').classList.contains('hidden');
    
    let payload = {};
    let endpoint = esMeta ? '/metas' : '/presupuestos';

    if (esMeta) {
        payload = {
            id: editandoId,
            usuario_id: usuario.id,
            nombre: document.getElementById('metaNombre').value,
            monto_objetivo: Number(document.getElementById('metaMonto').value),
            monto_actual: Number(document.getElementById('metaAhorro').value || 0),
            fecha_limite: new Date().toISOString().split('T')[0]
        };
    } else {
        payload = {
            id: editandoId,
            usuario_id: usuario.id,
            categoria_id: parseInt(document.getElementById('preCategoria').value),
            monto_limite: Number(document.getElementById('preLimite').value),
            monto_actual: Number(document.getElementById('preGastado').value),
            periodo: 'mensual'
        };
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        cerrarModal();
        cargarDatos();
    }
};

function cerrarModal() {
    modal.classList.add('hidden');
}

document.getElementById('btnCerrarModal').onclick = cerrarModal;
document.getElementById('btnNuevaMeta').onclick = () => abrirModalMeta();

// --- ELIMINACIÓN ---
async function eliminarMeta(id) {
    if (confirm("¿Eliminar meta?")) {
        await fetch(`${API_URL}/metas/${id}`, { method: 'DELETE' });
        cargarDatos();
    }
}

// --- LOGOUT ---
document.getElementById('btnLogout').onclick = () => {
    localStorage.removeItem('usuario_identificado');
    window.location.href = '/';
};
