import Admin from './pages/Admin';
import Home from './pages/Home';
import Links from './pages/Links';
import Manage from './pages/Manage';
import { useRoute } from './lib/router';

export default function App() {
  const route = useRoute();

  if (route.name === 'admin') return <Admin />;
  if (route.name === 'links') return <Links />;
  return route.name === 'manage' ? <Manage uuid={route.uuid} /> : <Home />;
}
