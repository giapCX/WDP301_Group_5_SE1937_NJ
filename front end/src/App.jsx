import AppRoutes from './routes/AppRoutes.jsx';
import MainLayout from './layouts/MainLayout.jsx';

export default function App() {
  return (
    <MainLayout>
      <AppRoutes />
    </MainLayout>
  );
}
