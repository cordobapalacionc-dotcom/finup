
// --- CONFIGURACIÓN Y ESTADO ---
let usuario = { id: 1, nombre: 'Steven', rol: 'Usuario' };
let registros = [];
let editandoId = null;
let tipoSeleccionado = 'gasto';
const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const nombresCategorias = {
    1: '💼 Sueldo', 2: '💰 Freelance', 3: '🛒 Alimentación', 4: '🚗 Transporte', 5: '🎬 Entretenimiento'
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    const sesion = localStorage.getItem('usuario_identificado');
    if (sesion) usuario = JSON.parse(sesion);
    
    document.getElementById('user-name').textContent = usuario.nombre;
    document.getElementById('user-role').textContent = usuario.rol;

    cargarDatos();
    setupEventListeners();
});

function setupEventListeners() {
    // Abrir/Cerrar Modal
    document.getElementById('btn-nuevo-registro').onclick = () => abrirModal();
    document.getElementById('btn-cerrar-modal').onclick = cerrarModal;
    document.getElementById('btn-cancelar').onclick = cerrarModal;
    
    // Selectores de tipo
    document.getElementById('selector-gasto').onclick = () => cambiarTipo('gasto');
    document.getElementById('selector-ingreso').onclick = () => cambiarTipo('ingreso');

    // Guardar
    document.getElementById('btn-guardar').onclick = guardarRegistro;

    // Escala del gráfico
    document.getElementById('escala-manual').onchange = renderizarTodo;

    // Logout
    document.getElementById('btn-logout').onclick = () => {
        localStorage.removeItem('usuario_identificado');
        window.location.href = '/';
    };

    // Bloquear negativos en el input
    document.getElementById('reg-monto').onkeydown = (e) => {
        if (['-', 'e', '+'].includes(e.key)) e.preventDefault();
    };
}

// --- LÓGICA DE DATOS ---
async function cargarDatos() {
    try {
        const res = await fetch(`http://localhost:3000/api/movimientos/${usuario.id}`);
        registros = await res.json();
        renderizarTodo();
    } catch (e) { console.error("Error API:", e); }
}

function renderizarTodo() {
    actualizarSaldos();
    renderizarTabla();
    renderizarGrafico();
}

function actualizarSaldos() {
    const ingresos = registros.filter(r => r.tipo === 'ingreso').reduce((acc, r) => acc + Number(r.monto), 0);
    const gastos = registros.filter(r => r.tipo === 'gasto').reduce((acc, r) => acc + Number(r.monto), 0);
    
    document.getElementById('total-ingresos').textContent = `+$${ingresos.toLocaleString()}`;
    document.getElementById('total-gastos').textContent = `-$${gastos.toLocaleString()}`;
    document.getElementById('total-saldo').textContent = `$${(ingresos - gastos).toLocaleString()}`;
}

function renderizarTabla() {
    const tbody = document.getElementById('tabla-registros');
    tbody.innerHTML = registros.map(item => `
        <tr>
            <td>${item.tipo === 'ingreso' ? '💼' : '💸'} ${item.nombre_ingreso || item.descripcion}</td>
            <td>${nombresCategorias[item.categoria_id] || 'Otras'}</td>
            <td class="${item.tipo === 'ingreso' ? 'positivo' : 'negativo'}">
                ${item.tipo === 'ingreso' ? '+' : '-'}$${Number(item.monto).toLocaleString()}
            </td>
            <td>
                <button onclick="editarRegistro(${item.id})">✏️</button>
                <button onclick="eliminarRegistro(${item.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function renderizarGrafico() {
    const container = document.getElementById('bars-container');
    const escala = Number(document.getElementById('escala-manual').value);
    
    // Procesar datos semanales
    const data = { ingresos: Array(7).fill(0), gastos: Array(7).fill(0) };
    registros.forEach(reg => {
        const fecha = new Date(reg.fecha || new Date());
        let idx = fecha.getDay() === 0 ? 6 : fecha.getDay() - 1;
        if (reg.tipo === 'ingreso') data.ingresos[idx] += Number(reg.monto);
        else data.gastos[idx] += Number(reg.monto);
    });

    const maxVal = escala > 0 ? escala : Math.max(...data.ingresos, ...data.gastos, 100);

    container.innerHTML = diasSemana.map((dia, i) => `
        <div class="bar-group">
            <div class="bar green" style="height: ${(data.ingresos[i]/maxVal)*100}%" 
                 onmousemove="showT(event, 'Ingresos: $${data.ingresos[i]}')" onmouseleave="hideT()"></div>
            <div class="bar red" style="height: ${(data.gastos[i]/maxVal)*100}%"
                 onmousemove="showT(event, 'Gastos: $${data.gastos[i]}')" onmouseleave="hideT()"></div>
            <span class="day-label">${dia}</span>
        </div>
    `).join('');
}

// --- MODAL Y CRUD ---
function cambiarTipo(tipo) {
    tipoSeleccionado = tipo;
    const btnGasto = document.getElementById('selector-gasto');
    const btnIngreso = document.getElementById('selector-ingreso');
    const selectCat = document.getElementById('reg-categoria');

    if (tipo === 'gasto') {
        btnGasto.classList.add('active-gasto');
        btnIngreso.classList.remove('active-ingreso');
        selectCat.innerHTML = `<option value="3">🛒 Alimentación</option><option value="4">🚗 Transporte</option><option value="5">🎬 Entretenimiento</option>`;
    } else {
        btnIngreso.classList.add('active-ingreso');
        btnGasto.classList.remove('active-gasto');
        selectCat.innerHTML = `<option value="1">💼 Sueldo</option><option value="2">💰 Freelance</option>`;
    }
}

async function guardarRegistro() {
    const monto = Number(document.getElementById('reg-monto').value);
    if (monto <= 0) return alert("Monto inválido");

    const payload = {
        tipo: tipoSeleccionado,
        monto: monto,
        categoria_id: document.getElementById('reg-categoria').value,
        nombre_ingreso: document.getElementById('reg-nombre').value,
        descripcion: document.getElementById('reg-desc').value,
        usuario_id: usuario.id,
        fecha: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    const url = editandoId ? `http://localhost:3000/api/movimientos/${editandoId}` : 'http://localhost:3000/api/movimientos';
    
    await fetch(url, {
        method: editandoId ? 'PUT' : 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });

    cerrarModal();
    cargarDatos();
}

// --- HELPERS ---
function abrirModal() {
    editandoId = null;
    document.getElementById('modal-registro').style.display = 'flex';
    cambiarTipo('gasto');
}

function cerrarModal() { document.getElementById('modal-registro').style.display = 'none'; }

function showT(e, txt) {
    const t = document.getElementById('tooltip');
    t.style.display = 'block';
    t.style.left = (e.clientX + 15) + 'px';
    t.style.top = (e.clientY - 15) + 'px';
    t.textContent = txt;
}
function hideT() { document.getElementById('tooltip').style.display = 'none'; }


