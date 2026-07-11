import { Link, useLocation, useSearchParams } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  Search as SearchIcon,
  Library,
  Settings as SettingsIcon,
  FolderOpen,
  Tags,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/uiStore';
import { useCategories } from '../../hooks/useCategories';
import type { Category } from '../../types';

const CategoryNav = ({ categories, activeCategoryId }: { categories: Category[]; activeCategoryId: string | null }) => {
  const { closeSidebar } = useUIStore();
  return (
    <ul className="space-y-1">
      {categories.map((category) => {
        const isActive = activeCategoryId === category.id;
        return (
          <li key={category.id}>
            <Link
              to={`/browse?category=${category.id}`}
              onClick={closeSidebar}
              className={cn(
                'group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-3 truncate">
                <span className={cn('text-lg', isActive ? 'opacity-100' : 'opacity-70')}>{category.icon}</span>
                <span className="truncate">{category.name}</span>
              </div>
              {category.segment_count !== undefined && (
                <span
                  className={cn(
                    'ml-auto inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                    isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                  )}
                >
                  {category.segment_count}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

const NavContents = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentCategoryId = searchParams.get('category');
  const { data: categories } = useCategories();
  const { setSidebarOpen } = useUIStore();

  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Browse All', href: '/browse', icon: Library },
    { name: 'Search', href: '/search', icon: SearchIcon },
    { name: 'Documents', href: '/documents', icon: FolderOpen },
    { name: 'Tags', href: '/tags', icon: Tags },
  ];

  return (
    <>
      <div className="flex h-16 items-center px-6 border-b border-gray-100">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <span className="text-lg">🎙️</span>
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">CMMS</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <nav className="space-y-6">
          <div>
            <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Main</div>
            <ul className="space-y-1">
              {mainNav.map((item) => {
                const isActive = location.pathname === item.href && !currentCategoryId;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                          isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                        )}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Categories</span>
              <Link to="/settings" className="text-gray-400 hover:text-gray-600">
                <SettingsIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
            {categories ? (
              <CategoryNav categories={categories} activeCategoryId={currentCategoryId} />
            ) : (
              <div className="px-3 py-4 text-sm text-gray-400 animate-pulse">Loading...</div>
            )}
          </div>
        </nav>
      </div>
      <div className="p-4 border-t border-gray-200">
        <Link
          to="/settings"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <SettingsIcon className="h-5 w-5 text-gray-400" /> Settings
        </Link>
      </div>
    </>
  );
};

export const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-white border-r border-gray-200">
        <NavContents />
      </div>
      <DialogPrimitive.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col bg-white shadow-xl transition-transform lg:hidden focus:outline-none">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <NavContents />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};
