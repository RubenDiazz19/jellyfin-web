import globalize from 'lib/globalize';
import type { Show } from '../../../domain/models';
import { DetailRow } from './DetailSections';

type Props = {
    show: Partial<Pick<Show, 'creator' | 'directors' | 'studio' | 'country'>>;
};

/**
 * Filas de metadatos de producción (creador, director, estudio, país)
 * compartidas entre la ficha de la serie (ShowPage) y la ficha de temporada (SeasonPage).
 */
export function ShowMetadataRows({ show }: Props) {
    return (
        <>
            {show.creator && (
                <DetailRow label={globalize.translate('Creator')}>{show.creator}</DetailRow>
            )}
            {show.directors && (
                <DetailRow label={globalize.translate('Director')}>{show.directors}</DetailRow>
            )}
            {show.studio && (
                <DetailRow label={globalize.translate('Studio')}>{show.studio}</DetailRow>
            )}
            {show.country && (
                <DetailRow label={globalize.translate('Country')}>{show.country}</DetailRow>
            )}
        </>
    );
}
