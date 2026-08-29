// Hook compartido para la búsqueda remota, descarga y subida manual de subtítulos.
// Centraliza el estado, eventos de arrastrar/soltar y llamadas a la API de subtítulos.

import globalize from 'lib/globalize';

import React, { useEffect, useRef, useState } from 'react';
import {
    downloadSubtitle,
    fileToBase64,
    searchSubtitles,
    uploadSubtitle,
    type RemoteSubtitle
} from '../../../../domain/api';
import { useToast } from '../../toast/ToastProvider';

export const POPULAR_LANGS = [
    { code: 'spa', label: 'Español (spa)' },
    { code: 'eng', label: 'English (eng)' },
    { code: 'fre', label: 'Français (fre)' },
    { code: 'ger', label: 'Deutsch (ger)' },
    { code: 'ita', label: 'Italiano (ita)' },
    { code: 'por', label: 'Português (por)' },
    { code: 'jpn', label: 'Japanese (jpn)' },
    { code: 'kor', label: 'Korean (kor)' }
];

type UseSubtitleSearchOptions = {
    itemId: string;
    onSubtitleUpdated?: () => Promise<void> | void;
};

export function useSubtitleSearch({ itemId, onSubtitleUpdated }: UseSubtitleSearchOptions) {
    // ── Búsqueda ──
    const [lang, setLang] = useState('spa');
    const [isPerfectMatch, setIsPerfectMatch] = useState(false);
    const [results, setResults] = useState<RemoteSubtitle[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);

    // ── Subida ──
    const [file, setFile] = useState<File | null>(null);
    const [uploadLang, setUploadLang] = useState('spa');
    const [isForced, setIsForced] = useState(false);
    const [isHearingImpaired, setIsHearingImpaired] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toast = useToast();

    const doSearch = async (searchLang = lang, perfectMatch = isPerfectMatch) => {
        if (!searchLang.trim() || !itemId) return;
        setSearching(true);
        setSearchError(null);
        try {
            const rs = await searchSubtitles(itemId, searchLang.trim(), perfectMatch || undefined);
            setResults(rs);
            if (rs.length === 0) {
                toast(globalize.translate('NoSubtitleSearchResultsFound'), 'info');
            }
        } catch (e) {
            const msg = (e as Error).message;
            setSearchError(msg);
            toast(msg, 'warn');
        } finally {
            setSearching(false);
        }
    };

    // Búsqueda inicial automática
    useEffect(() => {
        if (itemId) {
            void doSearch('spa', isPerfectMatch);
        }
    }, [itemId]);

    const handleSelectLanguage = (code: string) => {
        setLang(code);
        void doSearch(code, isPerfectMatch);
    };

    const handleTogglePerfectMatch = (checked: boolean) => {
        setIsPerfectMatch(checked);
        void doSearch(lang, checked);
    };

    const doDownload = async (id: string) => {
        setDownloading(id);
        try {
            await downloadSubtitle(itemId, id);
            toast(globalize.translate('MessageSubtitleDownloaded'), 'success');
            await new Promise((resolve) => setTimeout(resolve, 350));
            await onSubtitleUpdated?.();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setDownloading(null);
        }
    };

    const doUpload = async () => {
        if (!file || !itemId) return;
        setUploading(true);
        try {
            const data = await fileToBase64(file);
            const format = file.name.split('.').pop()?.toLowerCase() || 'srt';
            await uploadSubtitle(itemId, {
                language: uploadLang.trim() || 'spa',
                format,
                isForced,
                isHearingImpaired,
                data
            });
            toast(globalize.translate('MessageSubtitleUploaded'), 'success');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await new Promise((resolve) => setTimeout(resolve, 350));
            await onSubtitleUpdated?.();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setUploading(false);
        }
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) setFile(dropped);
    };

    return {
        // Búsqueda
        lang,
        setLang,
        isPerfectMatch,
        setIsPerfectMatch,
        results,
        searching,
        downloading,
        searchError,
        doSearch,
        handleSelectLanguage,
        handleTogglePerfectMatch,
        doDownload,

        // Subida
        file,
        setFile,
        uploadLang,
        setUploadLang,
        isForced,
        setIsForced,
        isHearingImpaired,
        setIsHearingImpaired,
        uploading,
        dragOver,
        setDragOver,
        fileInputRef,
        handleFileDrop,
        doUpload
    };
}
