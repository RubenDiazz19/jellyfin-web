import { useEffect, type CSSProperties, type ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';

type Props = {

    open: boolean;
    onClose: () => void;
    position?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        maxHeight?: number;
    } | null;
    minWidth?: number | string;
    width?: number | string;
    style?: CSSProperties;
    children: ReactNode;
};

// Panel flotante estándar para menús contextuales y desplegables de escritorio.
export function PopupPanel({
    open,
    onClose,
    position,
    minWidth,
    width,
    style,
    children
}: Props) {
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest?.('[data-jfp-popup]')) {
                onClose();
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    if (!open || !position) return null;

    return ReactDOM.createPortal(
        <div
            data-jfp-popup=''
            role='menu'
            tabIndex={-1}
            style={{
                position: 'fixed',
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                right: position.right,
                maxHeight: position.maxHeight,
                minWidth,
                width,
                overflowY: 'auto',
                zIndex: 9999,
                background: 'rgba(18,18,20,0.96)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: 6,
                boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                fontFamily: T.ui,
                ...style
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body
    );
}
