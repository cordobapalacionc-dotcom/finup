<template>
  <router-view />
</template>

<style>
/* Paleta del panel de administrador. Tiene que estar aquí (global): dentro de un
   <style scoped> el selector :root no se aplica y las variables no existirían. */
:root {
  --bg-main: #f0f4f8;
  --sidebar-dark: #0a1a1f;
  --sidebar-light: #122326;
  --primary-green: #2dbb73;
  --primary-dark: #1a8a4a;
  --card-white: #ffffff;
  --danger-red: #e53e3e;
  --danger-dark: #c53030;
  --warning-yellow: #f59e0b;
  --info-blue: #3b82f6;
  --purple: #8b5cf6;
  --gray-text: #6b7280;
  --gray-light: #e5e7eb;
  --gray-bg: #f9fafb;
}

/* Estilos básicos para que no haya márgenes raros */
body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

/* Un solo tipo de letra en toda la aplicación (se carga en index.html) */
body {
  font-family: 'Poppins', sans-serif;
}

h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label,
button, input, select, textarea {
  font-family: inherit;
}

/* --- TEMA OSCURO ---
   Cada pantalla tiene sus colores escritos a mano, así que el tema oscuro invierte
   la página entera y vuelve a invertir lo que ya es oscuro (menús laterales) y las
   imágenes, para que queden con sus colores originales. */
html {
  background: #ffffff;
  transition: filter 0.2s ease;
}

html.tema-oscuro {
  filter: invert(1) hue-rotate(180deg);
}

html.tema-oscuro .sidebar,
html.tema-oscuro img,
html.tema-oscuro video,
html.tema-oscuro .no-invertir {
  filter: invert(1) hue-rotate(180deg);
}

/* Imágenes dentro del menú lateral: ya quedan bien con la inversión del menú */
html.tema-oscuro .sidebar img {
  filter: none;
}

/* Tarjetas en verde muy oscuro en vez de negro puro.
   Con la inversión, #c8e2d6 se ve como #102a1e. */
html.tema-oscuro :is(
  .card, .stat-card, .tabla, .chart-container, .grafica, .grafica-full,
  .presupuesto-section, .metas-section, .tabla-movimientos, .chart-section,
  .recientes-section, .categorias-section, .dona-section, .modal-content,
  .saldo-box, .table-container, .welcome-banner, .goals-section,
  .payments-section, .payment-card, .goal-card-container, .container
) {
  background: #c8e2d6 !important;
}

/* Las sombras negras se verían como brillos blancos al invertir */
html.tema-oscuro * {
  box-shadow: none !important;
}
</style>
