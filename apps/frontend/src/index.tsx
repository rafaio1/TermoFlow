import React from 'react';
import { createRoot } from 'react-dom/client'; // Import createRoot
import Routes from './configs/routes';
import './configs/i18n';
import * as serviceWorker from './serviceWorker';

import { ConfigProvider } from 'antd';
import theme from './theme';
import { AppConfigProvider, useAppConfig } from './providers/AppConfigProvider';

const rootElement = document.getElementById('root');
const ThemedApp: React.FC = () => {
  const { config } = useAppConfig();
  const branding = config.BRANDING || {};
  return (
    <ConfigProvider
      theme={{
        ...theme,
        token: {
          ...theme.token,
          colorPrimary: branding.primary || theme.token?.colorPrimary,
          colorTextHeading: branding.headerTextColor || theme.token?.colorTextHeading,
        },
        components: {
          ...theme.components,
          Layout: {
            ...theme.components?.Layout,
            bodyBg: branding.contentBg || theme.components?.Layout?.bodyBg,
            headerBg: branding.headerBg || theme.components?.Layout?.headerBg,
            siderBg: branding.siderBg || theme.components?.Layout?.siderBg,
          },
        },
      }}
    >
      <Routes />
    </ConfigProvider>
  );
};

if (rootElement) {
  createRoot(rootElement).render(
    <AppConfigProvider>
      <ThemedApp />
    </AppConfigProvider>
  );
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
