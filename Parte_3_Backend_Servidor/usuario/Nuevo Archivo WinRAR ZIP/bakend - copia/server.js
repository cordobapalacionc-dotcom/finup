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
// Bases creadas antes de vincular los aportes con su meta
if (!db.prepare('PRAGMA table_info(transacciones)').all().some((c) => c.name === 'meta_id')) {
    db.exec('ALTER TABLE transacciones ADD COLUMN meta_id INTEGER');
}
// Bases creadas antes de poder quitar gastos del reporte por categoría
if (!db.prepare('PRAGMA table_info(transacciones)').all().some((c) => c.name === 'oculto_reporte')) {
    db.exec('ALTER TABLE transacciones ADD COLUMN oculto_reporte INTEGER NOT NULL DEFAULT 0');
    // El historial solo debe registrar cambios de monto o descripción (no el ocultar del reporte)
    db.exec(`DROP TRIGGER IF EXISTS tg_historial_update;
        CREATE TRIGGER tg_historial_update AFTER UPDATE ON transacciones
        WHEN OLD.monto IS NOT NEW.monto OR OLD.descripcion IS NOT NEW.descripcion
        BEGIN
          INSERT INTO historial_cambios (transaccion_id, usuario_id, monto_anterior, monto_nuevo, descripcion_anterior, descripcion_nueva, tipo_operacion)
          VALUES (OLD.id, OLD.usuario_id, OLD.monto, NEW.monto, OLD.descripcion, NEW.descripcion, 'UPDATE');
        END;`);
}
const tieneColumna = (tabla, columna) => db.prepare(`PRAGMA table_info(${tabla})`).all().some((c) => c.name === columna);
// Categorías con descripción, estado (activa/inactiva) y dueño (NULL = global del administrador)
if (!tieneColumna('categorias', 'descripcion')) db.exec('ALTER TABLE categorias ADD COLUMN descripcion TEXT');
if (!tieneColumna('categorias', 'estado')) {
    db.exec(`ALTER TABLE categorias ADD COLUMN estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','inactiva'))`);
}
if (!tieneColumna('categorias', 'usuario_id')) {
    db.exec('ALTER TABLE categorias ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE');
}
db.exec('CREATE INDEX IF NOT EXISTS fk_categorias_usuario ON categorias(usuario_id)');
// Cierre de sesión por inactividad
if (!tieneColumna('sesiones', 'ultima_actividad')) db.exec('ALTER TABLE sesiones ADD COLUMN ultima_actividad TEXT');
// Versión 1: usuarios.estado pasa a significar "cuenta habilitada / desactivada" (antes era "conectado / desconectado").
// Todas las cuentas que existían quedan habilitadas.
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
    db.exec(`UPDATE usuarios SET estado = 'activo'; PRAGMA user_version = 1;`);
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
// Minutos sin actividad tras los que la sesión se cierra sola
const MINUTOS_INACTIVIDAD = Number(process.env.MINUTOS_INACTIVIDAD) || 30;

const crearSesion = (usuarioId) => {
    const token = crypto.randomBytes(32).toString('hex');
    // En la base solo se guarda el hash del token
    prepare(`INSERT INTO sesiones (usuario_id, token, fecha_expiracion, ultima_actividad) VALUES (?, ?, datetime('now','localtime', ?), datetime('now','localtime'))`)
        .run(usuarioId, sha256(token), `+${DIAS_SESION} days`);
    return token;
};

const RUTAS_PUBLICAS = ['/login', '/registrar'];

app.use('/api', (req, res, next) => {
    if (RUTAS_PUBLICAS.includes(req.path)) return next();

    const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const sesion = token && prepare(`
        SELECT s.id AS sesion_id, u.id, u.nombre, u.rol, u.estado,
               COALESCE(s.ultima_actividad, s.fecha_inicio) > datetime('now','localtime', ?) AS reciente
        FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token = ? AND s.fecha_expiracion > datetime('now','localtime')`).get(`-${MINUTOS_INACTIVIDAD} minutes`, sha256(token));

    // X-Sesion le dice al frontend por qué terminó la sesión (para mostrarlo en el login)
    const rechazar = (motivo, error) => {
        res.set('X-Sesion', motivo);
        return res.status(401).json({ error });
    };
    if (!sesion) return rechazar('expirada', "Tu sesión no es válida o ha caducado. Inicia sesión de nuevo.");
    if (sesion.estado !== 'activo') {
        prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(sesion.id);
        return rechazar('desactivada', "Tu cuenta está desactivada. Comunícate con el administrador.");
    }
    if (!sesion.reciente) {
        prepare('DELETE FROM sesiones WHERE id = ?').run(sesion.sesion_id);
        return rechazar('inactividad', "Tu sesión se cerró por inactividad. Inicia sesión de nuevo.");
    }
    prepare(`UPDATE sesiones SET ultima_actividad = datetime('now','localtime') WHERE id = ?`).run(sesion.sesion_id);
    req.usuario = { id: sesion.id, nombre: sesion.nombre, rol: sesion.rol };
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

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const correoValido = (correo) => FORMATO_CORREO.test(String(correo || '').trim());
// Mínimo 8 caracteres con al menos una letra y un número (lo mismo que pide el formulario de registro)
const contraseñaValida = (c) => typeof c === 'string' && c.length >= 8 && /[a-zA-Z]/.test(c) && /[0-9]/.test(c);
const REQUISITOS_CONTRASEÑA = "La contraseña debe tener al menos 8 caracteres, una letra y un número";

app.post('/api/login', (req, res) => {
    const correo = String(req.body.correo || '').trim();
    const { contraseña } = req.body;
    if (!correo || !contraseña) return res.status(400).json({ error: "Ingresa tu correo y tu contraseña" });
    if (!correoValido(correo)) return res.status(400).json({ error: "El formato del correo no es válido" });

    const usuario = prepare('SELECT id, nombre, correo, rol, estado, contraseña FROM usuarios WHERE correo = ?').get(correo);

    if (!usuario || !verificarContraseña(contraseña, usuario.contraseña)) {
        return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }
    if (usuario.estado !== 'activo') {
        return res.status(403).json({ error: "Tu cuenta está desactivada. Comunícate con el administrador." });
    }

    if (!usuario.contraseña.startsWith('scrypt$')) {
        prepare('UPDATE usuarios SET contraseña = ? WHERE id = ?').run(hashContraseña(contraseña), usuario.id);
    }
    prepare("DELETE FROM sesiones WHERE fecha_expiracion <= datetime('now','localtime')").run();

    res.status(200).json({
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        estado: 'activo',
        token: crearSesion(usuario.id)
    });
});

app.post('/api/registrar', (req, res) => {
    const nombre = String(req.body.nombre || '').trim();
    const correo = String(req.body.correo || '').trim();
    const { contraseña, confirmacion } = req.body;

    if (!nombre || !correo || !contraseña) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    if (!correoValido(correo)) return res.status(400).json({ error: "El formato del correo no es válido" });
    if (!contraseñaValida(contraseña)) return res.status(400).json({ error: REQUISITOS_CONTRASEÑA });
    if (confirmacion !== undefined && confirmacion !== contraseña) {
        return res.status(400).json({ error: "Las contraseñas no coinciden" });
    }
    if (prepare('SELECT 1 FROM usuarios WHERE correo = ?').get(correo)) {
        return res.status(409).json({ error: "Ese correo ya está registrado. Inicia sesión.", existe: true });
    }

    const result = prepare(`INSERT INTO usuarios (nombre, correo, contraseña, rol, estado) VALUES (?, ?, ?, 'usuario', 'activo')`)
        .run(nombre, correo, hashContraseña(contraseña));
    res.status(201).json({ mensaje: "Usuario registrado con éxito", id: Number(result.lastInsertRowid) });
});

app.post('/api/logout', (req, res) => {
    prepare('DELETE FROM sesiones WHERE token = ?').run(sha256(req.token));
    res.json({ mensaje: "Sesión cerrada" });
});

app.put('/api/usuario/actualizar/:id', (req, res) => {
    const id = Number(req.params.id);
    const { nombre, correo, contraseña_actual, contraseña_nueva } = req.body;

    if (id !== req.usuario.id) return res.status(403).json({ error: "Solo puedes modificar tu propia cuenta" });
    if (!String(nombre || '').trim() || !correoValido(correo)) return res.status(400).json({ error: "Escribe un nombre y un correo válido" });
    if (contraseña_nueva && !contraseñaValida(contraseña_nueva)) return res.status(400).json({ error: REQUISITOS_CONTRASEÑA });

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
// Globales (usuario_id NULL): las gestiona el administrador y las ven todos.
// Propias (usuario_id = el usuario): cada usuario crea, edita, desactiva y elimina las suyas.
// Una categoría inactiva no se ofrece para nuevos movimientos, pero sus movimientos se conservan.

const CATEGORIA_SISTEMA = 'Ahorro para metas'; // la usan los abonos a metas: no se puede tocar
const COLUMNAS_CATEGORIA = `c.id, c.nombre, c.tipo, c.descripcion, c.estado, c.usuario_id,
    (SELECT COUNT(*) FROM transacciones t WHERE t.categoria_id = c.id) AS movimientos`;
// Condición SQL: categorías que ve el usuario (globales + las suyas)
const VISIBLE = '(c.usuario_id IS NULL OR c.usuario_id = ?)';

const normalizar = (texto) => String(texto || '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const categoriaVisible = (usuarioId, id) =>
    prepare(`SELECT * FROM categorias c WHERE c.id = ? AND ${VISIBLE}`).get(id, usuarioId);

// ¿Ya existe una categoría con ese nombre? Para un usuario: entre las globales y las suyas. Para una global: entre las globales.
const nombreDuplicado = (nombre, usuarioId, excluirId = 0) => prepare(
    `SELECT nombre FROM categorias WHERE id != ? AND (usuario_id IS NULL OR usuario_id = ?)`
).all(excluirId, usuarioId).some((c) => normalizar(c.nombre) === normalizar(nombre));

// Valida los datos de una categoría. Devuelve el mensaje de error o null.
const validarCategoria = ({ nombre, tipo }) => {
    if (!String(nombre || '').trim()) return "El nombre de la categoría es obligatorio";
    if (String(nombre).trim().length > 50) return "El nombre no puede tener más de 50 caracteres";
    if (!['ingreso', 'gasto'].includes(tipo)) return "El tipo debe ser ingreso o gasto";
    return null;
};

const usoDeCategoria = (id) => prepare(`SELECT
    (SELECT COUNT(*) FROM transacciones WHERE categoria_id = ?) +
    (SELECT COUNT(*) FROM presupuestos WHERE categoria_id = ?) +
    (SELECT COUNT(*) FROM transacciones_recurrentes WHERE categoria_id = ?) AS usos`).get(id, id, id).usos;

const crearCategoria = (res, usuarioId, body) => {
    const error = validarCategoria(body);
    if (error) return res.status(400).json({ error });
    if (nombreDuplicado(body.nombre, usuarioId)) return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
    const result = prepare('INSERT INTO categorias (nombre, tipo, descripcion, estado, usuario_id) VALUES (?, ?, ?, ?, ?)')
        .run(String(body.nombre).trim(), body.tipo, String(body.descripcion || '').trim() || null, 'activa', usuarioId);
    res.status(201).json({ mensaje: "Categoría creada", id: Number(result.lastInsertRowid) });
};

const editarCategoria = (res, categoria, body) => {
    if (!categoria) return noEncontrado(res);
    if (categoria.nombre === CATEGORIA_SISTEMA) return res.status(400).json({ error: "Esta categoría la usa el sistema y no se puede modificar" });
    const datos = { nombre: body.nombre ?? categoria.nombre, tipo: body.tipo ?? categoria.tipo };
    const error = validarCategoria(datos);
    if (error) return res.status(400).json({ error });
    if (nombreDuplicado(datos.nombre, categoria.usuario_id, categoria.id)) {
        return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
    }
    if (datos.tipo !== categoria.tipo && usoDeCategoria(categoria.id) > 0) {
        return res.status(400).json({ error: "No puedes cambiar el tipo: la categoría ya tiene movimientos o presupuestos" });
    }
    prepare('UPDATE categorias SET nombre = ?, tipo = ?, descripcion = ? WHERE id = ?')
        .run(String(datos.nombre).trim(), datos.tipo, String(body.descripcion ?? categoria.descripcion ?? '').trim() || null, categoria.id);
    res.json({ mensaje: "Categoría actualizada" });
};

const cambiarEstadoCategoria = (res, categoria, estado) => {
    if (!categoria) return noEncontrado(res);
    if (!['activa', 'inactiva'].includes(estado)) return res.status(400).json({ error: "El estado debe ser activa o inactiva" });
    if (categoria.nombre === CATEGORIA_SISTEMA) return res.status(400).json({ error: "Esta categoría la usa el sistema y no se puede desactivar" });
    prepare('UPDATE categorias SET estado = ? WHERE id = ?').run(estado, categoria.id);
    res.json({ mensaje: estado === 'activa' ? "Categoría activada" : "Categoría desactivada" });
};

const eliminarCategoria = (res, categoria) => {
    if (!categoria) return noEncontrado(res);
    if (categoria.nombre === CATEGORIA_SISTEMA) return res.status(400).json({ error: "Esta categoría la usa el sistema y no se puede eliminar" });
    if (usoDeCategoria(categoria.id) > 0) {
        return res.status(400).json({ error: "La categoría tiene movimientos o presupuestos: desactívala en lugar de eliminarla" });
    }
    prepare('DELETE FROM categorias WHERE id = ?').run(categoria.id);
    res.json({ mensaje: "Categoría eliminada" });
};

// Todas las que ve el usuario (activas e inactivas: las inactivas hacen falta para mostrar movimientos antiguos)
app.get('/api/categorias', (req, res) => {
    res.json(prepare(`SELECT ${COLUMNAS_CATEGORIA}, (c.usuario_id IS NOT NULL) AS propia
        FROM categorias c WHERE ${VISIBLE} ORDER BY c.tipo DESC, c.usuario_id IS NOT NULL, c.id`).all(req.usuario.id));
});

const categoriaPropia = (req) => prepare('SELECT * FROM categorias WHERE id = ? AND usuario_id = ?').get(req.params.id, req.usuario.id);

app.post('/api/categorias', (req, res) => crearCategoria(res, req.usuario.id, req.body));
app.put('/api/categorias/:id', (req, res) => editarCategoria(res, categoriaPropia(req), req.body));
app.put('/api/categorias/:id/estado', (req, res) => cambiarEstadoCategoria(res, categoriaPropia(req), req.body.estado));
app.delete('/api/categorias/:id', (req, res) => eliminarCategoria(res, categoriaPropia(req)));

// --- PRESUPUESTOS: acumulado y exceso ---
// Rango del periodo (mensual = mes calendario, semanal = lunes a domingo) que contiene la fecha dada
const rangoPresupuesto = (periodo, fecha) => periodo === 'semanal'
    ? prepare(`SELECT date(?, 'weekday 0', '-6 days') AS desde, date(?, 'weekday 0') AS hasta`).get(fecha, fecha)
    : prepare(`SELECT date(?, 'start of month') AS desde, date(?, 'start of month', '+1 month', '-1 day') AS hasta`).get(fecha, fecha);

// Presupuesto.calcularAcumulado(), estaExcedido() y calcularExceso() en una sola consulta
const estadoPresupuesto = (presupuesto, fecha) => {
    const { desde, hasta } = rangoPresupuesto(presupuesto.periodo, fecha);
    const acumulado = prepare(`SELECT IFNULL(SUM(monto), 0) AS total FROM transacciones
        WHERE usuario_id = ? AND categoria_id = ? AND tipo = 'gasto' AND date(fecha) BETWEEN ? AND ?`)
        .get(presupuesto.usuario_id, presupuesto.categoria_id, desde, hasta).total;
    const limite = presupuesto.monto_limite;
    return {
        acumulado,
        limite,
        excedido: acumulado > limite,
        exceso: Math.max(acumulado - limite, 0),
        porcentaje: limite > 0 ? Math.round((acumulado / limite) * 100) : 0,
        desde,
        hasta
    };
};

// Presupuesto.notificarExceso(): alertas de los presupuestos de esa categoría que quedaron excedidos
const alertasPresupuesto = (usuarioId, categoriaId, fecha) => prepare(`
    SELECT p.*, c.nombre AS categoria FROM presupuestos p JOIN categorias c ON c.id = p.categoria_id
    WHERE p.usuario_id = ? AND p.categoria_id = ?`).all(usuarioId, categoriaId)
    .map((p) => ({ categoria: p.categoria, periodo: p.periodo, ...estadoPresupuesto(p, fecha) }))
    .filter((a) => a.excedido);

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
    res.json(prepare(`SELECT id, tipo, monto, descripcion, fecha, categoria_id, meta_id
                 FROM transacciones WHERE usuario_id = ? ORDER BY fecha DESC`).all(req.params.usuario_id));
});

const hoyLocal = () => prepare(`SELECT date('now','localtime') AS hoy`).get().hoy;
const esFecha = (texto) => /^\d{4}-\d{2}-\d{2}$/.test(texto || '') && !Number.isNaN(new Date(`${texto}T00:00:00`).getTime());

// Transaccion.validarDatos(): devuelve { error } o los datos listos para guardar
const validarTransaccion = (req, anterior = null) => {
    const { tipo, categoria_id, descripcion, nombre_ingreso } = req.body;
    const monto = Number(req.body.monto);
    if (!['ingreso', 'gasto'].includes(tipo)) return { error: "Datos incorrectos: el tipo debe ser ingreso o gasto" };
    if (!Number.isFinite(monto) || monto <= 0) return { error: "Datos incorrectos: el monto debe ser mayor que 0" };
    const categoria = categoriaVisible(req.usuario.id, categoria_id);
    if (!categoria) return { error: "Datos incorrectos: elige una categoría válida" };
    if (categoria.tipo !== tipo) return { error: `Datos incorrectos: la categoría ${categoria.nombre} es de ${categoria.tipo}s` };
    if (categoria.nombre === CATEGORIA_SISTEMA) return { error: "Los abonos a metas se hacen desde la sección Metas" };
    // Una categoría inactiva no admite movimientos nuevos (sí se pueden editar los que ya la tenían)
    if (categoria.estado !== 'activa' && categoria.id !== anterior?.categoria_id) {
        return { error: "Datos incorrectos: la categoría está desactivada" };
    }
    let fecha = req.body.fecha ? String(req.body.fecha).slice(0, 10) : null;
    if (fecha && !esFecha(fecha)) return { error: "Datos incorrectos: la fecha no es válida" };
    if (fecha && fecha > hoyLocal()) return { error: "Datos incorrectos: la fecha no puede ser futura" };
    return { tipo, categoria_id: categoria.id, monto, fecha, detalle: String(nombre_ingreso || descripcion || '').trim() || null };
};

// Fecha elegida + hora actual; si no se eligió fecha, ahora
const FECHA_SQL = `COALESCE(? || ' ' || time('now','localtime'), datetime('now','localtime'))`;

app.post('/api/movimientos', (req, res) => {
    const datos = validarTransaccion(req);
    if (datos.error) return res.status(400).json({ error: datos.error });
    const result = prepare(`INSERT INTO transacciones (usuario_id, tipo, categoria_id, monto, descripcion, fecha) VALUES (?, ?, ?, ?, ?, ${FECHA_SQL})`)
        .run(req.usuario.id, datos.tipo, datos.categoria_id, datos.monto, datos.detalle, datos.fecha);
    const id = Number(result.lastInsertRowid);
    const { fecha } = prepare('SELECT date(fecha) AS fecha FROM transacciones WHERE id = ?').get(id);
    res.status(201).json({
        mensaje: "Movimiento registrado con éxito",
        id,
        saldo: saldoDe(req.usuario.id),
        alertas: datos.tipo === 'gasto' ? alertasPresupuesto(req.usuario.id, datos.categoria_id, fecha) : []
    });
});

app.put('/api/movimientos/:id', (req, res) => {
    const actual = prepare('SELECT meta_id, categoria_id FROM transacciones WHERE id = ? AND usuario_id = ?').get(req.params.id, req.usuario.id);
    if (!actual) return noEncontrado(res);
    if (actual.meta_id) return res.status(400).json({ error: "Este movimiento es un aporte a una meta: cámbialo desde Metas" });
    const datos = validarTransaccion(req, actual);
    if (datos.error) return res.status(400).json({ error: datos.error });
    // Si no llega fecha, se conserva la que tenía
    const result = prepare(`UPDATE transacciones SET tipo = ?, categoria_id = ?, monto = ?, descripcion = ?,
            fecha = CASE WHEN ? IS NULL THEN fecha ELSE ? || ' ' || time(fecha) END
        WHERE id = ? AND usuario_id = ?`)
        .run(datos.tipo, datos.categoria_id, datos.monto, datos.detalle || 'Sin detalle', datos.fecha, datos.fecha, req.params.id, req.usuario.id);
    if (result.changes === 0) return noEncontrado(res);
    const { fecha } = prepare('SELECT date(fecha) AS fecha FROM transacciones WHERE id = ?').get(req.params.id);
    res.json({
        mensaje: "Actualizado correctamente",
        saldo: saldoDe(req.usuario.id),
        alertas: datos.tipo === 'gasto' ? alertasPresupuesto(req.usuario.id, datos.categoria_id, fecha) : []
    });
});

app.delete('/api/movimientos/:id', (req, res) => {
    const mov = prepare('SELECT id, monto, meta_id FROM transacciones WHERE id = ? AND usuario_id = ?').get(req.params.id, req.usuario.id);
    if (!mov) return noEncontrado(res);
    enTransaccion(() => {
        prepare('DELETE FROM transacciones WHERE id = ?').run(mov.id);
        // Si era un aporte a una meta, ese dinero deja de estar en la meta
        if (mov.meta_id) prepare('UPDATE metas SET monto_actual = MAX(monto_actual - ?, 0) WHERE id = ?').run(mov.monto, mov.meta_id);
    });
    res.json({ mensaje: "Eliminado correctamente" });
});

// --- 3. METAS ---

// El ahorro de una meta sale del saldo. Cada aporte es un gasto de la categoría "Ahorro para metas"
// vinculado a la meta (meta_id). Al bajar el ahorro o eliminar la meta, esos aportes se reducen o
// se borran (del más reciente al más antiguo) y el dinero vuelve al saldo.
class SaldoInsuficiente extends Error {
    constructor(saldo) {
        super('Saldo insuficiente');
        this.saldo = saldo;
    }
}

const enTransaccion = (fn) => {
    db.exec('BEGIN');
    try {
        const resultado = fn();
        db.exec('COMMIT');
        return resultado;
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
};

const saldoDe = (usuarioId) => prepare(`
    SELECT IFNULL(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) AS saldo
    FROM transacciones WHERE usuario_id = ?`).get(usuarioId).saldo;

const aportarAMeta = (usuarioId, meta, monto) => {
    if (!(monto > 0)) return;
    const saldo = saldoDe(usuarioId);
    if (monto > saldo) throw new SaldoInsuficiente(saldo);
    const categoria = prepare(`SELECT id FROM categorias WHERE nombre = 'Ahorro para metas' AND tipo = 'gasto' AND usuario_id IS NULL`).get();
    prepare(`INSERT INTO transacciones (usuario_id, tipo, categoria_id, monto, descripcion, meta_id) VALUES (?, 'gasto', ?, ?, ?, ?)`)
        .run(usuarioId, categoria.id, monto, `Abono a meta: ${meta.nombre}`, meta.id);
    prepare('UPDATE metas SET monto_actual = monto_actual + ? WHERE id = ?').run(monto, meta.id);
};

// Devuelve al saldo hasta "monto" y lo quita del ahorro de la meta. Devuelve lo que volvió al saldo.
const retirarDeMeta = (meta, monto) => {
    if (!(monto > 0)) return 0;
    let pendiente = monto;
    const aportes = prepare('SELECT id, monto FROM transacciones WHERE meta_id = ? ORDER BY fecha DESC, id DESC').all(meta.id);
    for (const aporte of aportes) {
        if (pendiente <= 0) break;
        if (aporte.monto <= pendiente) {
            prepare('DELETE FROM transacciones WHERE id = ?').run(aporte.id);
            pendiente -= aporte.monto;
        } else {
            prepare('UPDATE transacciones SET monto = ? WHERE id = ?').run(aporte.monto - pendiente, aporte.id);
            pendiente = 0;
        }
    }
    prepare('UPDATE metas SET monto_actual = MAX(monto_actual - ?, 0) WHERE id = ?').run(monto, meta.id);
    return monto - pendiente;
};

// Lleva el ahorro de la meta a "nuevoAhorro" moviendo la diferencia desde o hacia el saldo
const ajustarAhorro = (usuarioId, meta, nuevoAhorro) => {
    const diferencia = nuevoAhorro - meta.monto_actual;
    if (diferencia > 0) aportarAMeta(usuarioId, meta, diferencia);
    if (diferencia < 0) retirarDeMeta(meta, -diferencia);
};

const crearMeta = (usuarioId, { nombre, monto_objetivo, monto_actual, fecha_limite }) => enTransaccion(() => {
    const id = Number(prepare(`INSERT INTO metas (usuario_id, nombre, monto_objetivo, monto_actual, fecha_limite) VALUES (?, ?, ?, 0, ?)`)
        .run(usuarioId, nombre, Number(monto_objetivo) || 0, fecha_limite || new Date().toISOString().slice(0, 10)).lastInsertRowid);
    aportarAMeta(usuarioId, { id, nombre }, Math.max(Number(monto_actual) || 0, 0));
    return id;
});

const actualizarMeta = (usuarioId, meta, { nombre, monto_objetivo, monto_actual, fecha_limite }) => enTransaccion(() => {
    prepare('UPDATE metas SET nombre = ?, monto_objetivo = ?, fecha_limite = COALESCE(?, fecha_limite) WHERE id = ?')
        .run(nombre, Number(monto_objetivo) || 0, fecha_limite || null, meta.id);
    ajustarAhorro(usuarioId, { ...meta, nombre }, Math.max(Number(monto_actual) || 0, 0));
});

// Elimina la meta y devuelve al saldo todo lo que se le había aportado
const eliminarMeta = (meta) => enTransaccion(() => {
    const devuelto = retirarDeMeta(meta, meta.monto_actual);
    prepare('DELETE FROM transacciones WHERE meta_id = ?').run(meta.id); // por si quedaba algún aporte
    prepare('DELETE FROM metas WHERE id = ?').run(meta.id);
    return devuelto;
});

// Meta.validarDatos(): nombre, monto objetivo > 0 y fecha límite que no haya pasado.
// Al editar, una fecha límite que no cambió se acepta aunque ya haya pasado.
const validarMeta = (body, anterior = null) => {
    if (!String(body.nombre || '').trim()) return "El nombre de la meta es obligatorio";
    if (!(Number(body.monto_objetivo) > 0)) return "El monto objetivo debe ser mayor que 0";
    if (Number(body.monto_actual) < 0) return "El ahorro no puede ser negativo";
    const fecha = body.fecha_limite ? String(body.fecha_limite).slice(0, 10) : null;
    if (!fecha) return anterior ? null : "La fecha límite es obligatoria";
    if (!esFecha(fecha)) return "La fecha límite no es válida";
    if (fecha < hoyLocal() && fecha !== String(anterior?.fecha_limite || '').slice(0, 10)) return "La fecha límite ya pasó";
    return null;
};

// Respuesta de un abono: avisa si con él la meta quedó cumplida
const metaCumplida = (antes, despues) => antes.monto_actual < antes.monto_objetivo && despues.monto_actual >= despues.monto_objetivo;

const metaPropia = (req, id) => prepare('SELECT * FROM metas WHERE id = ? AND usuario_id = ?').get(id, req.usuario.id);

app.get('/api/metas/:usuario_id', mismoUsuario, (req, res) => {
    res.json(prepare('SELECT * FROM metas WHERE usuario_id = ?').all(req.params.usuario_id));
});

app.post('/api/metas', (req, res) => {
    const { id } = req.body;
    if (id) {
        const meta = metaPropia(req, id);
        if (!meta) return noEncontrado(res);
        const error = validarMeta(req.body, meta);
        if (error) return res.status(400).json({ error });
        actualizarMeta(req.usuario.id, meta, req.body);
        return res.json({ mensaje: "Meta actualizada.", saldo: saldoDe(req.usuario.id) });
    }
    const error = validarMeta(req.body);
    if (error) return res.status(400).json({ error });
    const nuevoId = crearMeta(req.usuario.id, req.body);
    res.status(201).json({ mensaje: "Meta creada.", id: nuevoId, saldo: saldoDe(req.usuario.id) });
});

// Abonar a una meta propia (usuarios y administrador): el dinero sale del saldo
app.post('/api/metas/:id/abonar', (req, res) => {
    const monto = Number(req.body.monto);
    if (!(monto > 0)) return res.status(400).json({ error: "El monto a abonar debe ser mayor que 0" });
    const meta = metaPropia(req, req.params.id);
    if (!meta) return noEncontrado(res);
    enTransaccion(() => aportarAMeta(req.usuario.id, meta, monto));
    const actualizada = prepare('SELECT * FROM metas WHERE id = ?').get(meta.id);
    const cumplida = metaCumplida(meta, actualizada);
    res.json({
        mensaje: cumplida ? `¡Felicidades! Cumpliste la meta "${meta.nombre}"` : "Abono registrado",
        cumplida,
        meta: actualizada,
        saldo: saldoDe(req.usuario.id)
    });
});

// Sacar dinero de una meta propia ya cumplida (usuarios y administrador): el dinero vuelve al saldo
app.post('/api/metas/:id/retirar', (req, res) => {
    const monto = Number(req.body.monto);
    if (!(monto > 0)) return res.status(400).json({ error: "El monto a sacar debe ser mayor que 0" });
    const meta = metaPropia(req, req.params.id);
    if (!meta) return noEncontrado(res);
    if (meta.monto_actual < meta.monto_objetivo) {
        return res.status(400).json({ error: "Solo puedes sacar dinero de una meta cumplida" });
    }
    if (monto > meta.monto_actual) {
        return res.status(400).json({ error: `La meta solo tiene $${meta.monto_actual.toLocaleString('es-CO')} ahorrados` });
    }
    const retirado = enTransaccion(() => retirarDeMeta(meta, monto));
    res.json({
        mensaje: "Dinero devuelto a tu saldo",
        retirado,
        meta: prepare('SELECT * FROM metas WHERE id = ?').get(meta.id),
        saldo: saldoDe(req.usuario.id)
    });
});

app.delete('/api/metas/:id', (req, res) => {
    const meta = metaPropia(req, req.params.id);
    if (!meta) return noEncontrado(res);
    const devuelto = eliminarMeta(meta);
    res.json({ mensaje: "Meta eliminada", devuelto, saldo: saldoDe(req.usuario.id) });
});

// --- 4. PRESUPUESTOS ---

// Presupuesto.recalcular(): el gasto acumulado (monto_actual) se calcula con los movimientos del periodo actual
app.get('/api/presupuestos/:usuario_id', mismoUsuario, (req, res) => {
    const hoy = hoyLocal();
    const lista = prepare(`SELECT p.*, c.nombre as categoria_nombre FROM presupuestos p JOIN categorias c ON p.categoria_id = c.id WHERE p.usuario_id = ?`)
        .all(req.params.usuario_id)
        .map((p) => {
            const estado = estadoPresupuesto(p, hoy);
            if (estado.acumulado !== p.monto_actual) prepare('UPDATE presupuestos SET monto_actual = ? WHERE id = ?').run(estado.acumulado, p.id);
            return { ...p, monto_actual: estado.acumulado, ...estado };
        });
    res.json(lista);
});

// Presupuesto.establecer() con Presupuesto.validarMonto()
app.post('/api/presupuestos', (req, res) => {
    const { id, categoria_id } = req.body;
    const monto_limite = Number(req.body.monto_limite);
    const periodo = req.body.periodo || 'mensual';

    if (!Number.isFinite(monto_limite) || monto_limite <= 0) {
        return res.status(400).json({ error: "Monto inválido: el límite del presupuesto debe ser mayor que 0" });
    }
    if (!['mensual', 'semanal'].includes(periodo)) return res.status(400).json({ error: "El periodo debe ser mensual o semanal" });
    const categoria = categoriaVisible(req.usuario.id, categoria_id);
    if (!categoria || categoria.tipo !== 'gasto') return res.status(400).json({ error: "Elige una categoría de gasto válida" });
    const repetido = prepare('SELECT id FROM presupuestos WHERE usuario_id = ? AND categoria_id = ? AND periodo = ? AND id != ?')
        .get(req.usuario.id, categoria.id, periodo, Number(id) || 0);
    if (repetido) return res.status(409).json({ error: `Ya tienes un presupuesto ${periodo} para ${categoria.nombre}: edítalo` });

    const acumulado = estadoPresupuesto({ usuario_id: req.usuario.id, categoria_id: categoria.id, periodo, monto_limite }, hoyLocal()).acumulado;
    if (id) {
        const result = prepare(`UPDATE presupuestos SET categoria_id = ?, monto_limite = ?, monto_actual = ?, periodo = ? WHERE id = ? AND usuario_id = ?`)
            .run(categoria.id, monto_limite, acumulado, periodo, id, req.usuario.id);
        if (result.changes === 0) return noEncontrado(res);
        res.json({ mensaje: "Presupuesto actualizado" });
    } else {
        const result = prepare(`INSERT INTO presupuestos (usuario_id, categoria_id, monto_limite, monto_actual, periodo) VALUES (?, ?, ?, ?, ?)`)
            .run(req.usuario.id, categoria.id, monto_limite, acumulado, periodo);
        res.status(201).json({ mensaje: "Presupuesto guardado", id: Number(result.lastInsertRowid) });
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
// Periodo del reporte: ?mes=YYYY-MM, ?anio=YYYY o los últimos ?dias=N. Sin ninguno: todo. Devuelve { desde, hasta } o null.
const rangoReporte = (req) => {
    const { mes, anio } = req.query;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) {
        return prepare(`SELECT date(? || '-01') AS desde, date(? || '-01', '+1 month', '-1 day') AS hasta`).get(mes, mes);
    }
    if (/^\d{4}$/.test(anio || '')) return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
    const dias = parseInt(req.query.dias, 10);
    if (dias > 0) return prepare(`SELECT date('now','localtime', ?) AS desde, date('now','localtime') AS hasta`).get(`-${dias - 1} days`);
    return null;
};

// Filtro por el usuario que consulta y el periodo pedido. "col" es la columna de fecha (con alias si hace falta).
const filtroPeriodo = (req, col = 'fecha') => {
    const rango = rangoReporte(req);
    return rango
        ? { cond: `AND date(${col}) BETWEEN ? AND ?`, params: [rango.desde, rango.hasta], rango }
        : { cond: '', params: [], rango: null };
};

// Variación en % de este mes frente al anterior (null si el mes anterior fue 0)
const variacion = (actual, anterior) => (anterior ? Math.round(((actual - anterior) / anterior) * 100) : null);

app.get(['/api/admin/resumen', '/api/reportes/resumen'], (req, res) => {
    const f = filtroPeriodo(req);
    const totales = prepare(`SELECT ${SUMAS}, COUNT(*) AS transacciones FROM transacciones WHERE usuario_id = ? ${f.cond}`).get(req.usuario.id, ...f.params);
    // Conectados = cuentas con una sesión vigente y con actividad reciente
    const usuarios = prepare(`SELECT COUNT(*) AS total,
        (SELECT COUNT(DISTINCT usuario_id) FROM sesiones WHERE fecha_expiracion > datetime('now','localtime')
            AND COALESCE(ultima_actividad, fecha_inicio) > datetime('now','localtime', ?)) AS conectados
        FROM usuarios`).get(`-${MINUTOS_INACTIVIDAD} minutes`);
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
        desde: f.rango?.desde || null,
        hasta: f.rango?.hasta || null,
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
    let inicio, fin = hoy, agrupar, dias = 0;
    const { mes, anio } = req.query;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) {
        // Un mes concreto: un grupo por día
        const [a, m] = mes.split('-').map(Number);
        inicio = new Date(a, m - 1, 1);
        fin = new Date(a, m, 0);
        agrupar = 'dia';
        dias = 31;
    } else if (/^\d{4}$/.test(anio || '')) {
        // Un año concreto: un grupo por mes
        inicio = new Date(Number(anio), 0, 1);
        fin = new Date(Number(anio), 11, 31);
        agrupar = 'mes';
    } else {
        const meses = Math.min(parseInt(req.query.meses, 10) || 0, 24);
        dias = Math.min(parseInt(req.query.dias, 10) || 7, 366);
        agrupar = meses ? 'mes' : (req.query.agrupar === 'semana' ? 'semana' : 'dia');
        inicio = meses
            ? new Date(hoy.getFullYear(), hoy.getMonth() - meses + 1, 1)
            : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias + 1);
    }

    const porDia = new Map(prepare(`
        SELECT date(fecha) AS dia, ${SUMAS} FROM transacciones
        WHERE usuario_id = ? AND date(fecha) BETWEEN ? AND ? GROUP BY dia`).all(req.usuario.id, fechaLocal(inicio), fechaLocal(fin)).map((f) => [f.dia, f]));

    const grupos = [];
    for (let d = new Date(inicio), i = 0; d <= fin; d.setDate(d.getDate() + 1), i++) {
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
    const f = filtroPeriodo(req, 't.fecha');
    res.json(prepare(`
        SELECT c.id, c.nombre, IFNULL(SUM(t.monto), 0) AS monto
        FROM categorias c
        LEFT JOIN transacciones t ON t.categoria_id = c.id AND t.tipo = 'gasto' AND t.oculto_reporte = 0 AND t.usuario_id = ? ${f.cond}
        WHERE c.tipo = 'gasto' AND ${VISIBLE}
        GROUP BY c.id ORDER BY monto DESC`).all(req.usuario.id, ...f.params, req.usuario.id));
});

// Quita del reporte "Gastos por categoría" los gastos propios de una categoría (opcionalmente solo los de los últimos ?dias=N).
// No borra los movimientos: el dinero gastado sigue descontado del saldo y los gastos siguen en el historial.
// Los abonos a metas no se quitan aquí: se sacan desde la meta.
app.delete(['/api/admin/gastos-categoria/:id', '/api/reportes/gastos-categoria/:id'], (req, res) => {
    const categoria = categoriaVisible(req.usuario.id, req.params.id);
    if (!categoria || categoria.tipo !== 'gasto') return noEncontrado(res);
    if (categoria.nombre === 'Ahorro para metas') {
        return res.status(400).json({ error: "El ahorro de tus metas se saca desde la sección Metas" });
    }
    const f = filtroPeriodo(req);
    const params = [req.usuario.id, categoria.id, ...f.params];
    const filtro = `transacciones WHERE usuario_id = ? AND categoria_id = ? AND tipo = 'gasto' AND meta_id IS NULL AND oculto_reporte = 0 ${f.cond}`;
    const resultado = enTransaccion(() => {
        const { cantidad, monto } = prepare(`SELECT COUNT(*) AS cantidad, IFNULL(SUM(monto), 0) AS monto FROM ${filtro}`).get(...params);
        prepare(`UPDATE ${filtro.replace('transacciones WHERE', 'transacciones SET oculto_reporte = 1 WHERE')}`).run(...params);
        return { quitados: cantidad, monto };
    });
    res.json({ mensaje: "Gastos quitados del reporte", ...resultado, saldo: saldoDe(req.usuario.id) });
});

// Movimientos propios del periodo pedido (?mes, ?anio o ?dias), para exportar el reporte
app.get('/api/reportes/movimientos', (req, res) => {
    const f = filtroPeriodo(req, 't.fecha');
    res.json(prepare(`
        SELECT t.id, t.tipo, t.monto, t.descripcion, t.fecha, c.nombre AS categoria
        FROM transacciones t JOIN categorias c ON c.id = t.categoria_id
        WHERE t.usuario_id = ? ${f.cond}
        ORDER BY t.fecha DESC, t.id DESC LIMIT 2000`).all(req.usuario.id, ...f.params));
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
    if (!correoValido(correo)) return res.status(400).json({ error: "El formato del correo no es válido" });
    if (!contraseñaValida(contraseña)) return res.status(400).json({ error: REQUISITOS_CONTRASEÑA });
    const result = prepare(`INSERT INTO usuarios (nombre, correo, contraseña, rol, estado) VALUES (?, ?, ?, ?, 'activo')`)
        .run(nombre, correo, hashContraseña(contraseña), rol === 'admin' ? 'admin' : 'usuario');
    res.status(201).json({ mensaje: "Usuario creado", id: Number(result.lastInsertRowid) });
});

app.put('/api/admin/usuarios/:id', (req, res) => {
    const id = Number(req.params.id);
    const { nombre, correo, rol, contraseña } = req.body;
    if (!nombre || !correo) return res.status(400).json({ error: "Nombre y correo son obligatorios" });
    if (!correoValido(correo)) return res.status(400).json({ error: "El formato del correo no es válido" });
    if (contraseña && !contraseñaValida(contraseña)) return res.status(400).json({ error: REQUISITOS_CONTRASEÑA });
    if (id === req.usuario.id && rol !== 'admin') {
        return res.status(400).json({ error: "No puedes quitarte el rol de administrador a ti mismo" });
    }

    const result = prepare('UPDATE usuarios SET nombre = ?, correo = ?, rol = ? WHERE id = ?')
        .run(nombre, correo, rol === 'admin' ? 'admin' : 'usuario', id);
    if (result.changes === 0) return noEncontrado(res);
    if (contraseña) prepare('UPDATE usuarios SET contraseña = ? WHERE id = ?').run(hashContraseña(contraseña), id);
    res.json({ mensaje: "Usuario actualizado" });
});

// Usuario.cambiarEstado(): activo = puede iniciar sesión; inactivo = cuenta desactivada
app.put('/api/admin/usuarios/:id/estado', (req, res) => {
    const id = Number(req.params.id);
    const { estado } = req.body;
    if (!['activo', 'inactivo'].includes(estado)) return res.status(400).json({ error: "El estado debe ser activo o inactivo" });
    if (id === req.usuario.id) return res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });
    const result = prepare('UPDATE usuarios SET estado = ? WHERE id = ?').run(estado, id);
    if (result.changes === 0) return noEncontrado(res);
    // Sus sesiones abiertas se cierran en su siguiente petición (con el aviso de cuenta desactivada)
    res.json({ mensaje: estado === 'activo' ? "Cuenta activada" : "Cuenta desactivada" });
});

// Categorías globales (las que ven todos los usuarios)
const categoriaGlobal = (req) => prepare('SELECT * FROM categorias WHERE id = ? AND usuario_id IS NULL').get(req.params.id);

app.get('/api/admin/categorias', (req, res) => {
    res.json(prepare(`SELECT ${COLUMNAS_CATEGORIA}, (c.nombre = '${CATEGORIA_SISTEMA}') AS sistema
        FROM categorias c WHERE c.usuario_id IS NULL ORDER BY c.tipo DESC, c.id`).all());
});
app.post('/api/admin/categorias', (req, res) => crearCategoria(res, null, req.body));
app.put('/api/admin/categorias/:id', (req, res) => editarCategoria(res, categoriaGlobal(req), req.body));
app.put('/api/admin/categorias/:id/estado', (req, res) => cambiarEstadoCategoria(res, categoriaGlobal(req), req.body.estado));
app.delete('/api/admin/categorias/:id', (req, res) => eliminarCategoria(res, categoriaGlobal(req)));

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

// Metas del propio administrador (las de los usuarios solo las ve cada usuario). Mismas reglas de saldo.
app.get('/api/admin/metas', (req, res) => {
    res.json(prepare('SELECT * FROM metas WHERE usuario_id = ? ORDER BY fecha_limite').all(req.usuario.id));
});

app.post('/api/admin/metas', (req, res) => {
    const error = validarMeta(req.body);
    if (error) return res.status(400).json({ error });
    const id = crearMeta(req.usuario.id, req.body);
    res.status(201).json({ mensaje: "Meta creada", id, saldo: saldoDe(req.usuario.id) });
});

app.put('/api/admin/metas/:id', (req, res) => {
    const meta = metaPropia(req, req.params.id);
    if (!meta) return noEncontrado(res);
    const error = validarMeta(req.body, meta);
    if (error) return res.status(400).json({ error });
    actualizarMeta(req.usuario.id, meta, req.body);
    res.json({ mensaje: "Meta actualizada", saldo: saldoDe(req.usuario.id) });
});

app.delete('/api/admin/metas/:id', (req, res) => {
    const meta = metaPropia(req, req.params.id);
    if (!meta) return noEncontrado(res);
    const devuelto = eliminarMeta(meta);
    res.json({ mensaje: "Meta eliminada", devuelto, saldo: saldoDe(req.usuario.id) });
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
        FROM categorias c WHERE c.tipo = 'gasto' AND ${VISIBLE} ORDER BY c.id`).all(id, id, mes, id));
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
    if (err instanceof SaldoInsuficiente) {
        return res.status(400).json({ error: `No tienes saldo suficiente. Tu saldo disponible es $${Math.max(err.saldo, 0).toLocaleString('es-CO')}.`, saldo: err.saldo });
    }
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
