import type { CSSProperties } from 'react';
import { T } from '../../theme/tokens';

export const pageContainerStyle: CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#000000',
    color: T.fg,
    fontFamily: T.ui,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    boxSizing: 'border-box'
};

export const titleStyle: CSSProperties = {
    fontSize: 22,
    fontWeight: 400,
    letterSpacing: -0.3,
    margin: 0,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center'
};

export const listContainerStyle: CSSProperties = {
    width: '100%',
    maxWidth: 800,
    animation: 'jfp-fade-in 0.3s ease'
};

export const circlesGridStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
    margin: '16px 0'
};

export const profileItemStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    outline: 'none',
    userSelect: 'none'
};

export const circleBaseStyle: CSSProperties = {
    width: 104,
    height: 104,
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.22s ease, background 0.22s ease'
};

export const skeletonCircleStyle: CSSProperties = {
    width: 104,
    height: 104,
    borderRadius: '50%'
};

export const footerActionsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36
};

export const ghostBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: 999,
    padding: '8px 16px',
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: 'inherit',
    fontSize: 12,
    letterSpacing: 0.2,
    cursor: 'pointer',
    transition: 'all .2s'
};

export const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 8,
    padding: '12px 14px',
    color: T.fg,
    fontFamily: T.ui,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color .2s'
};

export const primaryBtnStyle: CSSProperties = {
    width: '100%',
    marginTop: 20,
    padding: '12px 18px',
    background: '#ffffff',
    color: '#000000',
    border: 'none',
    borderRadius: 999,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
};

export const secondaryBtnStyle: CSSProperties = {
    ...primaryBtnStyle,
    marginTop: 10,
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.14)'
};

export const labelStyle: CSSProperties = {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.5)',
    display: 'block',
    marginBottom: 8
};
