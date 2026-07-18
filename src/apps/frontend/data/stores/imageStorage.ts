// Almacén de imágenes personalizadas (backdrop/póster subidos por el usuario).
// Se guardan en localStorage como data URLs, indexadas por clave arbitraria.

export function getImage(key: string): string | null {
    try {
        return localStorage.getItem(`img_${key}`);
    } catch {
        return null;
    }
}

export function setImage(key: string, dataUrl: string) {
    try {
        localStorage.setItem(`img_${key}`, dataUrl);
    } catch {
    // Cuota agotada — silencioso, igual que en el prototipo original.
    }
}
