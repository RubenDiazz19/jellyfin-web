// Fachada de la API para las vistas de administración (AdminPanel, editor de
// metadatos, MoreButton). Esas vistas son herramientas de gestión sin
// ViewModel propio; acceden al Model por esta fachada para respetar la regla
// "presentation no importa de data/".

export * from '../data/api';
