import globalize from 'lib/globalize';

import { useEffect } from 'react';
import ReactDOM from 'react-dom';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useSignalValue } from '../../../domain/bridge/useViewModel';
import { tasksVM } from '../../../domain/viewModels/TasksViewModel';
import type { BackgroundTask } from '../../../domain/api';

/**
 * Lo que el servidor está procesando, mientras dure.
 *
 * Escanear una biblioteca contesta al instante y tarda minutos, así que sin
 * esto lo único que veía el usuario era un aviso de «empezado» y después nada:
 * ni si sigue, ni cuánto queda, ni si merece la pena esperar. Aquí abajo se ve
 * qué corre y por dónde va.
 *
 * Se monta una sola vez y a nivel de app —no dentro de Ajustes— porque el
 * escaneo sigue en marcha aunque el usuario se vaya a otra pantalla, que es
 * justo lo que hace mientras espera.
 */
export function TaskProgress() {
    const tasks = useSignalValue(tasksVM.active);
    const r = useResponsive();

    useEffect(() => { tasksVM.start(); }, []);

    if (tasks.length === 0) return null;

    return ReactDOM.createPortal(
        <div
            aria-live='polite'
            style={{
                position: 'fixed', zIndex: 9998,
                left: r.touch ? 12 : 24,
                right: r.touch ? 12 : 'auto',
                // En móvil la navegación inferior ocupa la franja de abajo.
                bottom: r.touch ? 'calc(84px + env(safe-area-inset-bottom, 0px))' : 24,
                width: r.touch ? 'auto' : 320,
                display: 'flex', flexDirection: 'column', gap: 10,
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(18,18,20,0.94)', backdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
                fontFamily: T.ui, color: '#fff'
            }}
        >
            <div style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
            }}>
                {globalize.translate('HeaderRunningTasks')}
            </div>
            {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
        </div>,
        document.body
    );
}

function TaskRow({ task }: { task: BackgroundTask }) {
    const pct = task.progress;
    return (
        <div>
            <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, fontSize: 13
            }}>
                <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                    {task.name || globalize.translate('MessageRefreshQueued')}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: T.dim }}>
                    {pct === null ? '' : `${Math.round(pct)}%`}
                </span>
            </div>
            <div style={{
                height: 3, borderRadius: 999, overflow: 'hidden',
                background: 'rgba(255,255,255,0.14)'
            }}>
                {/*
                    Sin porcentaje se pinta una barra que va y viene: el
                    servidor aún no ha dicho cuánto queda, y una barra vacía
                    parecería que no ha arrancado.
                */}
                <div
                    className={pct === null ? 'jfp-task-indeterminate' : undefined}
                    style={{
                        height: '100%', borderRadius: 999, background: '#fff',
                        width: pct === null ? '35%' : `${Math.max(2, Math.min(100, pct))}%`,
                        transition: pct === null ? undefined : 'width .4s ease'
                    }}
                />
            </div>
        </div>
    );
}
