// Barra interactiva de filtros de valoración por estrellas con operadores y presets numéricos.

import { Fragment, useState } from 'react';
import {
    searchVM,
    type RatingFilter,
    type RatingOperator
} from '../../../domain/viewModels/SearchViewModel';
import { AddFilterButton, CollapsibleOptionPill } from './SearchPills';

export const RATING_OPERATORS: { id: RatingOperator; symbol: string }[] = [
    { id: '>=', symbol: '≥' },
    { id: '>', symbol: '>' },
    { id: '<=', symbol: '≤' },
    { id: '<', symbol: '<' },
    { id: '=', symbol: '=' }
];

export const PRESETS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];

export function RatingFilterBar() {
    const filters = searchVM.ratingFilters.value;
    const [isAdding, setIsAdding] = useState(false);
    const totalCount = filters.length + (isAdding ? 1 : 0);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'nowrap'
        }}>
            {filters.length === 0 ? (
                <RatingFilterItem
                    index={0}
                    filter={null}
                    totalFilters={1}
                    onComplete={() => setIsAdding(false)}
                />
            ) : (
                filters.map((f, i) => (
                    <Fragment key={i}>
                        {i > 0 && (
                            <div style={{
                                width: 1,
                                height: 16,
                                background: 'rgba(255,255,255,0.22)',
                                flexShrink: 0,
                                margin: '0 6px'
                            }} />
                        )}
                        <RatingFilterItem
                            index={i}
                            filter={f}
                            totalFilters={totalCount}
                        />
                    </Fragment>
                ))
            )}

            {filters.length > 0 && isAdding && (
                <>
                    <div style={{
                        width: 1,
                        height: 16,
                        background: 'rgba(255,255,255,0.22)',
                        flexShrink: 0,
                        margin: '0 6px'
                    }} />
                    <RatingFilterItem
                        index={filters.length}
                        filter={null}
                        totalFilters={totalCount}
                        onComplete={() => setIsAdding(false)}
                    />
                </>
            )}

            {filters.length > 0 && !isAdding && (
                <AddFilterButton
                    onClick={() => setIsAdding(true)}
                    title='Añadir otro filtro de valoración'
                />
            )}
        </div>
    );
}

function RatingFilterItem({
    index,
    filter,
    totalFilters,
    onComplete
}: {
    index: number;
    filter: RatingFilter | null;
    totalFilters: number;
    onComplete?: () => void;
}) {
    const [selectedOp, setSelectedOp] = useState<RatingOperator>(filter?.operator ?? '>=');
    const [isOpExpanded, setIsOpExpanded] = useState(filter === null);
    const [isPresetExpanded, setIsPresetExpanded] = useState(filter === null);

    const currentOp = filter?.operator ?? selectedOp;
    const opCollapsed = filter !== null && !isOpExpanded;
    const presetCollapsed = filter !== null && !isPresetExpanded;
    const showInternalDivider = filter === null || totalFilters === 1;

    const handleOpClick = (op: RatingOperator) => {
        if (opCollapsed) {
            setIsOpExpanded(true);
        } else {
            setSelectedOp(op);
            if (filter !== null) {
                searchVM.setRatingFilter(op, filter.value, index);
            }
            setIsOpExpanded(false);
        }
    };

    const handlePresetClick = (val: number) => {
        if (presetCollapsed) {
            setIsPresetExpanded(true);
        } else if (filter !== null && filter.value === val) {
            searchVM.removeRatingFilter(index);
            setIsPresetExpanded(true);
        } else {
            searchVM.setRatingFilter(currentOp, val, index);
            setIsPresetExpanded(false);
            if (onComplete) {
                onComplete();
            }
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: showInternalDivider ? 0 : 4,
            flexWrap: 'nowrap'
        }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {RATING_OPERATORS.map((op) => {
                    const selected = filter !== null ? filter.operator === op.id : selectedOp === op.id;
                    return (
                        <CollapsibleOptionPill
                            key={op.id}
                            label={op.symbol}
                            selected={selected}
                            collapsed={opCollapsed}
                            onClick={() => handleOpClick(op.id)}
                        />
                    );
                })}
            </div>

            {showInternalDivider && (
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.18)', flexShrink: 0, margin: '0 6px' }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center' }}>
                {PRESETS.map((p) => {
                    const selected = filter !== null && filter.value === p;
                    return (
                        <CollapsibleOptionPill
                            key={p}
                            label={`★ ${p}`}
                            selected={selected}
                            collapsed={presetCollapsed}
                            onClick={() => handlePresetClick(p)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
