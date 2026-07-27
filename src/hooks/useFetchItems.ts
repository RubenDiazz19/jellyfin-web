import { getPlaylistApi } from '@jellyfin/sdk/lib/utils/api/playlist-api';
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api';
import { useMutation } from '@tanstack/react-query';
import type { PlaylistApiMoveItemRequest } from '@jellyfin/sdk/lib/generated-client/api/playlist-api';

import { type JellyfinApiContext, useApi } from './useApi';

const fetchPlaylistsMoveItem = async (
    currentApi: JellyfinApiContext,
    requestParameters: PlaylistApiMoveItemRequest
) => {
    const { api, user } = currentApi;
    if (api && user?.Id) {
        const response = await getPlaylistApi(api).moveItem({
            ...requestParameters
        });
        return response.data;
    }
};

export const usePlaylistsMoveItemMutation = () => {
    const currentApi = useApi();
    return useMutation({
        mutationFn: (requestParameters: PlaylistApiMoveItemRequest) =>
            fetchPlaylistsMoveItem(currentApi, requestParameters )
    });
};

interface ToggleFavoriteMutationProp {
    itemId: string;
    isFavorite: boolean
}

const fetchUpdateFavoriteStatus = async (
    currentApi: JellyfinApiContext,
    itemId: string,
    isFavorite: boolean
) => {
    const { api, user } = currentApi;
    if (api && user?.Id) {
        if (isFavorite) {
            const response = await getUserDataApi(api).unmarkFavoriteItem({
                userId: user.Id,
                itemId: itemId
            });
            return response.data.IsFavorite;
        } else {
            const response = await getUserDataApi(api).markFavoriteItem({
                userId: user.Id,
                itemId: itemId
            });
            return response.data.IsFavorite;
        }
    }
};

export const useToggleFavoriteMutation = () => {
    const currentApi = useApi();
    return useMutation({
        mutationFn: ({ itemId, isFavorite }: ToggleFavoriteMutationProp) =>
            fetchUpdateFavoriteStatus(currentApi, itemId, isFavorite )
    });
};

interface TogglePlayedMutationProp {
    itemId: string;
    isPlayed: boolean
}

const fetchUpdatePlayedState = async (
    currentApi: JellyfinApiContext,
    itemId: string,
    isPlayed: boolean
) => {
    const { api, user } = currentApi;
    if (api && user?.Id) {
        if (isPlayed) {
            const response = await getUserDataApi(api).markUnplayedItem({
                userId: user.Id,
                itemId: itemId
            });
            return response.data.Played;
        } else {
            const response = await getUserDataApi(api).markPlayedItem({
                userId: user.Id,
                itemId: itemId
            });
            return response.data.Played;
        }
    }
};

export const useTogglePlayedMutation = () => {
    const currentApi = useApi();
    return useMutation({
        mutationFn: ({ itemId, isPlayed }: TogglePlayedMutationProp) =>
            fetchUpdatePlayedState(currentApi, itemId, isPlayed )
    });
};
