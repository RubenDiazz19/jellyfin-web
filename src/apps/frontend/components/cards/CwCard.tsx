import React from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { WatchedButton } from '../controls/WatchedButton';
import { FavButton } from '../controls/FavButton';
import { PlayBtn } from '../controls/PlayBtn';
import { Progress } from '../controls/Progress';
import type { Navigate } from '../../router';
import type { CarouselSlide } from '../../data';

type Props = { slide: CarouselSlide; navigate: Navigate };

// Tarjeta de "continuar viendo" (apaisada, con miniatura del episodio).
export const CwCard = React.memo(function CwCard({ slide, navigate }: Props) {
  return (
    <div
      onClick={() => navigate({ page: 'show', showId: slide.id })}
      style={{ width: 380, flex: '0 0 380px', cursor: 'pointer' }}
      className="jfp-hoverlift"
    >
      <div
        style={{
          height: 214, borderRadius: 4, overflow: 'hidden', position: 'relative',
          backgroundImage: `url(${slide.backdrop})`, backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 55%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 12 }}>
          <WatchedButton id={`${slide.id}-s${slide.season}-e${slide.episode}`} size={16} badge />
        </div>
        <div style={{ position: 'absolute', top: 10, right: 12 }}>
          <FavButton id={slide.id} size={16} />
        </div>
        <div
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          className="jfp-playover"
        >
          <PlayBtn
            size={56}
            onClick={(e) => {
              e.stopPropagation();
              navigate({
                page: 'episode',
                showId: slide.id,
                seasonN: slide.season as number,
                epN: slide.episode as number,
              });
            }}
          />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <Progress value={slide.progress ?? 0} height={3} />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: T.display, fontSize: 22, lineHeight: 1.1 }}>{slide.title}</div>
        <div style={{
          marginTop: 4, fontFamily: T.ui, fontSize: 12, color: T.dim,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span>T{slide.season} · E{slide.episode}</span>
          <Ic.Dot />
          <span>{slide.remaining}</span>
        </div>
      </div>
    </div>
  );
});
