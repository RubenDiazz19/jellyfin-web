// Quick Connect: entrar sin escribir la contraseña.
//
// El navegador le pide un código de seis caracteres al servidor y lo enseña; el
// usuario lo teclea en una sesión de Jellyfin donde ya está dentro —el móvil, la
// tele, el panel de administración— y aprueba desde ahí. El servidor da entonces
// por bueno el secreto que nos había dado al empezar, y con ese secreto se
// obtiene un token normal y corriente.
//
// Las peticiones de antes del token van sin sesión, porque todavía no la hay:
// el servidor identifica al que pide por la cabecera `MediaBrowser` que el SDK
// ya pone (nombre del cliente, dispositivo y su id). Es también lo que se le
// enseña al usuario al aprobar, y por eso el código es inútil para un tercero:
// autoriza a ESTE dispositivo, no a quien sepa el número.

import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';

import globalize from 'lib/globalize';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { setSessionDisplayName } from '../session/session';
import { connectTo, type AuthResult } from './auth';

/** Cada cuánto se le pregunta al servidor si ya han aprobado el código. */
const POLL_MS = 2000;

/**
 * Cuánto se espera antes de dar el código por muerto. El servidor lo caduca por
 * su cuenta (unos minutos); este tope es para no dejar el sondeo dando vueltas
 * si el usuario se olvida de la pestaña.
 */
const EXPIRY_MS = 5 * 60 * 1000;

/** Lo que hace falta para enseñar el código y esperar por él. */
export type QuickConnectRequest = { code: string; secret: string };

/** Si el administrador ha habilitado Quick Connect en este servidor. */
export async function isQuickConnectEnabled(serverUrl: string): Promise<boolean> {
    try {
        const apiClient = await connectTo(serverUrl);
        const { data } = await getAuthenticationApi(apiClient.api).getQuickConnectEnabled();
        return data === true;
    } catch {
        // Servidor inalcanzable, o tan antiguo que no conoce el endpoint: se
        // esconde el botón y queda el login de siempre.
        return false;
    }
}

/** Abre una petición de Quick Connect y devuelve el código a enseñar. */
export async function startQuickConnect(serverUrl: string): Promise<QuickConnectRequest> {
    const apiClient = await connectTo(serverUrl);
    const { data } = await getAuthenticationApi(apiClient.api).initiateQuickConnect();
    if (!data.Code || !data.Secret) {
        throw new Error(globalize.translate('MessageQuickConnectFailed'));
    }
    return { code: data.Code, secret: data.Secret };
}

/**
 * Espera a que aprueben el código, preguntando cada pocos segundos.
 *
 * El sondeo vive aquí y no en el ViewModel porque así se conecta una sola vez
 * al servidor para toda la espera. Devuelve false —sin lanzar— cuando se
 * cancela, cuando el código caduca o cuando el servidor deja de reconocerlo:
 * las tres acaban igual, volviendo al formulario.
 */
export async function waitForQuickConnect(
    serverUrl: string,
    secret: string,
    signal: AbortSignal
): Promise<boolean> {
    const apiClient = await connectTo(serverUrl);
    const authApi = getAuthenticationApi(apiClient.api);
    const deadline = Date.now() + EXPIRY_MS;

    while (Date.now() < deadline) {
        if (!(await waitOrAbort(POLL_MS, signal))) return false;
        try {
            const { data } = await authApi.getQuickConnectState({ secret });
            if (data.Authenticated) return true;
        } catch {
            // El servidor ya no conoce el secreto: el código ha caducado.
            return false;
        }
    }
    return false;
}

/**
 * Canjea un secreto ya aprobado por una sesión.
 *
 * Pasa por el ConnectionManager, igual que el login por contraseña: el token
 * queda persistido y la app se entera por el mismo evento, así que a partir de
 * aquí no hay nada que distinga esta sesión de una escrita a mano.
 */
export async function authenticateWithQuickConnect(
    serverUrl: string,
    secret: string
): Promise<AuthResult> {
    const apiClient = await connectTo(serverUrl);
    const auth = await ServerConnections.authenticateWithQuickConnect(apiClient, secret);
    const { AccessToken: accessToken, User: user, ServerId: serverId } = auth;
    if (!accessToken || !user?.Id) {
        throw new Error(globalize.translate('MessageNoSessionReturned'));
    }
    const displayName = user.Name ?? '';
    setSessionDisplayName(displayName);
    return { accessToken, userId: user.Id, serverId: serverId ?? '', displayName };
}

/** Duerme `ms`, o corta antes si se cancela. False = se ha cancelado. */
function waitOrAbort(ms: number, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
        const done = (ok: boolean) => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            resolve(ok);
        };
        const onAbort = () => { done(false); };
        const timer = setTimeout(() => { done(true); }, ms);
        signal.addEventListener('abort', onAbort);
    });
}
