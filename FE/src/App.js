import ListingsPage from './pages/ListingsPage';
import GaragePage from './pages/GaragePage';
import './App.css';

function App() {
  return window.location.pathname.startsWith('/garage') ? (
    <GaragePage />
  ) : (
    <ListingsPage />
  );
}

export default App;
