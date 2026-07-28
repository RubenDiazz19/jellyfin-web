// Salto al dashboard embebido (apps/dashboard), que vive en la misma SPA
// bajo /dashboard. La página lo resuelve con useNavigate y lo baja a las
// secciones para que no dependan del router.
export type GoDashboard = (sub?: string) => void;

export type SectionId = 'perfil' | 'reproduccion' | 'subtitulos' | 'bibliotecas' | 'servidor' | 'usuarios';

// En móvil hay una sección extra (tema M3) que en desktop no existe.
export type MobileSectionId = SectionId | 'apariencia';
