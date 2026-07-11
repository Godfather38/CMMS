import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search as SearchIcon, Menu, ChevronRight, User as UserIcon, CheckCircle2, Clock } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStatus } from '../../hooks/useSync';

export const Header = () => {
  const { toggleSidebar } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: syncStatus } = useSyncStatus();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const getPageTitle = () => {
    if (location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname === '/browse') return 'Library';
    if (location.pathname === '/search') return 'Search';
    if (location.pathname.startsWith('/segments')) return 'Segment Detail';
    if (location.pathname === '/documents') return 'Documents';
    if (location.pathname === '/tags') return 'Tags';
    if (location.pathname.startsWith('/settings')) return 'Settings';
    return 'CMMS';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={toggleSidebar}>
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          <h1 className="text-xl font-semibold text-gray-900 hidden sm:block mr-8">{getPageTitle()}</h1>
          <form className="relative flex flex-1 max-w-md" onSubmit={handleSearch}>
            <label htmlFor="search-field" className="sr-only">Search</label>
            <SearchIcon className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" aria-hidden="true" />
            <input
              id="search-field"
              className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm bg-gray-50 rounded-md focus:bg-white transition-colors"
              placeholder="Search..."
              type="search"
              name="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 text-xs text-gray-500 border border-gray-100">
            {syncStatus?.last_full_sync ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span>
                  Synced {new Date(syncStatus.last_full_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                <span>Never synced</span>
              </>
            )}
          </div>
          <div className="h-6 w-px bg-gray-200" aria-hidden="true" />
          <div className="relative group">
            <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
              {user?.profile_image_url ? (
                <img className="h-8 w-8 rounded-full bg-gray-50 object-cover ring-2 ring-white" src={user.profile_image_url} alt="" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 ring-2 ring-white">
                  <UserIcon size={16} />
                </div>
              )}
              <span className="hidden lg:flex lg:items-center">
                <span className="ml-2 text-sm font-semibold leading-6 text-gray-900" aria-hidden="true">
                  {user?.display_name}
                </span>
                <ChevronRight className="ml-2 h-4 w-4 text-gray-400 rotate-90" aria-hidden="true" />
              </span>
            </button>
            <div className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none hidden group-hover:block">
              <button onClick={logout} className="block w-full px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50 text-left">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
