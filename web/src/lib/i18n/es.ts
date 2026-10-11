import type { Messages } from "./types";

/**
 * Spanish dictionary — DragonJAR voice: tuteo, direct, technical senior.
 * Technical terms stay in English (dashboard, tokens, prompt, model, tool...).
 * Must match the EN dictionary key-for-key (enforced by `Messages`).
 */
export const es: Messages = {
  /* app */
  "app.name": "OpenCode Hub",

  /* navigation */
  "nav.dashboard": "Dashboard",
  "nav.sessions": "Sessions",
  "nav.commands": "Commands",
  "nav.aria": "Navegación principal",

  /* sidebar */
  "sidebar.version": "v2",

  /* common */
  "common.retry": "Reintentar",
  "common.delete": "Eliminar",
  "common.deleting": "Eliminando...",
  "common.loading": "Cargando...",
  "common.untitled": "Sin título",

  /* topbar */
  "topbar.connected": "Conectado",
  "topbar.offline": "Sin conexión",
  "topbar.checking": "Verificando...",
  "topbar.version": "OpenCode v{version}",
  "topbar.themeToggle": "Cambiar tema",
  "topbar.languageToggle": "Idioma",

  /* dashboard */
  "dashboard.subtitle.range": "Últimos 12 meses",
  "dashboard.subtitle.updated": "actualizado {relative}",
  "dashboard.stats.tokens": "Tokens",
  "dashboard.stats.cost": "Costo est.",
  "dashboard.stats.sessions": "Sesiones",
  "dashboard.stats.prompts": "Prompts",
  "dashboard.stats.activeDays": "Días activos",
  "dashboard.stats.streak": "Racha",
  "dashboard.stats.streakUnit": "d",
  "dashboard.stats.inOut": "in {input} · out {output}",
  "dashboard.stats.usd": "USD",
  "dashboard.chart.title": "Uso por mes",
  "dashboard.chart.tokens": "tokens",
  "dashboard.chart.cost": "costo (USD)",
  "dashboard.chart.noCost": "Ningún modelo upstream reporta costo.",
  "dashboard.chart.empty": "Todavía no hay uso registrado",
  "dashboard.models.title": "Modelos por uso",
  "dashboard.models.model": "Modelo",
  "dashboard.models.steps": "Pasos",
  "dashboard.models.tokens": "Tokens",
  "dashboard.models.cost": "Costo",
  "dashboard.models.share": "{share}% de los tokens",
  "dashboard.models.empty": "No hay uso registrado por modelo",
  "dashboard.activity.title": "Actividad",
  "dashboard.activity.total": "{steps} pasos · 90 d",
  "dashboard.activity.today": "hoy",
  "dashboard.activity.day": "{date} · {steps} pasos",
  "dashboard.recent.title": "Sesiones recientes",
  "dashboard.recent.viewAll": "Ver todas",
  "dashboard.recent.empty": "Todavía no hay sesiones",
  "dashboard.recent.emptyHint": "Las sesiones aparecen aquí cuando chateas.",

  /* sessions */
  "sessions.count": "{shown} de {total} sesiones",
  "sessions.filter": "Filtrar por título / id / modelo...",
  "sessions.new": "Nueva sesión",
  "sessions.creating": "Creando...",
  "sessions.col.title": "Título",
  "sessions.col.model": "Modelo",
  "sessions.col.tokens": "Tokens",
  "sessions.col.cost": "Costo",
  "sessions.col.created": "Creada",
  "sessions.confirmDelete": "¿Eliminar la sesión «{label}»? No se puede deshacer.",
  "sessions.empty.filterTitle": "Ninguna sesión coincide con el filtro",
  "sessions.empty.filterHint": "Prueba con otro término.",
  "sessions.empty.title": "Todavía no hay sesiones",
  "sessions.empty.hint": "Crea una para empezar.",

  /* chat */
  "chat.back": "Sessions",
  "chat.defaultTitle": "Sesión",
  "chat.missingId": "Falta el id de la sesión",
  "chat.confirmDelete": "¿Eliminar esta sesión? No se puede deshacer.",
  "chat.empty.title": "Todavía no hay mensajes",
  "chat.empty.hint": "Envía el prompt abajo para empezar.",
  "chat.reasoning": "Razonamiento",
  "chat.reasoning.empty": "(sin razonamiento)",
  "chat.tool.default": "tool",
  "chat.part.default": "parte",
  "chat.user.empty": "(vacío)",
  "chat.assistant.empty": "(sin contenido)",
  "chat.meta.in": "in {tokens}",
  "chat.meta.out": "out {tokens}",
  "chat.placeholder": "Escribe un mensaje",
  "chat.placeholderPending": "El asistente está trabajando...",
  "chat.send": "Enviar",
  "chat.sending": "Enviando...",
  "chat.interrupt": "Interrumpir",
  "chat.interruptHint": "Esc",
  "chat.interrupting": "Deteniendo...",
  "chat.waiting": "esperando al asistente...",
  "chat.model.default": "modelo por defecto de la sesión",
  "chat.ctrlEnter": "Envía el prompt con Ctrl/⌘+Enter",

  /* commands */
  "commands.count": "{count} comandos slash disponibles",
  "commands.filter": "Filtrar comandos...",
  "commands.source.global": "global",
  "commands.source.project": "proyecto",
  "commands.agent": "agent: {agent}",
  "commands.showLess": "Ver menos",
  "commands.showAll": "Ver las {count} líneas",
  "commands.empty.filterTitle": "Ningún comando coincide con el filtro",
  "commands.empty.filterHint": "Prueba con otro término.",
  "commands.empty.title": "No hay comandos registrados",
  "commands.empty.hint":
    "Los comandos SDD (sdd-init, sdd-propose, ...) aparecen al sincronizarse con opencode.",
};
