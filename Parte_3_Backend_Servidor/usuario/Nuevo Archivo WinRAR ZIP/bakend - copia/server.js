const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const cors = require('cors');

const app = express();
// X-Sesion le avisa al frontend de que la sesión caducó
app.use(cors({ exposedHeaders: ['X-Sesion'] }));
app.use(express.json());
// Express 5 deja req.body sin definir si la petición no trae JSON
app.use((req, res, next) => { req.body ??= {}; next(); });

// --- BASE DE DATOS SQLITE ---
// El archivo finanzas_app.db se crea solo la primera vez a partir de finanzas_app.sqlite.sql
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'finanzas_app.db');
const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', '..', 'finanzas_app.sqlite.sql');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
// Bases creadas antes de que existiera la columna reportes.datos
if (!db.prepare('PRAGMA table_info(reportes)').all().some((c) => c.name === 'datos')) {
    db.exec('ALTER TABLE reportes ADD COLUMN datos TEXT');
}
console.log('✅ Conectado a SQLite:', DB_PATH);

// Como mysql2: los campos que no llegan (undefined) se guardan como NULL
const prepare = (sql) => {
    const st = db.prepare(sql);
    const fix = (p) => p.map((v) => (v === undefined ? null : v));
    return {
        get: (...p) => st.get(...fix(p)),
        all: (...p) => st.all(...fix(p)),
        run: (...p) => st.run(...fix(p))
    };
};

// --- CONTRASEÑAS Y SESIONES ---

const sha256 = (texto) => crypto.createHash('sha256').update(String(texto)).digest('hex');

// Formato guardado: scrypt$<sal>$<hash>
const hashContraseña = (contraseña) => {
    const sal = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(contraseña), sal, 64).toString('hex');
    return `scrypt$${sal}$${hash}`;
};

const verificarContraseña = (contraseña, guardada) => {
    if (!contraseña || !guardada) return false;
    if (guardada.startsWith('scrypt$')) {
        const [, sal, hash] = guardada.split('$');
        const calculado = crypto.scryptSync(String(contraseña), sal, 64);
        return crypto.timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
    }
    // Formato antiguo: SHA-256 sin sal (el de la base MySQL). Se actualiza al iniciar sesión.
    return guardada === sha256(contraseña);
};

const DIAS_SESION = 7;

const crearSesion = (usuarioId) => {
    const token = crypto.randomBytes(32).toString('hex');
    // En la base solo se guarda el hash del token
    prepare(`INSERT INTO sesiones (usuario_id, token, fecha_expiracion) VALUES (?, ?, datetime('now','localtime', ?))`)
        .run(usuarioId, sha256(token), `+${DIAS_SESION} days`);
    return token;
};

const RUTAS_PUBLICAS = ['/login', '/registrar'];

app.use('/api', (req, res, next) => {
    if (RUTAS_PUBLICAS.includes(req.path)) return next();

    const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const usuario = token && prepare(`
        SELECT u.id, u.nombre, u.rol FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token = ? AND s.fecha_expiracion > datetime('now','localtime')`).get(sha256(token));

    if (!usuario) {
        res.set('X-Sesion', 'expirada');
        return res.status(401).json({ error: "Tu sesión no es válida o ha caducado. Inicia sesión de nuevo." });
    }
    req.usuario = usuario;
    req.token = token;
    next();
});

const soloAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: "Solo un administrador puede hacer esto" });
    next();
};

// Para rutas con :usuario_id: solo el propio usuario (o un admin) puede consultarlas
const mismoUsuario = (req, res, next) => {
    if (Number(req.params.usuario_id) !== req.usuario.id && req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: "No puedes ver los datos de otro usuario" });
    }
    next();
};

const noEncontrado = (res) => res.status(404).json({ error: "No encontrado" });

// --- 1. USUARIOS (Login/Logout/Registro) ---

app.post('/api/login', (req, res) => {
    const { correo, contraseña } = req.body;
    const usuario = prepare('SELECT id, nombre, rol, contraseña FROM usuarios WHERE correo = ?').get(correo);

    if (!usuario || !verificarContraseña(contraseña, usuario.contraseña)) {
        return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    if (!usuario.contraseña.startsWith('scrypt$')) {
        prepare('UPDATE usuarios SET contraseña = ? WHERE id = ?').run(hashContraseña(contraseña), usuario.id);
    }
    prepare("DELETE FROM sesiones WHERE fecha_expiracion <= datetime('now','localtime')").run();
    prepare("UPDATE usuarios SET estado = 'activo' WHERE id = ?").run(usuario.id);

    res.status(200).json({
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        estado: 'activo',
        token: crearSesion(usuario.id)
    });
});

app.post('/api/registrar', (req, res) => {
    const { nombre, correo, contraseña } = req.body;

    if (!nombre || !correo || !contraseña) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    const result = prepare(`INSERT INTO usuarios (nombre, correo, contraseña, rol, estado) VALUES (?, ?, ?, 'usuario', 'inactivo')`)
        .run(nombre, correo, hashContraseña(contraseña));
    res.status(201).json({ mensaje: "Usuario registrado con éxito", id: Number(result.lastInsertRowid) });
});

app.post('/api/logout', (req, res) => {
    prepare('DELETE FROM sesiones WHERE token = ?').run(sha256(req.token));
    prepare("UPDATE usuarios SET estado = 'inactivo' WHERE id = ?").run(req.usuario.id);
    res.json({ mensaje: "Sesión cerrada" });
});

app.put('/api/usuario/actualizar/:id', (req, res) => {
    const id = Number(req.params.id);
    const { nombre, correo, contraseña_actual, contraseña_nueva } = req.body;

    if (id !== req.usuario.id) return res.status(403).json({ error: "Solo puedes modificar tu propia cuenta" });

    const usuario = prepare('SELECT contraseña FROM usuarios WHERE id = ?').get(id);
    if (!usuario || !verificarContraseña(contraseña_actual, usuario.contraseña)) {
        return res.status(401).json({ error: "La contraseña actual es incorrecta" });
    }

    if (contraseña_nueva) {
        prepare('UPDATE usuarios SET nombre = ?, correo = ?, contraseña = ? WHERE id = ?')
            .run(nombre, correo, hashContraseña(contraseña_nueva), id);
    } else {
        prepare('UPDATE usuarios SET nombre = ?, correo = ? WHERE id = ?').run(nombre, correo, id);
    }
    res.json({ mensaje: "¡Cambios guardados con éxito!" });
});

// --- CATEGORÍAS ---

app.get('/api/categorias', (req, res) => {
    res.json(prepare('SELECT id, nombre, tipo FROM categorias ORDER BY tipo DESC, id').all());
});

// --- 2. MOVIMIENTOS / TRANSACCIONES ---

app.get('/api/resumen/:usuario_id', mismoUsuario, (req, res) => {
    res.json(prepare(`
        SELECT
            IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
            IFNULL(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) AS gastos
        FROM transacciones
        WHERE usuario_id = ?`).get(req.params.usuario_id));
});

app.get('/api/movimientos/:usuario_id', mismoUsuario, (req, res) => {
    res.json(prepare(`SELECT id, tipo, monto, descripcion, fecha, categoria_id
                 FROM transacciones WHERE usuario_id = ? ORDER BY fecha DESC`).all(req.params.usuario_id));
});

app.post('/api/movimientos', (req, res) => {
    const { tipo, categoria_id, monto, descripcion, nombre_ingreso } = req.body;
    const detalle = nombre_ingreso || descripcion || null;
    const result = prepare(`INSERT INTO transacciones (usuario_id, tipo, categoria_id, monto, descripcion) VALUES (?, ?, ?, ?, ?)`)
        .run(req.usuario.id, tipo, categoria_id, monto, detalle);
    res.status(201).json({ mensaje: "Guardado", id: Number(result.lastInsertRowid) });
});

app.put('/api/movimientos/:id', (req, res) => {
    const { tipo, categoria_id, monto, descripcion, nombre_ingreso } = req.body;
    const detalle = nombre_ingreso || descripcion || 'Sin detalle';
    const result = prepare(`UPDATE transacciones SET tipo = ?, categoria_id = ?, monto = ?, descripcion = ? WHERE id = ? AND usuario_id = ?`)
        .run(tipo, categoria_id, monto, detalle, req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Actualizado correctamente" });
});

app.delete('/api/movimientos/:id', (req, res) => {
    const result = prepare('DELETE FROM transacciones WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Eliminado correctamente" });
});

// --- 3. METAS ---

app.get('/api/metas/:usuario_id', mismoUsuario, (req, res) => {
    res.json(prepare('SELECT * FROM metas WHERE usuario_id = ?').all(req.params.usuario_id));
});

app.post('/api/metas', (req, res) => {
    const { id, nombre, monto_objetivo, monto_actual, fecha_limite } = req.body;
    const ahorro = parseFloat(monto_actual) || 0;
    const meta = parseFloat(monto_objetivo) || 0;
    const fecha = fecha_limite || new Date().toISOString().slice(0, 10);

    if (id) {
        const result = prepare(`UPDATE metas SET nombre = ?, monto_objetivo = ?, monto_actual = ?, fecha_limite = ? WHERE id = ? AND usuario_id = ?`)
            .run(nombre, meta, ahorro, fecha, id, req.usuario.id);
        if (result.changes === 0) return noEncontrado(res);
        res.json({ mensaje: "Meta actualizada." });
    } else {
        const result = prepare(`INSERT INTO metas (usuario_id, nombre, monto_objetivo, monto_actual, fecha_limite) VALUES (?, ?, ?, ?, ?)`)
            .run(req.usuario.id, nombre, meta, ahorro, fecha);
        res.status(201).json({ mensaje: "Meta creada.", id: Number(result.lastInsertRowid) });
    }
});

// Suma dinero al ahorro de una meta propia (sirve igual para usuarios y administrador)
app.post('/api/metas/:id/abonar', (req, res) => {
    const monto = Number(req.body.monto);
    if (!(monto > 0)) return res.status(400).json({ error: "El monto a abonar debe ser mayor que 0" });
    const result = prepare('UPDATE metas SET monto_actual = monto_actual + ? WHERE id = ? AND usuario_id = ?')
        .run(monto, req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Abono registrado", meta: prepare('SELECT * FROM metas WHERE id = ?').get(req.params.id) });
});

app.delete('/api/metas/:id', (req, res) => {
    const result = prepare('DELETE FROM metas WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Meta eliminada" });
});

// --- 4. PRESUPUESTOS ---

app.get('/api/presupuestos/:usuario_id', mismoUsuario, (req, res) => {
    res.json(prepare(`SELECT p.*, c.nombre as categoria_nombre FROM presupuestos p JOIN categorias c ON p.categoria_id = c.id WHERE p.usuario_id = ?`)
        .all(req.params.usuario_id));
});

app.post('/api/presupuestos', (req, res) => {
    const { id, categoria_id, monto_limite, monto_actual, periodo } = req.body;

    if (!categoria_id) return res.status(400).json({ error: "categoria_id es requerido" });

    if (id) {
        const result = prepare(`UPDATE presupuestos SET categoria_id = ?, monto_limite = ?, monto_actual = ?, periodo = ? WHERE id = ? AND usuario_id = ?`)
            .run(categoria_id, monto_limite, monto_actual || 0, periodo || 'mensual', id, req.usuario.id);
        if (result.changes === 0) return noEncontrado(res);
        res.json({ mensaje: "Presupuesto actualizado" });
    } else {
        const result = prepare(`INSERT INTO presupuestos (usuario_id, categoria_id, monto_limite, monto_actual, periodo) VALUES (?, ?, ?, ?, ?)`)
            .run(req.usuario.id, categoria_id, monto_limite, monto_actual || 0, periodo || 'mensual');
        res.status(201).json({ mensaje: "Presupuesto creado", id: Number(result.lastInsertRowid) });
    }
});

app.delete('/api/presupuestos/:id', (req, res) => {
    const result = prepare('DELETE FROM presupuestos WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Presupuesto eliminado correctamente" });
});

// --- 5. RECURRENTES ---

app.get('/api/recurrentes/:usuario_id', mismoUsuario, (req, res) => {
    res.json(prepare(`SELECT r.*, c.nombre as categoria_nombre FROM transacciones_recurrentes r JOIN categorias c ON r.categoria_id = c.id WHERE r.usuario_id = ?`)
        .all(req.params.usuario_id));
});

app.post('/api/recurrentes/pagar', (req, res) => {
    const { categoria_id, monto, descripcion, recurrente_id } = req.body;
    const recurrente = prepare('SELECT id FROM transacciones_recurrentes WHERE id = ? AND usuario_id = ?').get(recurrente_id, req.usuario.id);
    if (!recurrente) return noEncontrado(res);

    prepare(`INSERT INTO transacciones (usuario_id, tipo, categoria_id, monto, descripcion) VALUES (?, 'gasto', ?, ?, ?)`)
        .run(req.usuario.id, categoria_id, monto, descripcion);
    prepare(`UPDATE transacciones_recurrentes SET pago = pago + ?, pagado = CASE WHEN pago + ? >= monto THEN 1 ELSE 0 END WHERE id = ?`)
        .run(monto, monto, recurrente_id);
    res.json({ mensaje: "Aporte registrado" });
});

app.post('/api/recurrentes', (req, res) => {
    const { categoria_id, monto, frecuencia, fecha_inicio, descripcion } = req.body;
    const result = prepare(`INSERT INTO transacciones_recurrentes
                 (usuario_id, categoria_id, monto, frecuencia, fecha_inicio, descripcion, pago, pagado)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 0)`)
        .run(req.usuario.id, categoria_id, monto, frecuencia, fecha_inicio, descripcion);
    res.status(201).json({ mensaje: "Recurrente creado", id: Number(result.lastInsertRowid) });
});

app.put('/api/recurrentes/:id', (req, res) => {
    const { categoria_id, monto, frecuencia, fecha_inicio, descripcion } = req.body;
    const result = prepare(`UPDATE transacciones_recurrentes
                 SET categoria_id = ?, monto = ?, frecuencia = ?, fecha_inicio = ?, descripcion = ?
                 WHERE id = ? AND usuario_id = ?`)
        .run(categoria_id, monto, frecuencia, fecha_inicio, descripcion, req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Recurrente actualizado correctamente" });
});

app.delete('/api/recurrentes/:id', (req, res) => {
    const result = prepare('DELETE FROM transacciones_recurrentes WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Gasto recurrente eliminado correctamente" });
});

// --- 6. ADMINISTRADOR ---

app.use('/api/admin', soloAdmin);

const SUMAS = `
    IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto END), 0) AS ingresos,
    IFNULL(SUM(CASE WHEN tipo = 'gasto' THEN monto END), 0) AS gastos`;

// El dinero que ve el administrador es solo el suyo: cada cuenta ve únicamente sus movimientos.
// Filtro por el usuario que consulta y, opcionalmente, por los últimos ?dias=N
const filtroDias = (req) => {
    const dias = parseInt(req.query.dias, 10);
    return dias > 0
        ? { where: `WHERE usuario_id = ? AND date(fecha) > date('now','localtime', ?)`, params: [req.usuario.id, `-${dias} days`] }
        : { where: 'WHERE usuario_id = ?', params: [req.usuario.id] };
};

// Variación en % de este mes frente al anterior (null si el mes anterior fue 0)
const variacion = (actual, anterior) => (anterior ? Math.round(((actual - anterior) / anterior) * 100) : null);

app.get(['/api/admin/resumen', '/api/reportes/resumen'], (req, res) => {
    const f = filtroDias(req);
    const totales = prepare(`SELECT ${SUMAS}, COUNT(*) AS transacciones FROM transacciones ${f.where}`).get(...f.params);
    const usuarios = prepare(`SELECT COUNT(*) AS total, IFNULL(SUM(estado = 'activo'), 0) AS conectados FROM usuarios`).get();
    const metas = prepare(`SELECT COUNT(*) AS total, IFNULL(SUM(monto_actual >= monto_objetivo), 0) AS cumplidas FROM metas WHERE usuario_id = ?`).get(req.usuario.id);

    const mes = (desplazamiento) => prepare(`
        SELECT ${SUMAS} FROM transacciones
        WHERE usuario_id = ? AND strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now', 'localtime', ?)`).get(req.usuario.id, `${desplazamiento} months`);
    const registros = (desplazamiento) => prepare(`
        SELECT COUNT(*) AS n FROM usuarios
        WHERE strftime('%Y-%m', fecha_registro) = strftime('%Y-%m', 'now', 'localtime', ?)`).get(`${desplazamiento} months`).n;
    const actual = mes(0), anterior = mes(-1);

    const esAdmin = req.usuario.rol === 'admin';
    res.json({
        usuarios: esAdmin ? usuarios.total : null,
        usuarios_conectados: esAdmin ? usuarios.conectados : null,
        ingresos: totales.ingresos,
        gastos: totales.gastos,
        transacciones: totales.transacciones,
        metas: metas.total,
        metas_cumplidas: metas.cumplidas,
        tendencia: {
            usuarios: esAdmin ? variacion(registros(0), registros(-1)) : null,
            ingresos: variacion(actual.ingresos, anterior.ingresos),
            gastos: variacion(actual.gastos, anterior.gastos),
            ahorro: variacion(actual.ingresos - actual.gastos, anterior.ingresos - anterior.gastos)
        }
    });
});

// Serie de ingresos/gastos agrupada: ?dias=N&agrupar=dia|semana  o  ?meses=N (agrupado por mes)
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fechaLocal = (d) => d.toLocaleDateString('sv-SE'); // YYYY-MM-DD

app.get(['/api/admin/serie', '/api/reportes/serie'], (req, res) => {
    const hoy = new Date();
    const meses = Math.min(parseInt(req.query.meses, 10) || 0, 24);
    const dias = Math.min(parseInt(req.query.dias, 10) || 7, 366);
    const agrupar = meses ? 'mes' : (req.query.agrupar === 'semana' ? 'semana' : 'dia');

    const inicio = meses
        ? new Date(hoy.getFullYear(), hoy.getMonth() - meses + 1, 1)
        : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias + 1);

    const porDia = new Map(prepare(`
        SELECT date(fecha) AS dia, ${SUMAS} FROM transacciones
        WHERE usuario_id = ? AND date(fecha) >= ? GROUP BY dia`).all(req.usuario.id, fechaLocal(inicio)).map((f) => [f.dia, f]));

    const grupos = [];
    for (let d = new Date(inicio), i = 0; d <= hoy; d.setDate(d.getDate() + 1), i++) {
        let clave, etiqueta;
        if (agrupar === 'mes') {
            clave = `${d.getFullYear()}-${d.getMonth()}`;
            etiqueta = MESES[d.getMonth()];
        } else if (agrupar === 'semana') {
            clave = Math.floor(i / 7);
            etiqueta = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else {
            clave = fechaLocal(d);
            etiqueta = dias <= 7 ? DIAS_SEMANA[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`;
        }
        let grupo = grupos[grupos.length - 1];
        if (!grupo || grupo.clave !== clave) grupos.push(grupo = { clave, label: etiqueta, ingresos: 0, gastos: 0 });
        const fila = porDia.get(fechaLocal(d));
        if (fila) { grupo.ingresos += fila.ingresos; grupo.gastos += fila.gastos; }
    }
    res.json(grupos.map(({ label, ingresos, gastos }) => ({ label, ingresos, gastos })));
});

app.get(['/api/admin/gastos-categoria', '/api/reportes/gastos-categoria'], (req, res) => {
    const dias = parseInt(req.query.dias, 10);
    const condicionDias = dias > 0 ? `AND date(t.fecha) > date('now','localtime', ?)` : '';
    const params = dias > 0 ? [req.usuario.id, `-${dias} days`] : [req.usuario.id];
    res.json(prepare(`
        SELECT c.id, c.nombre, IFNULL(SUM(t.monto), 0) AS monto
        FROM categorias c
        LEFT JOIN transacciones t ON t.categoria_id = c.id AND t.tipo = 'gasto' AND t.usuario_id = ? ${condicionDias}
        WHERE c.tipo = 'gasto'
        GROUP BY c.id ORDER BY monto DESC`).all(...params));
});

app.get('/api/admin/transacciones', (req, res) => {
    const limite = Math.min(parseInt(req.query.limite, 10) || 50, 500);
    res.json(prepare(`
        SELECT t.id, t.tipo, t.monto, t.descripcion, t.fecha, u.nombre AS usuario, c.nombre AS categoria
        FROM transacciones t
        JOIN usuarios u ON u.id = t.usuario_id
        JOIN categorias c ON c.id = t.categoria_id
        WHERE t.usuario_id = ?
        ORDER BY t.fecha DESC, t.id DESC LIMIT ?`).all(req.usuario.id, limite));
});

// Usuarios
app.get('/api/admin/usuarios', (req, res) => {
    res.json(prepare(`
        SELECT u.id, u.nombre, u.correo, u.rol, u.estado, u.fecha_registro,
               (SELECT COUNT(*) FROM transacciones t WHERE t.usuario_id = u.id) AS transacciones
        FROM usuarios u ORDER BY u.id`).all());
});

app.post('/api/admin/usuarios', (req, res) => {
    const { nombre, correo, contraseña, rol } = req.body;
    if (!nombre || !correo || !contraseña) return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });
    const result = prepare(`INSERT INTO usuarios (nombre, correo, contraseña, rol) VALUES (?, ?, ?, ?)`)
        .run(nombre, correo, hashContraseña(contraseña), rol === 'admin' ? 'admin' : 'usuario');
    res.status(201).json({ mensaje: "Usuario creado", id: Number(result.lastInsertRowid) });
});

app.put('/api/admin/usuarios/:id', (req, res) => {
    const id = Number(req.params.id);
    const { nombre, correo, rol, contraseña } = req.body;
    if (!nombre || !correo) return res.status(400).json({ error: "Nombre y correo son obligatorios" });
    if (id === req.usuario.id && rol !== 'admin') {
        return res.status(400).json({ error: "No puedes quitarte el rol de administrador a ti mismo" });
    }

    const result = prepare('UPDATE usuarios SET nombre = ?, correo = ?, rol = ? WHERE id = ?')
        .run(nombre, correo, rol === 'admin' ? 'admin' : 'usuario', id);
    if (result.changes === 0) return noEncontrado(res);
    if (contraseña) prepare('UPDATE usuarios SET contraseña = ? WHERE id = ?').run(hashContraseña(contraseña), id);
    res.json({ mensaje: "Usuario actualizado" });
});

app.delete('/api/admin/usuarios/:id', (req, res) => {
    const id = Number(req.params.id);
    if (id === req.usuario.id) return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });

    // Primero sus movimientos: el trigger de historial necesita que el usuario aún exista.
    // Al borrar el usuario, su historial y el resto de sus datos se borran en cascada.
    db.exec('BEGIN');
    let result;
    try {
        prepare('DELETE FROM transacciones WHERE usuario_id = ?').run(id);
        result = prepare('DELETE FROM usuarios WHERE id = ?').run(id);
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Usuario eliminado" });
});

// Metas del propio administrador (las de los usuarios solo las ve cada usuario)
app.get('/api/admin/metas', (req, res) => {
    res.json(prepare('SELECT * FROM metas WHERE usuario_id = ? ORDER BY fecha_limite').all(req.usuario.id));
});

app.post('/api/admin/metas', (req, res) => {
    const { nombre, monto_objetivo, monto_actual, fecha_limite } = req.body;
    if (!nombre || !(Number(monto_objetivo) > 0)) {
        return res.status(400).json({ error: "Nombre y un monto objetivo mayor que 0 son obligatorios" });
    }
    const result = prepare(`INSERT INTO metas (usuario_id, nombre, monto_objetivo, monto_actual, fecha_limite) VALUES (?, ?, ?, ?, ?)`)
        .run(req.usuario.id, nombre, Number(monto_objetivo), Number(monto_actual) || 0, fecha_limite || new Date().toISOString().slice(0, 10));
    res.status(201).json({ mensaje: "Meta creada", id: Number(result.lastInsertRowid) });
});

app.put('/api/admin/metas/:id', (req, res) => {
    const { nombre, monto_objetivo, monto_actual, fecha_limite } = req.body;
    if (!nombre || !(Number(monto_objetivo) > 0)) return res.status(400).json({ error: "Nombre y un monto objetivo mayor que 0 son obligatorios" });
    const result = prepare(`UPDATE metas SET nombre = ?, monto_objetivo = ?, monto_actual = ?, fecha_limite = COALESCE(?, fecha_limite) WHERE id = ? AND usuario_id = ?`)
        .run(nombre, Number(monto_objetivo), Number(monto_actual) || 0, fecha_limite || null, req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Meta actualizada" });
});

app.delete('/api/admin/metas/:id', (req, res) => {
    const result = prepare('DELETE FROM metas WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Meta eliminada" });
});

// Presupuestos del administrador por categoría, con lo que él gastó en el mes ?mes=YYYY-MM
app.get('/api/admin/presupuestos', (req, res) => {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : fechaLocal(new Date()).slice(0, 7);
    const id = req.usuario.id;
    res.json(prepare(`
        SELECT c.id, c.nombre,
            IFNULL((SELECT SUM(CASE WHEN p.periodo = 'semanal' THEN p.monto_limite * 4 ELSE p.monto_limite END)
                    FROM presupuestos p WHERE p.categoria_id = c.id AND p.usuario_id = ?), 0) AS asignado,
            IFNULL((SELECT SUM(t.monto) FROM transacciones t
                    WHERE t.categoria_id = c.id AND t.tipo = 'gasto' AND t.usuario_id = ?
                      AND strftime('%Y-%m', t.fecha) = ?), 0) AS gastado
        FROM categorias c WHERE c.tipo = 'gasto' ORDER BY c.id`).all(id, id, mes));
});

// Reportes guardados: cada cuenta (usuario o administrador) solo ve y borra los suyos
const leerDatos = (texto) => {
    try { return texto ? JSON.parse(texto) : null; } catch { return null; }
};

app.get(['/api/admin/reportes', '/api/reportes/guardados'], (req, res) => {
    const filas = prepare(`
        SELECT r.id, r.tipo, r.fecha_generado, r.datos, u.nombre AS usuario
        FROM reportes r JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.usuario_id = ?
        ORDER BY r.fecha_generado DESC, r.id DESC LIMIT 20`).all(req.usuario.id);
    res.json(filas.map((r) => ({ ...r, datos: leerDatos(r.datos) })));
});

app.post(['/api/admin/reportes', '/api/reportes/guardados'], (req, res) => {
    const tipo = String(req.body.tipo || '').trim().slice(0, 50);
    if (!tipo) return res.status(400).json({ error: "El tipo de reporte es obligatorio" });
    const datos = req.body.datos ? JSON.stringify(req.body.datos) : null;
    if (datos && datos.length > 20000) return res.status(400).json({ error: "Los datos del reporte son demasiado grandes" });
    const result = prepare('INSERT INTO reportes (usuario_id, tipo, datos) VALUES (?, ?, ?)').run(req.usuario.id, tipo, datos);
    res.status(201).json({ mensaje: "Reporte registrado", id: Number(result.lastInsertRowid) });
});

app.delete(['/api/admin/reportes/:id', '/api/reportes/guardados/:id'], (req, res) => {
    const result = prepare('DELETE FROM reportes WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    res.json({ mensaje: "Reporte eliminado" });
});

app.delete(['/api/admin/reportes', '/api/reportes/guardados'], (req, res) => {
    const result = prepare('DELETE FROM reportes WHERE usuario_id = ?').run(req.usuario.id);
    res.json({ mensaje: "Reportes eliminados", eliminados: Number(result.changes) });
});

// --- ERRORES ---

app.use((err, req, res, next) => {
    if (/UNIQUE constraint failed: usuarios.correo/.test(err.message)) {
        return res.status(400).json({ error: "El correo ya está registrado" });
    }
    if (/FOREIGN KEY|CHECK constraint|NOT NULL constraint/.test(err.message)) {
        return res.status(400).json({ error: "Datos inválidos o incompletos" });
    }
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error('❌', err);
    res.status(500).json({ error: "Error en el servidor" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
