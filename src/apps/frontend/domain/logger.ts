// Re-exporta el logger centralizado en la capa de domain.
// Permite a los ViewModels y la capa de presentación importar domain/logger.

export { createLogger, logger, type Logger, type LogLevel } from '../shared/logger';
