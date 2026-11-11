<!--
  Icono de línea (Lucide) que reemplaza a los emojis en toda la app.
  Uso: <Icono nombre="papelera" />  ·  toma el color y el tamaño del texto que lo rodea.
  Solo se importan los iconos de esta lista para no cargar la librería completa.
-->
<template>
  <component :is="componente" class="icono-svg" :size="tamano" :stroke-width="grosor" aria-hidden="true" />
</template>

<script setup>
import { computed } from 'vue';
import {
  House, Users, Tag, Wallet, ChartColumn, Target, Settings, CircleUser, Lock, Palette, Sun, Moon,
  TriangleAlert, FolderOpen, Trash2, Pencil, Plus, CalendarDays, FileText, Download, Scale,
  TrendingUp, TrendingDown, Sparkles, Banknote, Lightbulb, CircleCheck, CircleX, PartyPopper,
  Search, Pause, Play, ClipboardList, PiggyBank, HandCoins, Briefcase, Laptop, ShoppingCart, Car,
  Clapperboard, HeartPulse, GraduationCap, Package, Utensils, Coins, ArrowDownToLine, CalendarClock
} from 'lucide-vue-next';

const ICONOS = {
  inicio: House, usuarios: Users, categoria: Tag, finanzas: Wallet, reportes: ChartColumn,
  metas: Target, configuracion: Settings, usuario: CircleUser, candado: Lock, paleta: Palette,
  sol: Sun, luna: Moon, alerta: TriangleAlert, carpeta: FolderOpen, papelera: Trash2,
  editar: Pencil, agregar: Plus, calendario: CalendarDays, documento: FileText, descargar: Download,
  balance: Scale, ingreso: TrendingUp, gasto: TrendingDown, destello: Sparkles, billete: Banknote,
  idea: Lightbulb, ok: CircleCheck, error: CircleX, celebrar: PartyPopper, buscar: Search,
  pausa: Pause, activar: Play, lista: ClipboardList, alcancia: PiggyBank, abonar: HandCoins,
  sacar: ArrowDownToLine, programar: CalendarClock, monedas: Coins,
  // Categorías
  sueldo: Briefcase, freelance: Laptop, mercado: ShoppingCart, transporte: Car,
  entretenimiento: Clapperboard, salud: HeartPulse, educacion: GraduationCap, paquete: Package,
  comida: Utensils, servicios: Lightbulb
};

const props = defineProps({
  nombre: { type: String, required: true },
  tamano: { type: [String, Number], default: '1.1em' },
  grosor: { type: [String, Number], default: 2 }
});

const componente = computed(() => ICONOS[props.nombre] || Tag);
</script>

<style>
/* Global: el icono se alinea con el texto en cualquier pantalla */
.icono-svg {
  display: inline-block;
  vertical-align: -0.18em;
  flex-shrink: 0;
}
</style>
