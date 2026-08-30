// @ts-check
//
// Este fichero solo decide QUÉ se aplica y EN QUÉ ORDEN. Las reglas viven en
// eslint/, un módulo por dominio, porque en un solo fichero de 568 líneas no
// había forma de ver qué pisaba a qué.
//
// **El orden es la parte que importa**: en flat config gana lo último, así que
// cada bloque va de lo más general a lo más específico. Mover uno de sitio
// cambia el resultado aunque no se toque ninguna regla.
//
// Formateo: este proyecto NO usa Prettier. El estilo lo fija @stylistic desde
// eslint/style.mjs (indentación, comillas, comas, saltos, espaciado de JSX…) y
// se aplica con `bun run lint --fix`.
//
// La decisión es deliberada, no un pendiente: Prettier reformatearía sus
// propias reglas sobre las de @stylistic y habría que desactivar la mitad de
// ese bloque (eslint-config-prettier) para que no se peleen, con lo que se
// perdería el control fino que ya está afinado ahí — por ejemplo el operador
// ternario multilínea o el espaciado de los genéricos, que Prettier impone a
// su manera. Con un solo formateador hay una sola fuente de verdad y un solo
// comando en CI.
//
// Si algún día se cambia de idea: añadir prettier + eslint-config-prettier al
// final de la lista de configs, y borrar de eslint/style.mjs las reglas
// @stylistic puramente tipográficas.

import './ts6-compat.mjs';

// eslint-disable-next-line import/no-unresolved
import tseslint from 'typescript-eslint';

import app from './app.mjs';
import base from './base.mjs';
import frontend from './frontend.mjs';
import ignores from './ignores.mjs';
import legacy from './legacy.mjs';
import node from './node.mjs';
import react from './react.mjs';
import style from './style.mjs';

export default tseslint.config(
    // Recomendadas de cada plugin: el suelo sobre el que ajusta todo lo demás.
    ...base,
    // Rutas que no se miran nunca.
    ...ignores,
    // Estilo y corrección, para todo el repo.
    ...style,
    // Ficheros de configuración del propio repo (fuera de src/).
    ...node,
    // El código de la aplicación.
    ...app,
    // Solo los ficheros con JSX.
    ...react,
    // El frontend propio: fronteras MVVM y sus relajaciones.
    ...frontend,
    // Va el ÚLTIMO a propósito: apaga reglas para el JS heredado, así que
    // tiene que poder pisar cualquier cosa que hayan encendido los de arriba.
    ...legacy
);
