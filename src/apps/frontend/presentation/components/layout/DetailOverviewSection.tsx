import type { ReactNode } from 'react';
import globalize from 'lib/globalize';
import type { CastMember } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { CastList } from '../cast/CastList';
import { SynopsisText } from './SynopsisText';

type Props = {
    synopsis?: string | null;
    label?: string;
    cast?: CastMember[];
    castLabel?: string;
    navigate: Navigate;
    children?: ReactNode;
};

/**
 * Columna izquierda común de la vista de detalle: sinopsis + reparto + contenido opcional.
 */
export function DetailOverviewSection({
    synopsis,
    label = globalize.translate('Overview'),
    cast,
    castLabel,
    navigate,
    children
}: Props) {
    return (
        <div>
            <SynopsisText label={label} text={synopsis} />
            {cast && cast.length > 0 && (
                <div style={{ marginTop: 48 }}>
                    <CastList cast={cast} navigate={navigate} label={castLabel} />
                </div>
            )}
            {children}
        </div>
    );
}
