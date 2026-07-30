import { type FC, useEffect, useState } from 'react';

import { useUserTheme } from 'hooks/useUserTheme';
import { getDefaultTheme } from 'scripts/settings/webSettings';
import { applyThemeColor } from 'themes/themeColor';

interface ThemeCssProps {
    dashboard?: boolean
}

const getThemeUrl = (id: string) => `themes/${id}/theme.css`;;

const DEFAULT_THEME_URL = getThemeUrl(getDefaultTheme().id);

const ThemeCss: FC<ThemeCssProps> = ({
    dashboard = false
}) => {
    const { theme, dashboardTheme } = useUserTheme();
    const [ themeUrl, setThemeUrl ] = useState(DEFAULT_THEME_URL);

    useEffect(() => {
        const id = dashboard ? dashboardTheme : theme;
        if (!id) return;
        setThemeUrl(getThemeUrl(id));
        // La barra de estado del sistema sigue al tema en vez de quedarse con
        // el color fijo del primer pintado que trae index.html. En mobile la
        // pisa MobileThemeProvider con el surface de M3, que es más específico;
        // al volver a desktop restaura lo que se haya puesto aquí.
        applyThemeColor(id);
    }, [dashboard, dashboardTheme, theme]);

    return (
        <link
            rel='stylesheet'
            type='text/css'
            href={themeUrl}
        />
    );
};

export default ThemeCss;
