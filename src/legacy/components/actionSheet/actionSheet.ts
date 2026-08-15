import escapeHtml from 'escape-html';
import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';
import globalize from 'lib/globalize';
import dom from 'utils/dom';
import '../../elements/emby-button/emby-button';
import './actionSheet.scss';
import 'material-design-icons-iconfont';
import 'styles/scrollstyles.scss';
import '../../components/listview/listview.scss';

interface OptionItem {
    asideText?: string;
    divider?: boolean;
    icon?: string;
    id?: string;
    innerText?: string;
    name?: string;
    secondaryText?: string;
    selected?: boolean;
    textContent?: string;
    value?: string;
}

interface Options {
    items: OptionItem[];
    border?: boolean;
    callback?: (id: string) => void;
    dialogClass?: string;
    enableHistory?: boolean;
    entryAnimationDuration?: number;
    entryAnimation?: string;
    exitAnimationDuration?: number;
    exitAnimation?: string;
    menuItemClass?: string;
    offsetLeft?: number;
    offsetTop?: number;
    positionTo?: PositionTarget | null;
    positionY?: string;
    resolveOnClick?: boolean | (string | null)[];
    shaded?: boolean;
    showCancel?: boolean;
    text?: string;
    timeout?: number;
    title?: string;
}

interface Offset {
    top: number;
    left: number;
    width: number;
    height: number;
}

type PositionTarget = Element | Offset;

interface DialogOptions {
    autoFocus?: boolean;
    enableHistory?: boolean;
    entryAnimationDuration?: number;
    entryAnimation?: string;
    exitAnimationDuration?: number;
    exitAnimation?: string;
    modal?: boolean;
    removeOnClose?: boolean;
    scrollY?: boolean;
    size?: string;
}

function isElement(target: PositionTarget): target is Element {
    return typeof (target as Element).getBoundingClientRect === 'function';
}

function getOffsets(elems: PositionTarget[]): Offset[] {
    const results: Offset[] = [];

    if (!document) {
        return results;
    }

    for (const elem of elems) {
        const box = isElement(elem) ? elem.getBoundingClientRect() : elem;

        results.push({
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height
        });
    }

    return results;
}

function getPosition(positionTo: PositionTarget, options: Options, dlg: HTMLElement) {
    const windowSize = dom.getWindowSize();
    const windowHeight = windowSize.innerHeight;
    const windowWidth = windowSize.innerWidth;

    const pos = getOffsets([positionTo])[0];

    const height = dlg.offsetHeight || 300;
    const width = dlg.offsetWidth || 160;
    const GAP = 8;

    // Si no hay un rect utilizable (botón oculto/desmontado → 0×0, o
    // colapsado en un eje), centrar en vez de caer en la esquina superior
    // izquierda. Un botón realmente visible siempre tiene ancho Y alto > 0.
    if (!pos.width || !pos.height) {
        const top = Math.max(10, Math.round((windowHeight - height) / 2));
        const left = Math.max(10, Math.round((windowWidth - width) / 2));
        return { top, left, width: 0, height: 0 };
    }

    // Ancla vertical: popup encima del botón (dropup). Si no cabe arriba,
    // debajo. Si tampoco cabe debajo, se pega al bottom del viewport.
    let top;
    if (options.positionY === 'top') {
        top = pos.top - height / 2;
    } else {
        top = pos.top - height - GAP;
        if (top < 10) {
            const below = pos.top + (pos.height || 0) + GAP;
            top = (below + height <= windowHeight - 10) ? below : Math.max(10, windowHeight - height - 10);
        }
    }

    // Ancla horizontal: centro del popup alineado con centro del botón,
    // clampeado a los bordes del viewport (margen 10px).
    let left = pos.left + (pos.width || 0) / 2 - width / 2;
    left = Math.max(10, Math.min(left, windowWidth - width - 10));

    top += (options.offsetTop || 0);
    left += (options.offsetLeft || 0);

    return { top, left, width: pos.width, height: pos.height };
}

function centerFocus(elem: Element, horiz: boolean, on: boolean) {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        scrollHelper.centerFocus[fn](elem, horiz);
    }).catch(e => {
        console.warn('Error in centerFocus', e);
    });
}

/* eslint-disable-next-line sonarjs/cognitive-complexity */
export function show(options: Options) {
    // items
    // positionTo
    // showCancel
    // title
    const dialogOptions: DialogOptions = {
        removeOnClose: true,
        enableHistory: options.enableHistory,
        scrollY: false
    };

    let isFullscreen;

    if (layoutManager.tv) {
        dialogOptions.size = 'fullscreen';
        isFullscreen = true;
        dialogOptions.autoFocus = true;
    } else {
        dialogOptions.modal = false;
        dialogOptions.entryAnimation = options.entryAnimation;
        dialogOptions.exitAnimation = options.exitAnimation;
        dialogOptions.entryAnimationDuration = options.entryAnimationDuration || 140;
        dialogOptions.exitAnimationDuration = options.exitAnimationDuration || 100;
        dialogOptions.autoFocus = false;
    }

    const dlg = dialogHelper.createDialog(dialogOptions);

    if (isFullscreen) {
        dlg.classList.add('actionsheet-fullscreen');
    } else {
        dlg.classList.add('actionsheet-not-fullscreen');
    }

    dlg.classList.add('actionSheet');

    if (options.dialogClass) {
        dlg.classList.add(options.dialogClass);
    }

    let html = '';

    const scrollClassName = layoutManager.tv ? 'scrollY smoothScrollY hiddenScrollY' : 'scrollY';
    let style = '';

    // Admittedly a hack but right now the scrollbar is being factored into the width which is causing truncation
    if (options.items.length > 20) {
        const minWidth = dom.getWindowSize().innerWidth >= 300 ? 240 : 200;
        style += 'min-width:' + minWidth + 'px;';
    }

    let renderIcon = false;
    const icons = [];
    let itemIcon;
    for (const item of options.items) {
        itemIcon = item.icon || (item.selected ? 'check' : null);

        if (itemIcon) {
            renderIcon = true;
        }
        icons.push(itemIcon || '');
    }

    if (layoutManager.tv) {
        html += `<button is="paper-icon-button-light" class="btnCloseActionSheet hide-mouse-idle-tv" tabindex="-1" title="${globalize.translate('ButtonBack')}">
                     <span class="material-icons arrow_back" aria-hidden="true"></span>
                 </button>`;
    }

    // If any items have an icon, give them all an icon just to make sure they're all lined up evenly
    const center = options.title && (!renderIcon /*|| itemsWithIcons.length != options.items.length*/);

    if (center || layoutManager.tv) {
        html += '<div class="actionSheetContent actionSheetContent-centered">';
    } else {
        html += '<div class="actionSheetContent">';
    }

    if (options.title) {
        html += '<h1 class="actionSheetTitle">' + escapeHtml(options.title) + '</h1>';
    }
    if (options.text) {
        html += '<p class="actionSheetText">' + escapeHtml(options.text) + '</p>';
    }

    let scrollerClassName = 'actionSheetScroller';
    if (layoutManager.tv) {
        scrollerClassName += ' actionSheetScroller-tv focuscontainer-x focuscontainer-y';
    }
    html += '<div class="' + scrollerClassName + ' ' + scrollClassName + '" style="' + style + '">';

    let menuItemClass = 'listItem listItem-button actionSheetMenuItem';

    if (options.border || options.shaded) {
        menuItemClass += ' listItem-border';
    }

    if (options.menuItemClass) {
        menuItemClass += ' ' + options.menuItemClass;
    }

    if (layoutManager.tv) {
        menuItemClass += ' listItem-focusscale';
    }

    if (layoutManager.mobile) {
        menuItemClass += ' actionsheet-xlargeFont';
    }

    // 'options.items' is HTMLOptionsCollection, so no fancy loops
    for (let i = 0; i < options.items.length; i++) {
        const item = options.items[i];

        if (item.divider) {
            html += '<div class="actionsheetDivider"></div>';
            continue;
        }

        const autoFocus = item.selected && layoutManager.tv ? ' autoFocus' : '';

        // Check for null in case int 0 was passed in
        const optionId = item.id == null || item.id === '' ? item.value : item.id;
        html += '<button' + autoFocus + ' is="emby-button" type="button" class="' + menuItemClass + '" data-id="' + optionId + '">';

        itemIcon = icons[i];

        if (itemIcon) {
            html += `<span class="actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons ${itemIcon}" aria-hidden="true"></span>`;
        } else if (renderIcon && !center) {
            html += '<span class="actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons check" aria-hidden="true" style="visibility:hidden;"></span>';
        }

        html += '<div class="listItemBody actionsheetListItemBody">';

        html += '<div class="listItemBodyText actionSheetItemText">';
        html += escapeHtml(item.name || item.textContent || item.innerText);
        html += '</div>';

        if (item.secondaryText) {
            html += `<div class="listItemBodyText secondary">${escapeHtml(item.secondaryText)}</div>`;
        }

        html += '</div>';

        if (item.asideText) {
            html += `<div class="listItemAside actionSheetItemAsideText">${escapeHtml(item.asideText)}</div>`;
        }

        html += '</button>';
    }

    if (options.showCancel) {
        html += '<div class="buttons">';
        html += `<button is="emby-button" type="button" class="btnCloseActionSheet">${globalize.translate('ButtonCancel')}</button>`;
        html += '</div>';
    }
    html += '</div>';

    dlg.innerHTML = html;

    if (layoutManager.tv) {
        const scroller = dlg.querySelector('.actionSheetScroller');
        if (scroller) {
            centerFocus(scroller, false, true);
        }
    }

    const btnCloseActionSheet = dlg.querySelector('.btnCloseActionSheet');
    if (btnCloseActionSheet) {
        btnCloseActionSheet.addEventListener('click', function () {
            dialogHelper.close(dlg);
        });
    }

    let selectedId: string | null = null;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (options.timeout) {
        timeout = setTimeout(function () {
            dialogHelper.close(dlg);
        }, options.timeout);
    }

    return new Promise(function (resolve, reject) {
        let isResolved = false;

        dlg.addEventListener('click', function (e) {
            const actionSheetMenuItem = dom.parentWithClass(e.target as HTMLElement, 'actionSheetMenuItem');

            if (actionSheetMenuItem) {
                selectedId = actionSheetMenuItem.getAttribute('data-id');

                if (options.resolveOnClick) {
                    if (Array.isArray(options.resolveOnClick)) {
                        if (options.resolveOnClick.indexOf(selectedId) !== -1) {
                            resolve(selectedId);
                            isResolved = true;
                        }
                    } else {
                        resolve(selectedId);
                        isResolved = true;
                    }
                }

                dialogHelper.close(dlg);
            }
        });

        dlg.addEventListener('close', function () {
            if (layoutManager.tv) {
                const scroller = dlg.querySelector('.actionSheetScroller');
                if (scroller) {
                    centerFocus(scroller, false, false);
                }
            }

            if (timeout) {
                clearTimeout(timeout);
                timeout = undefined;
            }

            if (!isResolved) {
                if (selectedId != null) {
                    if (options.callback) {
                        options.callback(selectedId);
                    }

                    resolve(selectedId);
                } else {
                    reject(new Error('ActionSheet closed without resolving'));
                }
            }
        });

        dialogHelper.open(dlg).catch(e => {
            console.warn('DialogHelper.open error', e);
        });

        const pos = options.positionTo && dialogOptions.size !== 'fullscreen' ? getPosition(options.positionTo, options, dlg) : null;

        if (pos) {
            dlg.style.position = 'fixed';
            dlg.style.margin = '0';
            dlg.style.left = pos.left + 'px';
            dlg.style.top = pos.top + 'px';
        }
    });
}

export default {
    show: show
};
