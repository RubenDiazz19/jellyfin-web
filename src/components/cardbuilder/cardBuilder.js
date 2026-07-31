/**
 * Module for building cards from item data.
 *
 * What is left here are the two helpers the React card components still call.
 * The HTML-string card renderer that used to live in this file (getCardsHtml,
 * buildCards, buildCard and the timer/userdata DOM patching) went away with its
 * last consumers, listview.js and peoplecardbuilder.js.
 * @module components/cardBuilder/cardBuilder
 */

import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import escapeHtml from 'escape-html';

import dom from 'utils/dom';
import { getItemTypeIcon, getLibraryIcon } from 'utils/image';

import imageLoader from '../images/imageLoader';
import itemHelper from '../itemHelper';
import layoutManager from '../layoutManager';

import { getDesiredAspect, getPostersPerRow, isResizable } from './utils/builder';
import { getBackdropShape, getPortraitShape, getSquareShape } from './utils/shape';

/**
 * Gets the width of a card's image according to the shape and amount of cards per row.
 * @param {string} shape - Shape of the card.
 * @param {number} screenWidth - Width of the screen.
 * @param {boolean} isOrientationLandscape - Flag for the orientation of the screen.
 * @returns {number} Width of the image for a card.
 */
function getImageWidth(shape, screenWidth, isOrientationLandscape) {
    const imagesPerRow = getPostersPerRow(shape, screenWidth, isOrientationLandscape, layoutManager.tv);
    return Math.round(screenWidth / imagesPerRow);
}

/**
 * Normalizes the options for a card.
 * @param {Object} items - A set of items.
 * @param {Object} options - Options for handling the items.
 */
export function setCardData(items, options) {
    options.shape = options.shape || 'auto';

    const primaryImageAspectRatio = imageLoader.getPrimaryImageAspectRatio(items);

    if (['auto', 'autohome', 'autooverflow', 'autoVertical'].includes(options.shape)) {
        const requestedShape = options.shape;
        options.shape = null;

        if (primaryImageAspectRatio) {
            if (primaryImageAspectRatio >= 3) {
                options.shape = 'banner';
                options.coverImage = true;
            } else if (primaryImageAspectRatio >= 1.33) {
                options.shape = getBackdropShape(requestedShape === 'autooverflow');
            } else if (primaryImageAspectRatio > 0.8) {
                options.shape = getSquareShape(requestedShape === 'autooverflow');
            } else {
                options.shape = getPortraitShape(requestedShape === 'autooverflow');
            }
        }

        if (!options.shape) {
            options.shape = options.defaultShape || getSquareShape(requestedShape === 'autooverflow');
        }
    }

    if (options.preferThumb === 'auto') {
        options.preferThumb = options.shape === 'backdrop' || options.shape === 'overflowBackdrop';
    }

    options.uiAspect = getDesiredAspect(options.shape);
    options.primaryImageAspectRatio = primaryImageAspectRatio;

    if (!options.width && options.widths) {
        options.width = options.widths[options.shape];
    }

    if (options.rows && typeof (options.rows) !== 'number') {
        options.rows = options.rows[options.shape];
    }

    if (!options.width) {
        let screenWidth = dom.getWindowSize().innerWidth;
        const screenHeight = dom.getWindowSize().innerHeight;

        if (isResizable(screenWidth)) {
            const roundScreenTo = 100;
            screenWidth = Math.floor(screenWidth / roundScreenTo) * roundScreenTo;
        }

        options.width = getImageWidth(options.shape, screenWidth, screenWidth > (screenHeight * 1.3));
    }
}

/**
 * Generates the text or icon used for default card backgrounds.
 * @param {object} item - Item used to generate the card overlay.
 * @param {object} options - Options used to generate the card overlay.
 * @returns {string} HTML markup of the card overlay.
 */
export function getDefaultText(item, options) {
    let icon;

    if (item.Type === BaseItemKind.CollectionFolder || item.CollectionType) {
        icon = getLibraryIcon(item.CollectionType);
    }

    if (!icon) {
        icon = getItemTypeIcon(item.Type, options?.defaultCardImageIcon);
    }

    if (icon) {
        return `<span class="cardImageIcon material-icons ${icon}" aria-hidden="true"></span>`;
    }

    const defaultName = itemHelper.getDisplayName(item);
    return '<div class="cardText cardDefaultText">' + escapeHtml(defaultName) + '</div>';
}
