import Module from 'node:module';

// typescript-eslint 8.x requiere la API JS del compilador (TypeScript 6).
// Con TypeScript 7 (compilador nativo en Go), el paquete de compatibilidad
// 'typescript6' suministra dicha API mientras el ecosistema finaliza la migración a TS >=7.1.
// @ts-expect-error Module._load is internal
const origLoad = Module._load;
// @ts-expect-error Module._load is internal
Module._load = function (request, parent, isMain) {
    if (request === 'typescript') {
        return origLoad.call(this, 'typescript6', parent, isMain);
    }
    return origLoad.apply(this, arguments);
};
