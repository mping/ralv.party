import Home from './pages/Home';
import Manage from './pages/Manage';
import { useRoute } from './lib/router';

export default function App() {
  const route = useRoute();

  return route.name === 'manage' ? <Manage uuid={route.uuid} /> : <Home />;
}
