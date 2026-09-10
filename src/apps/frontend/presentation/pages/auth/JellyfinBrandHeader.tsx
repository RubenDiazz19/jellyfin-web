import { JellyfinLogo } from '../../theme/icons';
import { T } from '../../theme/tokens';

// Cabecera oficial Jellyfin: isotipo triangular blanco + texto horizontal limpio.
export function JellyfinBrandHeader() {
    return (
        <div style={headerStyle}>
            <JellyfinLogo size={36} style={{ color: '#ffffff' }} />
            <span style={textStyle}>
                jellyfin
            </span>
        </div>
    );
}

const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
    marginBottom: 36,
    userSelect: 'none'
};

const textStyle: React.CSSProperties = {
    fontFamily: T.ui,
    fontSize: 34,
    fontWeight: 500,
    letterSpacing: -0.6,
    color: '#ffffff',
    lineHeight: 1
};
