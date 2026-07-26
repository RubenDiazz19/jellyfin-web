
/**
 * Module for building cards from item data.
 * @module components/cardBuilder/chaptercardbuilder
 */

import escapeHtml from 'escape-html';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getScaledImageUrl } from 'utils/sdk/imageUrls';
import datetime from '../../scripts/datetime';
import imageLoader from '../images/imageLoader';
import layoutManager from '../layoutManager';
import browser from '../../scripts/browser';

const enableFocusTransform = !browser.slow && !browser.edge;

function buildChapterCardsHtml(item, chapters, options) {
    // TODO move card creation code to Card component

    let className = 'card itemAction chapterCard';

    if (layoutManager.tv) {
        className += ' show-focus';

        if (enableFocusTransform) {
            className += ' show-animation';
        }
    }

    const mediaStreams = (item.MediaSources || [])[0]?.MediaStreams || [];
    const videoStream = mediaStreams.filter(({ Type }) => {
        return Type === 'Video';
    })[0] || {};

    let shape = (options.backdropShape || 'backdrop');

    if (videoStream.Width && videoStream.Height && (videoStream.Width / videoStream.Height) <= 1.2) {
        shape = (options.squareShape || 'square');
    }

    className += ` ${shape}Card`;

    if (options.block || options.rows) {
        className += ' block';
    }

    let html = '';
    let itemsInRow = 0;

    const api = ServerConnections.getApi(item.ServerId);

    for (let i = 0, length = chapters.length; i < length; i++) {
        if (options.rows && itemsInRow === 0) {
            html += '<div class="cardColumn">';
        }

        const chapter = chapters[i];

        html += buildChapterCard(item, api, chapter, i, options, className, shape);
        itemsInRow++;

        if (options.rows && itemsInRow >= options.rows) {
            itemsInRow = 0;
            html += '</div>';
        }
    }

    return html;
}

function getImgUrl({ Id }, { ImageTag }, index, maxWidth, api) {
    if (ImageTag) {
        return getScaledImageUrl(api, Id, ImageType.Chapter, {
            maxWidth: maxWidth,
            tag: ImageTag,
            index
        });
    }

    return null;
}

function buildChapterCard(item, api, chapter, index, { width, coverImage }, className, shape) {
    const imgUrl = getImgUrl(item, chapter, index, width || 400, api);

    let cardImageContainerClass = 'cardContent cardContent-shadow cardImageContainer chapterCardImageContainer';
    if (coverImage) {
        cardImageContainerClass += ' coveredImage';
    }
    const dataAttributes = ` data-action="play" data-isfolder="${item.IsFolder}" data-id="${item.Id}" data-serverid="${item.ServerId}" data-type="${item.Type}" data-mediatype="${item.MediaType}" data-positionticks="${chapter.StartPositionTicks}"`;
    let cardImageContainer = imgUrl ? (`<div class="${cardImageContainerClass} lazy" data-src="${imgUrl}">`) : (`<div class="${cardImageContainerClass}">`);

    if (!imgUrl) {
        cardImageContainer += '<span class="material-icons cardImageIcon local_movies" aria-hidden="true"></span>';
    }

    let nameHtml = '';
    nameHtml += `<div class="cardText">${escapeHtml(chapter.Name)}</div>`;
    nameHtml += `<div class="cardText">${datetime.getDisplayRunningTime(chapter.StartPositionTicks)}</div>`;

    const cardBoxCssClass = 'cardBox';
    const cardScalableClass = 'cardScalable';

    return `<button type="button" class="${className}"${dataAttributes}><div class="${cardBoxCssClass}"><div class="${cardScalableClass}"><div class="cardPadder-${shape}"></div>${cardImageContainer}</div><div class="innerCardFooter">${nameHtml}</div></div></div></button>`;
}

export function buildChapterCards(item, chapters, options) {
    if (options.parentContainer) {
        // Abort if the container has been disposed
        if (!document.body.contains(options.parentContainer)) {
            return;
        }

        if (chapters.length) {
            options.parentContainer.classList.remove('hide');
        } else {
            options.parentContainer.classList.add('hide');
            return;
        }
    }

    const html = buildChapterCardsHtml(item, chapters, options);

    options.itemsContainer.innerHTML = html;

    imageLoader.lazyChildren(options.itemsContainer);
}

export default {
    buildChapterCards: buildChapterCards
};

