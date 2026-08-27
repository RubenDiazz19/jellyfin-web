import type { ReactNode } from 'react';
import globalize from 'lib/globalize';
import { ErrText, Muted } from './fields';
import { EmptyState, SkeletonRow } from '../skeleton/Skeleton';

type Props = {
    loading?: boolean;
    error?: string | null;
    count?: number;
    emptyTitle?: string;
    emptyHint?: string;
    emptyText?: string;
    emptyIcon?: string;
    loadingText?: string;
    skeleton?: ReactNode;
    renderEmpty?: ReactNode;
    renderError?: ReactNode;
    renderLoading?: ReactNode;
    variant?: 'dialog' | 'page';
    children: ReactNode;
};

export function LoadState({
    loading = false,
    error,
    count,
    emptyTitle,
    emptyHint,
    emptyText,
    emptyIcon,
    loadingText,
    skeleton,
    renderEmpty,
    renderError,
    renderLoading,
    variant = 'dialog',
    children
}: Props): React.JSX.Element | null {
    if (error) {
        if (renderError) return <div style={{ display: 'contents' }}>{renderError}</div>;
        if (variant === 'page') {
            return (
                <EmptyState
                    title={emptyTitle ?? globalize.translate('LibrariesLoadError')}
                    hint={error}
                />
            );
        }
        return <ErrText>{error}</ErrText>;
    }

    if (loading) {
        if (renderLoading) return <div style={{ display: 'contents' }}>{renderLoading}</div>;
        if (variant === 'page') {
            return skeleton ? <div style={{ display: 'contents' }}>{skeleton}</div> : <SkeletonRow title='' />;
        }
        return <Muted>{loadingText ?? globalize.translate('Loading')}</Muted>;
    }

    if (count === 0) {
        if (renderEmpty) return <div style={{ display: 'contents' }}>{renderEmpty}</div>;
        if (variant === 'page') {
            return (
                <EmptyState
                    title={emptyTitle ?? ''}
                    hint={emptyHint}
                    icon={emptyIcon}
                />
            );
        }
        return <Muted>{emptyText ?? emptyTitle ?? ''}</Muted>;
    }

    return <div style={{ display: 'contents' }}>{children}</div>;
}
