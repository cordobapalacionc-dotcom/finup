-- Base de datos FinanzasApp para SQLite
-- Migrada desde finanzas_app (3).sql (MySQL/MariaDB).
-- Usuario inicial: un solo administrador.
--   correo:     admin@finanzas.com
--   contraseña: Admin123
-- Se siembra como SHA-256 (formato antiguo); el backend la convierte a scrypt
-- en el primer inicio de sesión. Las contraseñas nuevas se guardan con scrypt.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  correo         TEXT NOT NULL UNIQUE,
  contraseña     TEXT NOT NULL,
  rol            TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin','usuario')),
  estado         TEXT NOT NULL DEFAULT 'inactivo' CHECK (estado IN ('activo','inactivo')),
  fecha_registro TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo   TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto'))
);

CREATE TABLE IF NOT EXISTS transacciones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  monto        REAL NOT NULL,
  descripcion  TEXT,
  fecha        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS fk_trans_usuario   ON transacciones(usuario_id);
CREATE INDEX IF NOT EXISTS fk_trans_categoria ON transacciones(categoria_id);

CREATE TABLE IF NOT EXISTS historial_cambios (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  transaccion_id       INTEGER NOT NULL,
  usuario_id           INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  monto_anterior       REAL,
  monto_nuevo          REAL,
  descripcion_anterior TEXT,
  descripcion_nueva    TEXT,
  tipo_operacion       TEXT NOT NULL CHECK (tipo_operacion IN ('UPDATE','DELETE')),
  fecha_accion         TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS fk_historial_usuario ON historial_cambios(usuario_id);

CREATE TABLE IF NOT EXISTS metas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  monto_objetivo REAL NOT NULL,
  monto_actual   REAL NOT NULL DEFAULT 0,
  fecha_limite   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fk_metas_usuario ON metas(usuario_id);

CREATE TABLE IF NOT EXISTS presupuestos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  monto_actual REAL NOT NULL,
  monto_limite REAL NOT NULL,
  periodo      TEXT NOT NULL CHECK (periodo IN ('mensual','semanal'))
);
CREATE INDEX IF NOT EXISTS fk_pres_usuario   ON presupuestos(usuario_id);
CREATE INDEX IF NOT EXISTS fk_pres_categoria ON presupuestos(categoria_id);

CREATE TABLE IF NOT EXISTS reportes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,
  fecha_generado TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  datos          TEXT -- foto en JSON de los totales en el momento de generarlo
);
CREATE INDEX IF NOT EXISTS fk_reportes_usuario ON reportes(usuario_id);

CREATE TABLE IF NOT EXISTS sesiones (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token            TEXT NOT NULL,
  fecha_inicio     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  fecha_expiracion TEXT
);
CREATE INDEX IF NOT EXISTS fk_sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE IF NOT EXISTS transacciones_recurrentes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  monto        REAL NOT NULL,
  pago         REAL NOT NULL,
  pagado       INTEGER DEFAULT 0,
  frecuencia   TEXT NOT NULL CHECK (frecuencia IN ('diario','semanal','mensual','anual')),
  fecha_inicio TEXT NOT NULL,
  descripcion  TEXT
);
CREATE INDEX IF NOT EXISTS fk_recurrente_usuario   ON transacciones_recurrentes(usuario_id);
CREATE INDEX IF NOT EXISTS fk_recurrente_categoria ON transacciones_recurrentes(categoria_id);

-- Triggers de historial (iguales a los de MySQL).
-- El trigger tg_usuarios_hash_pass no existe en SQLite (no tiene SHA2):
-- el backend hashea la contraseña antes de guardarla.
CREATE TRIGGER IF NOT EXISTS tg_historial_delete BEFORE DELETE ON transacciones
BEGIN
  INSERT INTO historial_cambios (transaccion_id, usuario_id, monto_anterior, monto_nuevo, descripcion_anterior, descripcion_nueva, tipo_operacion)
  VALUES (OLD.id, OLD.usuario_id, OLD.monto, NULL, OLD.descripcion, NULL, 'DELETE');
END;

CREATE TRIGGER IF NOT EXISTS tg_historial_update AFTER UPDATE ON transacciones
BEGIN
  INSERT INTO historial_cambios (transaccion_id, usuario_id, monto_anterior, monto_nuevo, descripcion_anterior, descripcion_nueva, tipo_operacion)
  VALUES (OLD.id, OLD.usuario_id, OLD.monto, NEW.monto, OLD.descripcion, NEW.descripcion, 'UPDATE');
END;

-- Datos iniciales
INSERT OR IGNORE INTO categorias (id, nombre, tipo) VALUES
(1, 'Sueldo', 'ingreso'),
(2, 'Freelance', 'ingreso'),
(3, 'Alimentación', 'gasto'),
(4, 'Transporte', 'gasto'),
(5, 'Entretenimiento', 'gasto'),
(6, 'Servicios', 'gasto'),
(7, 'Salud', 'gasto'),
(8, 'Educación', 'gasto'),
(9, 'Otros gastos', 'gasto'),
(10, 'Otros ingresos', 'ingreso');

-- Único administrador. SHA-256 de 'Admin123'.
INSERT OR IGNORE INTO usuarios (id, nombre, correo, contraseña, rol, estado) VALUES
(1, 'Administrador', 'admin@finanzas.com', '3b612c75a7b5048a435fb6ec81e52ff92d6d795a8b5a9c17070f6a63c97a53b2', 'admin', 'inactivo');
