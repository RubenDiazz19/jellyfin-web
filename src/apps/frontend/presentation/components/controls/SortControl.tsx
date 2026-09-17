import { useRef, useState } from 'react';
import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { PopupPanel } from './PopupPanel';
import { MenuEntry } from './MenuEntry';
import { BottomSheet } from '../m3/BottomSheet';
import type { SortKey } from '../../../data/stores/librarySortStore';

type SearchSortKey = 'relevance' | SortKey;

export function SortControl({ value, onChange, options }: { value: any; onChange: (k: any) => void; options: { id: string, key: string }[] }) {
    const r = useResponsive();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top?: number; bottom?: number; right?: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        if (!r.touch && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const dropUp = rect.bottom + 220 > window.innerHeight;
            setPos({
                top: dropUp ? undefined : rect.bottom + 6,
                bottom: dropUp ? window.innerHeight - rect.top + 6 : undefined,
                right: Math.max(12, window.innerWidth - rect.right)
            });
        }
        setOpen(true);
    };

    return (
        <div style={{
            position: 'relative',
            display: 'inline-flex',
            animation: 'jfpPillsFadeIn 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both'
        }}>
            <button
                ref={btnRef}
                type='button'
                onClick={toggle}
                onMouseDown={(e) => e.preventDefault()}
                aria-haspopup='menu'
                aria-expanded={open}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                    color: open ? '#fff' : T.dim,
                    border: open ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                    boxShadow: open ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
                    fontFamily: T.ui,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease, transform .2s ease',
                    whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                    if (!open) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!open) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.color = T.dim;
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.transform = 'scale(1)';
                    }
                }}
            >
                <span>{globalize.translate('SortByLabel')}</span>
                <svg
                    width='10'
                    height='6'
                    viewBox='0 0 10 6'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.8'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    style={{
                        transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease',
                        transform: open ? 'rotate(180deg)' : 'none',
                        opacity: open ? 1 : 0.6
                    }}
                >
                    <path d='M1 1L5 5L9 1' />
                </svg>
            </button>

            {!r.touch && (
                <PopupPanel
                    open={open}
                    onClose={() => setOpen(false)}
                    position={pos}
                    minWidth={160}
                    style={{
                        animation: 'jfpPillsFadeIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.55)'
                    }}
                >
                    {options.map((s, index) => {
                        const isSelected = s.id === value;
                        return (
                            <MenuEntry
                                key={s.id}
                                onClick={() => {
                                    onChange(s.id);
                                    setOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontWeight: isSelected ? 600 : 400,
                                    color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                                    background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    borderRadius: 8,
                                    animation: 'jfpSubPillIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                                    animationDelay: `${index * 25}ms`
                                }}
                            >
                                <span>{globalize.translate(s.key)}</span>
                                {isSelected && (
                                    <svg
                                        width='13'
                                        height='13'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2.4'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    >
                                        <polyline points='20 6 9 17 4 12' />
                                    </svg>
                                )}
                            </MenuEntry>
                        );
                    })}
                </PopupPanel>
            )}

            {r.touch && (
                <BottomSheet
                    title={globalize.translate('SortByLabel')}
                    onClose={() => setOpen(false)}
                >
                    {options.map((s, index) => {
                        const isSelected = s.id === value;
                        return (
                            <MenuEntry
                                key={s.id}
                                sheet
                                onClick={() => {
                                    onChange(s.id);
                                    setOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontWeight: isSelected ? 600 : 400,
                                    animation: 'jfpSubPillIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                                    animationDelay: `${index * 25}ms`
                                }}
                            >
                                <span>{globalize.translate(s.key)}</span>
                                {isSelected && (
                                    <svg
                                        width='18'
                                        height='18'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2.4'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    >
                                        <polyline points='20 6 9 17 4 12' />
                                    </svg>
                                )}
                            </MenuEntry>
                        );
                    })}
                </BottomSheet>
            )}
        </div>
    );
}
