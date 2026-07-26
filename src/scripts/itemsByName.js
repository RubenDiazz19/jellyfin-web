import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getArtistApi } from '@jellyfin/sdk/lib/utils/api/artist-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

import listView from 'components/listview/listview';
import cardBuilder from 'components/cardbuilder/cardBuilder';
import imageLoader from 'components/images/imageLoader';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import 'elements/emby-itemscontainer/emby-itemscontainer';
import 'elements/emby-button/emby-button';

function renderItems(page, item, user) {
    const sections = [];

    if (item.ArtistCount) {
        sections.push({
            name: globalize.translate('Artists'),
            type: 'MusicArtist'
        });
    }

    if (item.ProgramCount && item.Type === 'Person') {
        sections.push({
            name: globalize.translate('HeaderUpcomingOnTV'),
            type: 'Program'
        });
    }

    if (item.MovieCount) {
        sections.push({
            name: globalize.translate('Movies'),
            type: 'Movie'
        });
    }

    if (item.SeriesCount) {
        sections.push({
            name: globalize.translate('Shows'),
            type: 'Series'
        });
    }

    if (item.EpisodeCount) {
        sections.push({
            name: globalize.translate('Episodes'),
            type: 'Episode'
        });
    }

    if (item.TrailerCount) {
        sections.push({
            name: globalize.translate('Trailers'),
            type: 'Trailer'
        });
    }

    if (item.AlbumCount) {
        sections.push({
            name: globalize.translate('Albums'),
            type: 'MusicAlbum'
        });
    }

    if (item.MusicVideoCount) {
        sections.push({
            name: globalize.translate('MusicVideos'),
            type: 'MusicVideo'
        });
    }

    sections.push({
        name: globalize.translate('HeaderAudioBooks'),
        type: 'Audiobook'
    });

    // TODO add a check when the API reports BookCount or PersonRoles
    sections.push({
        name: globalize.translate('Books'),
        type: 'Book'
    });

    const elem = page.querySelector('#childrenContent');
    elem.innerHTML = sections.map(function (section) {
        let html = '';
        let sectionClass = 'verticalSection';

        if (section.type === 'Audio') {
            sectionClass += ' verticalSection-extrabottompadding';
        }

        html += '<div class="' + sectionClass + '" data-type="' + section.type + '">';
        html += '<div class="sectionTitleContainer sectionTitleContainer-cards">';
        html += '<h2 class="sectionTitle sectionTitle-cards">';
        html += section.name;
        html += '</h2>';
        html += '<a is="emby-linkbutton" href="#" class="clearLink hide" style="margin-left:1em;vertical-align:middle;"><button is="emby-button" type="button" class="raised more raised-mini noIcon">' + globalize.translate('ButtonMore') + '</button></a>';
        html += '</div>';
        html += '<div is="emby-itemscontainer" class="itemsContainer padded-right">';
        html += '</div>';
        html += '</div>';
        return html;
    }).join('');
    const sectionElems = elem.querySelectorAll('.verticalSection');

    for (let i = 0, length = sectionElems.length; i < length; i++) {
        renderSection(item, sectionElems[i], sectionElems[i].getAttribute('data-type'), user);
    }
}

function renderSection(item, element, type, user) {
    switch (type) {
        case 'Program':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.Program],
                limit: 10,
                sortBy: [ItemSortBy.StartDate]
            }, {
                shape: 'overflowBackdrop',
                showTitle: true,
                centerText: true,
                overlayMoreButton: true,
                preferThumb: true,
                overlayText: false,
                showAirTime: true,
                showAirDateTime: true,
                showChannelName: true
            });
            break;

        case 'Movie':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.Movie],
                limit: 10,
                sortOrder: [SortOrder.Descending, SortOrder.Descending, SortOrder.Ascending],
                sortBy: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName]
            }, {
                shape: 'overflowPortrait',
                showTitle: true,
                centerText: true,
                overlayMoreButton: true,
                overlayText: false,
                showYear: true
            });
            break;

        case 'MusicVideo':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.MusicVideo],
                limit: 10,
                sortBy: [ItemSortBy.SortName]
            }, {
                shape: 'overflowBackdrop',
                showTitle: true,
                centerText: true,
                overlayPlayButton: true
            });
            break;

        case 'Trailer':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.Trailer],
                limit: 10,
                sortBy: [ItemSortBy.SortName]
            }, {
                shape: 'overflowPortrait',
                showTitle: true,
                centerText: true,
                overlayPlayButton: true
            });
            break;

        case 'Series':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.Series],
                limit: 10,
                sortBy: [ItemSortBy.SortName]
            }, {
                shape: 'overflowPortrait',
                showTitle: true,
                centerText: true,
                overlayMoreButton: true
            });
            break;

        case 'MusicAlbum':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.MusicAlbum],
                sortOrder: [SortOrder.Descending, SortOrder.Descending, SortOrder.Ascending],
                sortBy: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName]
            }, {
                shape: 'overflowSquare',
                playFromHere: true,
                showTitle: true,
                showYear: true,
                coverImage: true,
                centerText: true,
                overlayPlayButton: true
            });
            break;

        case 'Audiobook':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.AudioBook],
                sortBy: [ItemSortBy.ProductionYear, ItemSortBy.SortName],
                sortOrder: [SortOrder.Descending, SortOrder.Ascending],
                limit: 10
            }, {
                shape: 'overflowPortrait',
                showTitle: true,
                centerText: true,
                overlayMoreButton: true,
                overlayText: false,
                showYear: true
            });
            break;

        case 'Book':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.Book],
                sortBy: [ItemSortBy.ProductionYear, ItemSortBy.SortName],
                sortOrder: [SortOrder.Descending, SortOrder.Ascending],
                limit: 10
            }, {
                shape: 'overflowPortrait',
                showTitle: true,
                centerText: true,
                overlayMoreButton: true,
                overlayText: false,
                showYear: true
            });
            break;

        case 'MusicArtist':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.MusicArtist],
                limit: 8,
                sortBy: [ItemSortBy.SortName]
            }, {
                shape: 'overflowSquare',
                playFromHere: true,
                showTitle: true,
                showParentTitle: true,
                coverImage: true,
                centerText: true,
                overlayPlayButton: true
            });
            break;

        case 'Episode':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.Episode],
                limit: 6,
                sortBy: [ItemSortBy.SortName],
                isMissing: !user?.Configuration?.DisplayMissingEpisodes ? false : undefined
            }, {
                shape: 'overflowBackdrop',
                showTitle: true,
                showParentTitle: true,
                centerText: true,
                overlayPlayButton: true
            });
            break;

        case 'Audio':
            loadItems(element, item, type, {
                includeItemTypes: [BaseItemKind.Audio],
                sortBy: [ItemSortBy.AlbumArtist, ItemSortBy.Album, ItemSortBy.SortName]
            }, {
                playFromHere: true,
                action: 'playallfromhere',
                smallIcon: true,
                artist: true
            });
    }
}

function loadItems(element, item, type, options, listOptions) {
    const query = getQuery(options, item);
    fetchItems(query, item).then(function (result) {
        // If results are empty, hide the section
        if (!result.Items?.length) {
            element.classList.add('hide');
            return;
        }

        let html = '';

        if (query.limit && result.TotalRecordCount > query.limit) {
            const link = element.querySelector('a');
            link.classList.remove('hide');
            link.setAttribute('href', getMoreItemsHref(item, type));
        } else {
            element.querySelector('a').classList.add('hide');
        }

        listOptions.items = result.Items;
        const itemsContainer = element.querySelector('.itemsContainer');

        if (type === 'Audio') {
            html = listView.getListViewHtml(listOptions);
            itemsContainer.classList.remove('vertical-wrap');
            itemsContainer.classList.add('vertical-list');
        } else {
            html = cardBuilder.getCardsHtml(listOptions);
            itemsContainer.classList.add('vertical-wrap');
            itemsContainer.classList.remove('vertical-list');
        }

        itemsContainer.innerHTML = html;
        imageLoader.lazyChildren(itemsContainer);
    });
}

function getMoreItemsHref(item, type) {
    if (item.Type === 'Genre') {
        return '#/list?type=' + type + '&genreId=' + item.Id + '&serverId=' + item.ServerId;
    }

    if (item.Type === 'MusicGenre') {
        return '#/list?type=' + type + '&musicGenreId=' + item.Id + '&serverId=' + item.ServerId;
    }

    if (item.Type === 'Studio') {
        return '#/list?type=' + type + '&studioId=' + item.Id + '&serverId=' + item.ServerId;
    }

    if (item.Type === 'MusicArtist') {
        return '#/list?type=' + type + '&artistId=' + item.Id + '&serverId=' + item.ServerId;
    }

    if (item.Type === 'Person') {
        return '#/list?type=' + type + '&personId=' + item.Id + '&serverId=' + item.ServerId;
    }

    return '#/list?type=' + type + '&parentId=' + item.Id + '&serverId=' + item.ServerId;
}

function addCurrentItemToQuery(query, item) {
    switch (item.Type) {
        case BaseItemKind.Person:
            query.personIds = [item.Id];
            break;
        case BaseItemKind.Genre:
        case BaseItemKind.MusicGenre:
            query.genres = [item.Name];
            break;
        case BaseItemKind.Studio:
            query.studioIds = [item.Id];
            break;
        case BaseItemKind.MusicArtist:
            if (query.includeItemTypes?.includes(BaseItemKind.MusicVideo)) {
                query.artistIds = [item.Id];
            } else {
                query.albumArtistIds = [item.Id];
            }
    }
}

function getQuery(options, item) {
    const query = {
        sortOrder: [SortOrder.Ascending],
        recursive: true,
        fields: [ItemFields.ParentId, ItemFields.PrimaryImageAspectRatio],
        limit: 100,
        startIndex: 0,
        collapseBoxSetItems: false,
        ...options
    };
    addCurrentItemToQuery(query, item);
    return query;
}

function fetchItems(query, item) {
    const api = ServerConnections.getApi(item.ServerId);
    const userId = ServerConnections.getCurrentUserId(item.ServerId);

    // Los artistas no salen del listado general: tienen endpoint propio, y ahí
    // el tipo de item sobra porque ya viene implícito.
    if (query.includeItemTypes?.includes(BaseItemKind.MusicArtist)) {
        return getArtistApi(api)
            .getAlbumArtists({ ...query, includeItemTypes: undefined, userId })
            .then(({ data }) => data);
    }

    return getLibraryApi(api).getItems({ ...query, userId })
        .then(({ data }) => data);
}

const ItemsByName = {
    renderItems
};

export default ItemsByName;
