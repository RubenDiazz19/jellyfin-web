import type { CSSProperties, ReactNode } from 'react';

type Props = {
    borderRadius?: number;
    selected?: boolean;
    style?: CSSProperties;
    className?: string;
    children: ReactNode;
};

// Marco estándar para carátulas verticales con aspect ratio 2:3.
export function PosterFrame({
    borderRadius = 4,
    selected = false,
    style,
    className = 'jfp-card-m3',
    children
}: Props) {
    return (
        <div
            className={className}
            style={{
                aspectRatio: '2/3',
                borderRadius,
                overflow: 'hidden',
                position: 'relative',
                containerType: 'inline-size',
                background: 'rgba(255,255,255,0.05)',
                contentVisibility: 'auto',
                outline: selected ? '3px solid #fff' : undefined,
                outlineOffset: selected ? -3 : undefined,
                ...style
            }}
        >
            {children}
        </div>
    );
}
