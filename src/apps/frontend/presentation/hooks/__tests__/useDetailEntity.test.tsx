import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { signal } from '@preact/signals-core';
import { useLeaveWhen, useShowEntity, useMovieEntity } from '../useDetailEntity';
import { renderHook } from '../../../domain/bridge/__tests__/testUtils';
import { showVM } from '../../../domain/viewModels/ShowViewModel';
import { movieVM } from '../../../domain/viewModels/MovieViewModel';

vi.mock('../../../domain/viewModels/ShowViewModel', () => ({
    showVM: {
        show: signal(null),
        error: signal(null),
        gone: signal(null),
        load: vi.fn(),
        showFor: vi.fn()
    }
}));

vi.mock('../../../domain/viewModels/MovieViewModel', () => ({
    movieVM: {
        movie: signal(null),
        error: signal(null),
        gone: signal(null),
        saga: signal(null),
        load: vi.fn(),
        movieFor: vi.fn()
    }
}));

describe('useDetailEntity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        showVM.show.value = null;
        showVM.error.value = null;
        showVM.gone.value = null;
        movieVM.movie.value = null;
        movieVM.error.value = null;
        movieVM.gone.value = null;
    });

    describe('useLeaveWhen', () => {
        it('navega a la ruta indicada si when es true', () => {
            const navigate = vi.fn();
            const hook = renderHook(() => useLeaveWhen(true, { page: 'series' } as any, navigate));
            expect(navigate).toHaveBeenCalledWith({ page: 'series' });
            hook.unmount();
        });

        it('no navega si when es false', () => {
            const navigate = vi.fn();
            const hook = renderHook(() => useLeaveWhen(false, { page: 'series' } as any, navigate));
            expect(navigate).not.toHaveBeenCalled();
            hook.unmount();
        });
    });

    describe('useShowEntity', () => {
        it('dispara la carga de la serie y devuelve el item y error', () => {
            const navigate = vi.fn();
            const mockShow = { id: 's1', title: 'Show 1' } as any;
            vi.mocked(showVM.showFor).mockReturnValue(mockShow);

            const hook = renderHook(() => useShowEntity('s1', navigate));

            expect(showVM.load).toHaveBeenCalledWith('s1');
            expect(hook.result.current.item).toBe(mockShow);
            expect(hook.result.current.error).toBeNull();
            hook.unmount();
        });

        it('navega a series si la serie fue eliminada (gone === showId)', () => {
            const navigate = vi.fn();
            showVM.gone.value = 's1';

            const hook = renderHook(() => useShowEntity('s1', navigate));

            expect(navigate).toHaveBeenCalledWith({ page: 'series' });
            hook.unmount();
        });

        it('reacciona dinámicamente si la serie desaparece durante el render', () => {
            const navigate = vi.fn();
            const hook = renderHook(() => useShowEntity('s1', navigate));

            act(() => {
                showVM.gone.value = 's1';
            });

            expect(navigate).toHaveBeenCalledWith({ page: 'series' });
            hook.unmount();
        });
    });

    describe('useMovieEntity', () => {
        it('dispara la carga de la película y devuelve el item y error', () => {
            const navigate = vi.fn();
            const mockMovie = { id: 'm1', title: 'Movie 1' } as any;
            vi.mocked(movieVM.movieFor).mockReturnValue(mockMovie);

            const hook = renderHook(() => useMovieEntity('m1', navigate));

            expect(movieVM.load).toHaveBeenCalledWith('m1');
            expect(hook.result.current.item).toBe(mockMovie);
            expect(hook.result.current.error).toBeNull();
            hook.unmount();
        });

        it('navega a movies si la película fue eliminada (gone === movieId)', () => {
            const navigate = vi.fn();
            movieVM.gone.value = 'm1';

            const hook = renderHook(() => useMovieEntity('m1', navigate));

            expect(navigate).toHaveBeenCalledWith({ page: 'movies' });
            hook.unmount();
        });

        it('reacciona dinámicamente si la película desaparece durante el render', () => {
            const navigate = vi.fn();
            const hook = renderHook(() => useMovieEntity('m1', navigate));

            act(() => {
                movieVM.gone.value = 'm1';
            });

            expect(navigate).toHaveBeenCalledWith({ page: 'movies' });
            hook.unmount();
        });
    });
});
