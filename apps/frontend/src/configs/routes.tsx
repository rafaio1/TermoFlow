import React, { Suspense, useEffect } from 'react';
import { Routes, Route, BrowserRouter, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from '../redux/store';
import AppShell from '@layout/appShell';

const Home = React.lazy(() => import('../screens/home/Home'));
const Registry = React.lazy(() => import('../screens/registry/Registry'));
const BrandingSettings = React.lazy(() => import('../screens/admin/Branding'));

const NotFound: React.FC = () => (
  <div role="alert" aria-live="polite" style={{ padding: 24 }}>
    <h1>404</h1>
    <p>Página não encontrada.</p>
  </div>
);

const ScrollToTop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return <>{children}</>;
};

const publicPaths = [
  { path: '/', component: Home },
  { path: '/cadastros', component: Registry },
  { path: '/admin/branding', component: BrandingSettings },
];

export default () => (
  <Provider store={store}>
    <BrowserRouter>
      <ScrollToTop>
        <Suspense fallback={<div role="status" aria-live="polite" style={{ padding: 16 }}>Carregando...</div>}>
          <Routes>
            {publicPaths.map(({ path, component: Screen }) => (
              <Route
                key={path}
                path={path}
                element={
                  <AppShell>
                    <Screen />
                  </AppShell>
                }
              />
            ))}
            <Route
              path="*"
              element={
                <AppShell>
                  <NotFound />
                </AppShell>
              }
            />
          </Routes>
        </Suspense>
      </ScrollToTop>
    </BrowserRouter>
  </Provider>
);
