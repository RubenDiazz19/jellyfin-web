import Box from '@mui/material/Box';
import { type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { FC, StrictMode, useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import AppBody from 'components/AppBody';
import OffsetAppBar from 'components/OffsetAppBar';
import AppToolbar from 'components/toolbar/AppToolbar';
import { DRAWER_WIDTH } from 'components/ResponsiveDrawer';
import { appRouter } from 'components/router/appRouter';
import ThemeCss from 'components/ThemeCss';
import { useApi } from 'hooks/useApi';
import { useLocale } from 'hooks/useLocale';

import AppTabs from './components/AppTabs';
import AppDrawer from './components/drawer/AppDrawer';
import HelpButton from './components/toolbar/HelpButton';

import './AppOverrides.scss';

export const Component: FC = () => {
    const [ isDrawerActive, setIsDrawerActive ] = useState(false);
    const { user } = useApi();
    const { dateFnsLocale } = useLocale();

    const isMediumScreen = useMediaQuery((t: Theme) => t.breakpoints.up('md'));
    const isDrawerAvailable = Boolean(user);
    const isDrawerOpen = isDrawerActive && isDrawerAvailable;

    const onToggleDrawer = useCallback(() => {
        setIsDrawerActive(!isDrawerActive);
    }, [ isDrawerActive, setIsDrawerActive ]);

    // Update body class
    useEffect(() => {
        document.body.classList.add('dashboardDocument');

        return () => {
            document.body.classList.remove('dashboardDocument');
        };
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100%'
                }}
            >
                <StrictMode>
                    <OffsetAppBar
                        dense
                        elevation={4}
                        sx={{
                            width: {
                                xs: '100%',
                                md: isDrawerAvailable ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%'
                            },
                            ml: {
                                xs: 0,
                                md: isDrawerAvailable ? DRAWER_WIDTH : 0
                            }
                        }}
                    >
                        <AppToolbar
                            isBackButtonAvailable={appRouter.canGoBack()}
                            isDrawerAvailable={!isMediumScreen && isDrawerAvailable}
                            isDrawerOpen={isDrawerOpen}
                            onDrawerButtonClick={onToggleDrawer}
                            buttons={
                                <HelpButton />
                            }
                            className='dashboard-appBar'
                        >
                            <AppTabs isDrawerOpen={isDrawerOpen} />
                        </AppToolbar>
                    </OffsetAppBar>

                    {
                        isDrawerAvailable && (
                            <AppDrawer
                                open={isDrawerOpen}
                                onClose={onToggleDrawer}
                                onOpen={onToggleDrawer}
                            />
                        )
                    }
                </StrictMode>

                <Box
                    component='main'
                    sx={{
                        position: 'relative',
                        width: '100%',
                        flexGrow: 1
                    }}
                >
                    <AppBody>
                        <Outlet />
                    </AppBody>
                </Box>
            </Box>
            <ThemeCss dashboard />
        </LocalizationProvider>
    );
};
