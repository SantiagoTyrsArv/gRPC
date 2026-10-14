import { createBrowserRouter, useParams } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RoomPage } from './pages/RoomPage';

/** Remonta la sala al cambiar de código, para no mezclar estado entre salas. */
function RoomRoute() {
  const { code = '' } = useParams();
  return <RoomPage key={code} />;
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/room/:code', element: <RoomRoute /> },
      { path: '/ranking', element: <LeaderboardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
