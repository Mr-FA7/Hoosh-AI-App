import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Nav } from './Nav';

export function MarketingLayout() {
  return (
    <div className="hoosh-marketing hm-shell">
      <Nav />
      <main className="hm-main" id="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
