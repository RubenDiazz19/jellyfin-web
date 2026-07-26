import { describe, expect, it, vi } from 'vitest';

import { getLocationSearch, getUrlParameter, safeDecodeURIComponent } from './url';

const mockLocation = (urlString: string) => {
    const url = new URL(urlString);
    vi.spyOn(window, 'location', 'get')
        .mockReturnValue({
            ...window.location,
            hash: url.hash,
            host: url.host,
            hostname: url.hostname,
            href: url.href,
            origin: url.origin,
            pathname: url.pathname,
            port: url.port,
            protocol: url.protocol,
            search: url.search
        });
};

describe('getLocationSearch', () => {
    it('Should work with standard url search', () => {
        mockLocation('https://example.com/path?foo#bar');
        expect(getLocationSearch()).toBe('?foo');
    });

    it('Should work with search in the url hash', () => {
        mockLocation('https://example.com/path#bar?foo');
        expect(getLocationSearch()).toBe('?foo');
    });

    it('Should work with search in the url hash and standard url search', () => {
        mockLocation('https://example.com/path?baz#bar?foo');
        expect(getLocationSearch()).toBe('?foo');
    });

    it('Should return an empty string if there is no search', () => {
        mockLocation('https://example.com');
        expect(getLocationSearch()).toBe('');
    });

    it('Should fallback to the href if there is no hash or search', () => {
        vi.spyOn(window, 'location', 'get')
            .mockReturnValue({
                ...window.location,
                hash: '',
                host: '',
                hostname: '',
                href: 'https://example.com/path#bar?foo',
                origin: '',
                pathname: '',
                port: '',
                protocol: '',
                search: ''
            });
        expect(getLocationSearch()).toBe('?foo');
    });
});

describe('getUrlParameter', () => {
    it('Should read a parameter from an absolute url', () => {
        expect(getUrlParameter('https://srv/Videos/1/stream?playSessionId=abc', 'playSessionId'))
            .toBe('abc');
    });

    it('Should read a parameter from a relative url', () => {
        expect(getUrlParameter('/Videos/1/stream?a=1&b=2', 'b')).toBe('2');
    });

    it('Should not confuse the path with the query', () => {
        // A bare URLSearchParams over the whole url would read
        // "https://srv/x" as a parameter name.
        expect(getUrlParameter('https://srv/x?name=v', 'https://srv/x')).toBe('');
    });

    it('Should ignore the fragment', () => {
        expect(getUrlParameter('https://srv/x?a=1#b=2', 'b')).toBe('');
        expect(getUrlParameter('https://srv/x?a=1#b=2', 'a')).toBe('1');
    });

    it('Should decode the value', () => {
        expect(getUrlParameter('https://srv/x?title=A%20B', 'title')).toBe('A B');
    });

    it('Should return an empty string when the parameter is missing', () => {
        expect(getUrlParameter('https://srv/x?a=1', 'zzz')).toBe('');
    });

    it('Should return an empty string when there is no query at all', () => {
        expect(getUrlParameter('https://srv/x', 'a')).toBe('');
    });

    it('Should tolerate a missing url instead of throwing', () => {
        // Playback builds the media url only on some code paths, and reads
        // the play session id off it unconditionally.
        expect(getUrlParameter(undefined, 'a')).toBe('');
        expect(getUrlParameter(null, 'a')).toBe('');
        expect(getUrlParameter('', 'a')).toBe('');
    });
});

describe('safeDecodeURIComponent', () => {
    it('Should decode a properly encoded URI component', () => {
        expect(safeDecodeURIComponent(encodeURIComponent('Hello, World!'))).toBe('Hello, World!');
    });

    it('Should return the original value if decoding fails', () => {
        expect(safeDecodeURIComponent('Hello, World!%')).toBe('Hello, World!%');
    });
});
