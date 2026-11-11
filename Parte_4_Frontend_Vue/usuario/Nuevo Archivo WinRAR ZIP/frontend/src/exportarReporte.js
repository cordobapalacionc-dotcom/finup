// CU-06 · Exportar reporte (PDF/Excel): ReporteFinanciero.exportar(formato).
// Las librerías se cargan solo al exportar, para no hacer más pesada la carga de la página.
//
// datos = {
//   titulo, periodo (texto), archivo (nombre corto para el archivo, opcional), usuario,
//   ingresos, gastos, transacciones,
//   categorias: [{ nombre, monto, porcentaje }],
//   serie: [{ label, ingresos, gastos }],
//   movimientos: [{ fecha, tipo, categoria, descripcion, monto }]
// }

import { moneda, fechaCorta } from './api'

const nombreArchivo = (datos, extension) => {
  const limpio = String(datos.archivo || datos.periodo || 'reporte')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `Reporte_FinUp_${limpio}.${extension}`
}

// ReporteFinanciero.validarExportacion()
const validar = (datos) => {
  if (!datos || typeof datos.ingresos !== 'number' || typeof datos.gastos !== 'number') {
    throw new Error('No hay datos del reporte para exportar')
  }
}

const exportarPDF = async (datos) => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF()
  const verde = [45, 187, 115]
  const balance = datos.ingresos - datos.gastos

  doc.setFontSize(18)
  doc.setTextColor(...verde)
  doc.text(datos.titulo || 'Reporte financiero', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(`Periodo: ${datos.periodo}`, 14, 26)
  doc.text(`Usuario: ${datos.usuario || ''}`, 14, 31)
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 36)

  const estilo = { headStyles: { fillColor: verde }, styles: { fontSize: 9 }, margin: { left: 14, right: 14 } }

  autoTable(doc, {
    ...estilo,
    startY: 42,
    head: [['Ingresos', 'Gastos', 'Balance', 'Movimientos']],
    body: [[moneda(datos.ingresos), moneda(datos.gastos), (balance < 0 ? '-' : '') + moneda(Math.abs(balance)), String(datos.transacciones ?? datos.movimientos?.length ?? 0)]]
  })

  const siguiente = () => doc.lastAutoTable.finalY + 10
  const subtitulo = (texto) => {
    doc.setFontSize(12)
    doc.setTextColor(30)
    doc.text(texto, 14, siguiente() - 3)
  }

  subtitulo('Gastos por categoría')
  autoTable(doc, {
    ...estilo,
    startY: siguiente(),
    head: [['Categoría', 'Monto', '%']],
    body: datos.categorias.length
      ? datos.categorias.map((c) => [c.nombre, moneda(c.monto), `${c.porcentaje}%`])
      : [['Sin gastos en este periodo', '', '']]
  })

  if (datos.serie?.length) {
    subtitulo('Ingresos vs gastos')
    autoTable(doc, {
      ...estilo,
      startY: siguiente(),
      head: [['Periodo', 'Ingresos', 'Gastos']],
      body: datos.serie.map((g) => [g.label, moneda(g.ingresos), moneda(g.gastos)])
    })
  }

  subtitulo('Movimientos')
  autoTable(doc, {
    ...estilo,
    startY: siguiente(),
    head: [['Fecha', 'Tipo', 'Categoría', 'Detalle', 'Monto']],
    body: datos.movimientos.length
      ? datos.movimientos.map((m) => [fechaCorta(m.fecha), m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', m.categoria, m.descripcion || '', (m.tipo === 'ingreso' ? '+' : '-') + moneda(m.monto)])
      : [['Sin movimientos en este periodo', '', '', '', '']]
  })

  doc.save(nombreArchivo(datos, 'pdf'))
}

const exportarExcel = async (datos) => {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const titulo = (valor) => ({ value: valor, fontWeight: 'bold', backgroundColor: '#2dbb73', textColor: '#ffffff' })
  const numero = (valor) => ({ value: Number(valor) || 0, type: Number, format: '#,##0' })

  const resumen = [
    [{ value: datos.titulo || 'Reporte financiero', fontWeight: 'bold', fontSize: 14 }],
    ['Periodo', datos.periodo],
    ['Usuario', datos.usuario || ''],
    ['Generado', new Date().toLocaleString('es-CO')],
    [],
    [titulo('Concepto'), titulo('Valor')],
    ['Ingresos', numero(datos.ingresos)],
    ['Gastos', numero(datos.gastos)],
    ['Balance', numero(datos.ingresos - datos.gastos)],
    ['Movimientos', numero(datos.transacciones ?? datos.movimientos.length)],
    [],
    [titulo('Categoría'), titulo('Gasto'), titulo('%')],
    ...datos.categorias.map((c) => [c.nombre, numero(c.monto), numero(c.porcentaje)])
  ]

  const serie = [
    [titulo('Periodo'), titulo('Ingresos'), titulo('Gastos')],
    ...(datos.serie || []).map((g) => [g.label, numero(g.ingresos), numero(g.gastos)])
  ]

  const movimientos = [
    [titulo('Fecha'), titulo('Tipo'), titulo('Categoría'), titulo('Detalle'), titulo('Monto')],
    ...datos.movimientos.map((m) => [
      fechaCorta(m.fecha),
      m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      m.categoria,
      m.descripcion || '',
      numero(m.tipo === 'ingreso' ? m.monto : -m.monto)
    ])
  ]

  await writeXlsxFile([
    { sheet: 'Resumen', data: resumen, columns: [{ width: 28 }, { width: 18 }, { width: 8 }] },
    { sheet: 'Ingresos vs gastos', data: serie, columns: [{ width: 14 }, { width: 16 }, { width: 16 }] },
    { sheet: 'Movimientos', data: movimientos, columns: [{ width: 12 }, { width: 10 }, { width: 20 }, { width: 32 }, { width: 16 }] }
  ]).toFile(nombreArchivo(datos, 'xlsx'))
}

// Genera el archivo y lo descarga. Si algo falla lanza un Error con un mensaje para mostrar.
export const exportarReporte = async (formato, datos) => {
  try {
    validar(datos)
    if (formato === 'pdf') await exportarPDF(datos)
    else if (formato === 'excel') await exportarExcel(datos)
    else throw new Error('Formato no soportado')
  } catch (e) {
    console.error(e)
    throw new Error(`No se pudo generar el archivo ${formato === 'pdf' ? 'PDF' : 'Excel'}: ${e.message}`)
  }
}
