import Header from '../components/Header.jsx';

export default function MainLayout({ children }) {
  return (
    <div className="app-shell">
      <Header />
      <main className="container py-4">{children}</main>
      <footer className="border-top py-3 text-center text-secondary">
        <div className="container">VietTour · Quản lý thuê xe du lịch</div>
      </footer>
    </div>
  );
}
