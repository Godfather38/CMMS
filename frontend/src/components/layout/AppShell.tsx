import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppShell = () => (
  <div className="flex h-screen overflow-hidden bg-gray-50">
    <Sidebar />
    <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
      <Header />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  </div>
);
