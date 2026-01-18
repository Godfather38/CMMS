import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation, 
  useNavigate,
  useSearchParams,
  useParams
} from 'react-router-dom';
import { 
  QueryClient, 
  QueryClientProvider, 
  useQuery, 
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  keepPreviousData
} from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  LayoutDashboard, 
  Search as SearchIcon, 
  Library, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X, 
  Plus, 
  Filter, 
  ChevronRight,
  User,
  Tags,
  FolderOpen,
  CheckCircle2,
  RefreshCw,
  MoreVertical,
  LogIn,
  ExternalLink,
  Edit2,
  SortAsc,
  SortDesc,
  FileText,
  Link as LinkIcon,
  ArrowLeft,
  Copy,
  Trash2,
  CornerDownRight,
  CornerUpLeft,
  Clock,
  GripVertical,
  Download,
  AlertTriangle,
  Palette,
  Database,
  Check,
  FolderPlus,
  Chrome,
  PlayCircle,
  SkipForward,
  ArrowRight
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { formatDistanceToNow, format } from 'date-fns';

// DND Kit Imports
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- TYPES (src/types) ---

interface User {
  id: string;
  email: string;
  display_name: string;
  profile_image_url?: string;
  onboarding_completed?: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  segment_count?: number;
  sort_order?: number;
}

interface Tag {
  id: string;
  name: string;
  tag_type?: string;
  usage_count?: number;
}

interface Document {
  id: string;
  title: string;
  google_file_id: string;
}

interface Segment {
  id: string;
  title?: string;
  text_content: string;
  category: Category;
  document: Document;
  tags: Tag[];
  color: string;
  is_primary: boolean;
  word_count: number;
  associations_count: number;
  created_at: string;
  updated_at: string;
  highlight?: string; 
}

interface SegmentAssociation {
  id: string;
  association_type: 'derivative' | 'callback' | 'reference';
  created_at: string;
  related_segment: Segment;
  direction: 'incoming' | 'outgoing';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

interface SearchResponse {
  results: {
    segment: Segment;
    highlight: string;
    rank: number;
  }[];
  total: number;
  facets: {
    categories: { id: string; name: string; count: number }[];
    tags: { id: string; name: string; count: number }[];
  };
}

interface SearchParams {
  query: string;
  filters: {
    categoryIds?: string[];
    tagIds?: string[];
    isPrimary?: boolean;
  };
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
}

// --- STORES (src/stores) ---

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'cmms-auth' }
  )
);

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}));

interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  folderId: string | null;
  folderName: string | null;
  categoriesCustomized: boolean;
  extensionInstalled: boolean;
  firstDocCreated: boolean;
  
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setFolderData: (id: string, name: string) => void;
  setCategoriesCustomized: (val: boolean) => void;
  setExtensionInstalled: (val: boolean) => void;
  setFirstDocCreated: (val: boolean) => void;
  reset: () => void;
}

const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 1,
      totalSteps: 7,
      folderId: null,
      folderName: null,
      categoriesCustomized: false,
      extensionInstalled: false,
      firstDocCreated: false,

      nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, state.totalSteps) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
      goToStep: (step) => set({ currentStep: step }),
      setFolderData: (id, name) => set({ folderId: id, folderName: name }),
      setCategoriesCustomized: (val) => set({ categoriesCustomized: val }),
      setExtensionInstalled: (val) => set({ extensionInstalled: val }),
      setFirstDocCreated: (val) => set({ firstDocCreated: val }),
      reset: () => set({ currentStep: 1, folderId: null, folderName: null, categoriesCustomized: false, extensionInstalled: false, firstDocCreated: false }),
    }),
    { name: 'cmms-onboarding' }
  )
);

// --- SERVICES (src/services/api.ts) ---

const API_URL = 'http://localhost:3000/api/v1';
const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(error);
  }
);

// --- MOCK DATA ---
const MOCK_CATEGORIES: Category[] = [
  { id: 'c1', name: 'One-Liner', icon: '💬', segment_count: 42, sort_order: 1, description: 'Short, punchy jokes' },
  { id: 'c2', name: 'Bit', icon: '🎭', segment_count: 28, sort_order: 2, description: 'Longer routines' },
  { id: 'c3', name: 'Set', icon: '📋', segment_count: 5, sort_order: 3, description: 'Full performance lists' },
  { id: 'c4', name: 'Sketch', icon: '🎬', segment_count: 12, sort_order: 4, description: 'Scripted scenes' },
  { id: 'c5', name: 'Premise', icon: '💡', segment_count: 7, sort_order: 5, description: 'Ideas to develop' },
  { id: 'c6', name: 'Crowd Work', icon: '👥', segment_count: 15, sort_order: 6, description: 'Audience interactions' },
];

const MOCK_TAGS: Tag[] = [
  { id: 't1', name: 'observational', usage_count: 15, tag_type: 'technique' },
  { id: 't2', name: 'gross', usage_count: 5, tag_type: 'subject' },
  { id: 't3', name: 'flying', usage_count: 8, tag_type: 'subject' },
  { id: 't4', name: 'dating', usage_count: 12, tag_type: 'theme' },
  { id: 't5', name: 'politics', usage_count: 3, tag_type: 'theme' },
  { id: 't6', name: 'family', usage_count: 20, tag_type: 'subject' },
  { id: 't7', name: 'tech', usage_count: 4, tag_type: 'subject' },
];

const MOCK_USER: User = {
  id: 'u1',
  email: 'comic@example.com',
  display_name: 'Jerry S.',
  profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jerry',
  onboarding_completed: false,
};

// ... Mock Generators ...
const generateMockSegments = (offset: number, limit: number, categoryId?: string): Segment[] => {
  return Array.from({ length: limit }).map((_, i) => {
    const id = offset + i;
    const category = categoryId 
      ? MOCK_CATEGORIES.find(c => c.id === categoryId)! 
      : MOCK_CATEGORIES[id % MOCK_CATEGORIES.length];
    return {
      id: `s${id}`,
      title: `Bit about ${['Coffee', 'Dating', 'Traffic', 'Airports', 'Dogs', 'Cats', 'Taxes'][id % 7]} #${id}`,
      text_content: `Here is some funny text about ${category.name.toLowerCase()} that is definitely hilarious and worth storing. It goes on for a bit to show word count.`,
      category,
      document: { id: 'd1', title: '2024 Road Material', google_file_id: 'g1' },
      tags: [MOCK_TAGS[id % MOCK_TAGS.length], MOCK_TAGS[(id + 1) % MOCK_TAGS.length]],
      color: ['#E57373', '#81C784', '#64B5F6', '#FFD54F', '#BA68C8'][id % 5],
      is_primary: id % 3 !== 0,
      word_count: 45 + (id % 20),
      associations_count: id % 4,
      created_at: new Date(Date.now() - id * 86400000).toISOString(),
      updated_at: new Date(Date.now() - id * 43000000).toISOString(),
    };
  });
};

const MOCK_SEGMENT_DETAIL: Segment = {
  id: 's_detail_1',
  title: 'Gas Station Hands',
  text_content: "Why do gas station bathrooms always have that one wet spot on the floor that's been there since the Nixon administration? Like, is it structural? Is it load-bearing moisture?",
  category: MOCK_CATEGORIES[0],
  document: { id: 'd1', title: '2024 Road Material', google_file_id: 'g1' },
  tags: [MOCK_TAGS[0], MOCK_TAGS[1]],
  color: '#E57373',
  is_primary: true,
  word_count: 47,
  associations_count: 2,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z'
};

const MOCK_ASSOCIATIONS: SegmentAssociation[] = [
  {
    id: 'assoc1',
    association_type: 'derivative',
    created_at: '2024-01-20T10:00:00Z',
    direction: 'outgoing',
    related_segment: {
      id: 's_assoc_1',
      title: 'Gas Station Hands (set version)',
      text_content: '...load-bearing moisture?',
      category: MOCK_CATEGORIES[2],
      document: { id: 'd2', title: 'October Set Draft', google_file_id: 'g2' },
      tags: [],
      color: '#E57373',
      is_primary: false,
      word_count: 45,
      associations_count: 1,
      created_at: '2024-01-20T10:00:00Z',
      updated_at: '2024-01-20T10:00:00Z'
    }
  },
  {
    id: 'assoc2',
    association_type: 'callback',
    created_at: '2024-02-01T10:00:00Z',
    direction: 'incoming',
    related_segment: {
      id: 's_assoc_2',
      title: 'Gas Station Callback',
      text_content: 'Don\'t step in the Nixon puddle!',
      category: MOCK_CATEGORIES[2],
      document: { id: 'd3', title: 'November Set', google_file_id: 'g3' },
      tags: [],
      color: '#64B5F6',
      is_primary: true,
      word_count: 6,
      associations_count: 1,
      created_at: '2024-02-01T10:00:00Z',
      updated_at: '2024-02-01T10:00:00Z'
    }
  }
];

// --- HOOKS ---

function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => Promise.resolve([...MOCK_CATEGORIES].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))),
    staleTime: 5 * 60 * 1000,
  });
}

function useTags(search?: string) {
  return useQuery({
    queryKey: ['tags', search],
    queryFn: async () => {
      if (!search) return MOCK_TAGS;
      return MOCK_TAGS.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    },
  });
}

function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => Promise.resolve({
      last_full_sync: new Date().toISOString(),
      pending_changes: 0,
      status: 'synced' as const
    }),
    refetchInterval: 60 * 1000,
  });
}

interface UseSegmentsParams {
  categoryId?: string;
  tagIds?: string[];
  search?: string;
  sort?: string;
  order?: string;
  limit?: number;
}

function useSegments(params: UseSegmentsParams) {
  return useInfiniteQuery({
    queryKey: ['segments', params],
    queryFn: async ({ pageParam = 0 }) => {
      const limit = params.limit || 10;
      await new Promise(r => setTimeout(r, 300)); 
      
      const data = generateMockSegments(pageParam as number, limit, params.categoryId);
      const filtered = params.tagIds?.length 
        ? data.filter(s => s.tags.some(t => params.tagIds!.includes(t.id)))
        : data;

      return {
        data: filtered,
        pagination: { total: 100, limit, offset: pageParam as number, has_more: (pageParam as number) + limit < 100 }
      } as PaginatedResponse<Segment>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => 
      lastPage.pagination.has_more ? lastPage.pagination.offset + lastPage.pagination.limit : undefined,
  });
}

function useSearch(params: SearchParams) {
  return useQuery({
    queryKey: ['search', params],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 500));
      const mockResults = generateMockSegments(0, params.limit || 20).map(seg => ({
        segment: seg,
        highlight: seg.text_content.replace(new RegExp(`(${params.query.split(' ').join('|')})`, 'gi'), '<mark class="bg-yellow-200 text-gray-900 rounded-sm px-0.5">$1</mark>'),
        rank: Math.random()
      }));
      const filteredResults = mockResults.filter(r => {
        if (params.filters.categoryIds?.length && !params.filters.categoryIds.includes(r.segment.category.id)) return false;
        if (params.filters.tagIds?.length && !r.segment.tags.some(t => params.filters.tagIds!.includes(t.id))) return false;
        if (params.filters.isPrimary !== undefined && r.segment.is_primary !== params.filters.isPrimary) return false;
        return true;
      });
      const catCounts = MOCK_CATEGORIES.map(c => ({ id: c.id, name: c.name, count: Math.floor(Math.random() * 20) }));
      const tagCounts = MOCK_TAGS.map(t => ({ id: t.id, name: t.name, count: Math.floor(Math.random() * 15) }));
      return { results: filteredResults, total: filteredResults.length, facets: { categories: catCounts, tags: tagCounts } } as SearchResponse;
    },
    enabled: params.query.length > 0,
    placeholderData: keepPreviousData,
  });
}

function useSegment(id: string) {
  return useQuery({
    queryKey: ['segment', id],
    queryFn: async () => Promise.resolve(MOCK_SEGMENT_DETAIL)
  });
}

function useSegmentAssociations(id: string) {
  return useQuery({
    queryKey: ['segment', id, 'associations'],
    queryFn: async () => Promise.resolve(MOCK_ASSOCIATIONS)
  });
}

function useUpdateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Segment> }) => api.put(`/segments/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['segment', id] });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}

function useDeleteSegment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteAssociations }: { id: string; deleteAssociations: boolean }) => api.delete(`/segments/${id}`, { params: { delete_associations: deleteAssociations } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      navigate('/browse');
    },
  });
}

// --- COMMON COMPONENTS ---

const Modal = ({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode; }) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
      <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg md:w-full">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left"><DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">{title}</DialogPrimitive.Title></div>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-gray-100 data-[state=open]:text-gray-500"><X className="h-4 w-4" /><span className="sr-only">Close</span></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
      secondary: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 shadow-sm',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    };
    return <button ref={ref} className={cn('inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50', variants[variant], className)} {...props} />;
  }
);
Button.displayName = 'Button';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn('flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
});
Input.displayName = 'Input';

const CategoryBadge = ({ category }: { category: Category }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 border border-gray-200"><span>{category.icon}</span>{category.name}</span>
);

const TagBadge = ({ tag }: { tag: Tag }) => (
  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">{tag.name}</span>
);

// --- NAVIGATION COMPONENTS ---

const CategoryNav = ({ categories, activeCategoryId }: { categories: Category[], activeCategoryId: string | null }) => {
  const { closeSidebar } = useUIStore();
  return (
    <ul className="space-y-1">
      {categories.map((category) => {
        const isActive = activeCategoryId === category.id;
        return (
          <li key={category.id}>
            <Link to={`/browse?category=${category.id}`} onClick={closeSidebar} className={cn("group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900")}>
              <div className="flex items-center gap-3 truncate"><span className={cn("text-lg", isActive ? "opacity-100" : "opacity-70")}>{category.icon}</span><span className="truncate">{category.name}</span></div>
              {category.segment_count !== undefined && <span className={cn("ml-auto inline-block rounded-full px-2 py-0.5 text-xs font-medium", isActive ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 group-hover:bg-gray-200")}>{category.segment_count}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentCategoryId = searchParams.get('category');
  const { data: categories } = useCategories();
  
  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Browse All', href: '/browse', icon: Library },
    { name: 'Search', href: '/search', icon: SearchIcon },
    { name: 'Documents', href: '/documents', icon: FolderOpen },
    { name: 'Tags', href: '/tags', icon: Tags },
  ];

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-white border-r border-gray-200">
        <div className="flex h-16 items-center px-6 border-b border-gray-100">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105"><span className="text-lg">🎙️</span></div>
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
                      <Link to={item.href} onClick={() => setSidebarOpen(false)} className={cn("group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900")}>
                        <item.icon className={cn("mr-3 h-5 w-5 flex-shrink-0 transition-colors", isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500")} /> {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Categories</span>
                <Link to="/settings/categories" className="text-gray-400 hover:text-gray-600"><SettingsIcon className="h-3.5 w-3.5" /></Link>
              </div>
              {categories ? <CategoryNav categories={categories} activeCategoryId={currentCategoryId} /> : <div className="px-3 py-4 text-sm text-gray-400 animate-pulse">Loading...</div>}
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-gray-200">
          <Link to="/settings" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><SettingsIcon className="h-5 w-5 text-gray-400" /> Settings</Link>
        </div>
      </div>
      <DialogPrimitive.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 h-full w-72 bg-white shadow-xl transition-transform lg:hidden focus:outline-none">
            <div className="p-4">Mobile Sidebar</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

const Header = () => {
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
    if (location.pathname === '/search') return 'Search Results';
    if (location.pathname.startsWith('/segments')) return 'Segment Detail';
    if (location.pathname === '/settings') return 'Settings';
    if (location.pathname === '/onboarding') return 'Welcome';
    return 'CMMS';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={toggleSidebar}><span className="sr-only">Open sidebar</span><Menu className="h-6 w-6" aria-hidden="true" /></button>
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          <h1 className="text-xl font-semibold text-gray-900 hidden sm:block mr-8">{getPageTitle()}</h1>
          <form className="relative flex flex-1 max-w-md" onSubmit={handleSearch}>
            <label htmlFor="search-field" className="sr-only">Search</label>
            <SearchIcon className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" aria-hidden="true" />
            <input id="search-field" className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm bg-gray-50 rounded-md focus:bg-white transition-colors" placeholder="Search..." type="search" name="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </form>
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 text-xs text-gray-500 border border-gray-100">
            {syncStatus?.status === 'synced' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
            <span>Synced {syncStatus?.last_full_sync ? new Date(syncStatus.last_full_sync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'never'}</span>
          </div>
          <div className="h-6 w-px bg-gray-200" aria-hidden="true" />
          <div className="relative group">
            <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
              {user?.profile_image_url ? <img className="h-8 w-8 rounded-full bg-gray-50 object-cover ring-2 ring-white" src={user.profile_image_url} alt="" /> : <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 ring-2 ring-white"><User size={16} /></div>}
              <span className="hidden lg:flex lg:items-center"><span className="ml-2 text-sm font-semibold leading-6 text-gray-900" aria-hidden="true">{user?.display_name}</span><ChevronRight className="ml-2 h-4 w-4 text-gray-400 rotate-90" aria-hidden="true" /></span>
            </button>
            <div className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none hidden group-hover:block">
              <button onClick={logout} className="block w-full px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50 text-left">Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const AppShell = () => (
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

// --- ONBOARDING COMPONENTS ---

const OnboardingLayout = ({ children, step, totalSteps }: { children: React.ReactNode, step: number, totalSteps: number }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-xl">
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-indigo-600">Step {step} of {totalSteps}</span>
            <div className="h-2 flex-1 mx-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }} />
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  </div>
);

const FolderSetupStep = () => {
  const { setFolderData, nextStep } = useOnboardingStore();
  const [isPicking, setIsPicking] = useState(false);

  const handlePick = () => {
    setIsPicking(true);
    // Mock Google Picker
    setTimeout(() => {
      setIsPicking(false);
      setFolderData('folder_123', 'CMMS Material');
      nextStep();
    }, 1500);
  };

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-6">
        <FolderPlus className="h-8 w-8 text-blue-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Where should we store your material?</h2>
      <p className="text-gray-500 mb-8">CMMS syncs with a Google Drive folder to keep your documents organized.</p>
      
      <div className="space-y-4">
        <button 
          onClick={handlePick}
          disabled={isPicking}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
        >
          {isPicking ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
          {isPicking ? 'Creating Folder...' : 'Create "CMMS Material" Folder'}
        </button>
        <button className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          Select Existing Folder
        </button>
      </div>
    </div>
  );
};

const CategoriesStep = () => {
  const { nextStep } = useOnboardingStore();
  const { data: categories } = useCategories();

  return (
    <div>
      <div className="text-center mb-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 mb-4">
          <Tags className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Organize your way</h2>
        <p className="text-gray-500">We've set up some default categories for comedy writing. You can customize them now or later.</p>
      </div>

      <div className="space-y-3 mb-8">
        {categories?.slice(0, 4).map(cat => (
          <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{cat.icon}</span>
              <div>
                <div className="font-medium text-gray-900">{cat.name}</div>
                <div className="text-xs text-gray-500">{cat.description}</div>
              </div>
            </div>
            <GripVertical className="text-gray-400" size={16} />
          </div>
        ))}
        <div className="text-center text-xs text-gray-400 italic">+ {categories && categories.length - 4} more</div>
      </div>

      <div className="flex gap-3">
        <button onClick={nextStep} className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 font-medium">Customize</button>
        <button onClick={nextStep} className="flex-1 px-4 py-2 border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 font-medium">Use Defaults</button>
      </div>
    </div>
  );
};

const ExtensionStep = () => {
  const { nextStep, setExtensionInstalled } = useOnboardingStore();
  
  const handleInstall = () => {
    window.open('https://chrome.google.com/webstore/detail/placeholder', '_blank');
    setExtensionInstalled(true);
    // In real app, listen for extension message
    setTimeout(nextStep, 2000); 
  };

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
        <Chrome className="h-8 w-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Get the power of CMMS in Docs</h2>
      <p className="text-gray-500 mb-8">Our Chrome Extension lets you capture bits, tag jokes, and link call-backs directly inside Google Docs.</p>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-8 text-left text-sm space-y-2">
        <div className="flex items-center gap-2"><Check className="text-green-600 w-4 h-4" /> <span>Highlight & capture segments instantly</span></div>
        <div className="flex items-center gap-2"><Check className="text-green-600 w-4 h-4" /> <span>Sidebar access to your entire library</span></div>
        <div className="flex items-center gap-2"><Check className="text-green-600 w-4 h-4" /> <span>Auto-sync changes while you write</span></div>
      </div>

      <button onClick={handleInstall} className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 mb-3">
        Install Chrome Extension
      </button>
      <button onClick={nextStep} className="text-sm text-gray-500 hover:text-gray-900">Skip for now</button>
    </div>
  );
};

const FirstDocStep = () => {
  const { nextStep, setFirstDocCreated } = useOnboardingStore();
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    setCreating(true);
    setTimeout(() => {
      setFirstDocCreated(true);
      nextStep();
    }, 1500);
  };

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
        <FileText className="h-8 w-8 text-yellow-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Start your first notebook</h2>
      <p className="text-gray-500 mb-8">Create a new Google Doc to start writing, or import an existing set list.</p>
      
      <div className="space-y-4">
        <button 
          onClick={handleCreate}
          disabled={creating}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75"
        >
          {creating ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
          Create Blank Document
        </button>
        <button onClick={nextStep} className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          Import from Drive
        </button>
      </div>
      <div className="mt-4">
        <button onClick={nextStep} className="text-sm text-gray-500 hover:text-gray-900">I'll do this later</button>
      </div>
    </div>
  );
};

const TutorialStep = () => {
  const { nextStep } = useOnboardingStore();
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-100 mb-6">
        <PlayCircle className="h-8 w-8 text-pink-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Tour</h2>
      <p className="text-gray-500 mb-8">Learn the basics of capturing and organizing your material.</p>
      <div className="aspect-video bg-gray-100 rounded-lg mb-8 flex items-center justify-center text-gray-400 border border-gray-200">
        [Interactive Demo Placeholder]
      </div>
      <button onClick={nextStep} className="w-full px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
        Start Tour
      </button>
      <button onClick={nextStep} className="mt-3 text-sm text-gray-500 hover:text-gray-900 flex items-center justify-center gap-1 mx-auto">
        Skip Tour <SkipForward size={14} />
      </button>
    </div>
  );
};

const CompleteStep = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const { reset } = useOnboardingStore();

  const handleFinish = () => {
    updateUser({ onboarding_completed: true });
    reset(); // Reset onboarding store
    navigate('/dashboard');
  };

  return (
    <div className="text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6 animate-bounce">
        <Check className="h-10 w-10 text-green-600" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">You're all set!</h2>
      <p className="text-gray-500 mb-8 text-lg">Your comedy workspace is ready. Time to write some killer material.</p>
      
      <button 
        onClick={handleFinish}
        className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transform transition hover:scale-105"
      >
        Go to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
      </button>
    </div>
  );
};

const Onboarding = () => {
  const { currentStep, totalSteps } = useOnboardingStore();
  
  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1: return <FolderSetupStep />;
      case 2: return <CategoriesStep />;
      case 3: return <ExtensionStep />;
      case 4: return <FirstDocStep />;
      case 5: return <TutorialStep />;
      case 6: return <CompleteStep />;
      default: return <FolderSetupStep />; // Fallback
    }
  };

  // Skip welcome step if user is here (assumes they came from login/signup)
  return (
    <OnboardingLayout step={currentStep} totalSteps={6}>
      {renderStep()}
    </OnboardingLayout>
  );
};

// --- PAGES ---

const Login = () => {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => { 
    setLoading(true); 
    setTimeout(() => { 
      setAuth(MOCK_USER, 'fake-jwt-token'); 
      setLoading(false); 
      // Redirect new users to onboarding
      if (!MOCK_USER.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard'); 
      }
    }, 1000); 
  };
  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md"><span className="text-3xl">🎙️</span></div><h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Sign in to CMMS</h2></div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"><div className="bg-white px-4 py-8 shadow-xl ring-1 ring-gray-900/5 sm:rounded-lg sm:px-10"><Button onClick={handleLogin} className="w-full flex justify-center gap-3 h-11 text-base" disabled={loading}>{loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}{loading ? 'Signing in...' : 'Sign in with Google'}</Button></div></div>
    </div>
  );
};

const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const { data: categories } = useCategories();
  return (
    <div className="space-y-8">
      <div className="md:flex md:items-center md:justify-between"><div className="min-w-0 flex-1"><h2 className="text-2xl font-bold leading-7 text-gray-900">Dashboard</h2><p className="mt-1 text-sm text-gray-500">Welcome back, {user?.display_name}.</p></div><div className="mt-4 flex md:ml-4 md:mt-0"><Button className="shadow-sm"><Plus className="-ml-0.5 mr-1.5 h-5 w-5" /> New Document</Button></div></div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{categories?.map((cat) => <Link key={cat.id} to={`/browse?category=${cat.id}`} className="block group"><div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 transition-all hover:shadow-md hover:ring-indigo-500/30"><div className="p-5"><div className="flex items-center"><div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-2xl group-hover:bg-indigo-100 transition-colors">{cat.icon}</div><div className="ml-5 w-0 flex-1"><dl><dt className="truncate text-sm font-medium text-gray-500 group-hover:text-indigo-600">{cat.name}</dt><dd><div className="text-xl font-bold text-gray-900">{cat.segment_count || 0}</div></dd></dl></div></div></div></div></Link>)}</div>
    </div>
  );
};

const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = { categoryId: searchParams.get('category') || undefined, tagIds: searchParams.get('tags')?.split(',').filter(Boolean), sort: searchParams.get('sort') || 'created_at', order: searchParams.get('order') || 'desc', limit: 20 };
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['segments', filters],
    queryFn: async ({ pageParam = 0 }) => {
      await new Promise(r => setTimeout(r, 300));
      const mockData = generateMockSegments(pageParam as number, 20, filters.categoryId);
      return { data: mockData, pagination: { total: 100, limit: 20, offset: pageParam as number, has_more: (pageParam as number) + 20 < 100 } };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.pagination.has_more ? lastPage.pagination.offset + lastPage.pagination.limit : undefined
  });

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-64 flex-shrink-0 bg-white p-4 rounded-lg shadow-sm border border-gray-200"><h3 className="text-sm font-semibold mb-4">Filters</h3><p className="text-xs text-gray-500">Category & Tag filters</p></div>
      <div className="flex-1 min-w-0"><div className="mb-6"><h2 className="text-lg font-bold text-gray-900">{filters.categoryId ? MOCK_CATEGORIES.find(c => c.id === filters.categoryId)?.name || 'Category' : 'All Material'}</h2></div><SegmentList data={data?.pages} isLoading={isLoading} fetchNextPage={fetchNextPage} hasNextPage={!!hasNextPage} isFetchingNextPage={isFetchingNextPage} /></div>
    </div>
  );
};

const SegmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: segment } = useQuery({ queryKey: ['segment', id], queryFn: async () => Promise.resolve(MOCK_SEGMENT_DETAIL) });
  if (!segment) return <div className="p-8 text-center">Loading...</div>;
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between"><Link to="/browse" className="flex items-center text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={16} className="mr-1" /> Back</Link></div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"><div className="p-6 border-b border-gray-100"><h1 className="text-2xl font-bold text-gray-900 mb-2">{segment.title}</h1><div className="flex items-center gap-4 text-sm text-gray-500"><CategoryBadge category={segment.category} /><span>•</span><span>{segment.word_count} words</span></div></div><div className="p-6 bg-gray-50/50"><div className="relative pl-6"><div className="absolute left-0 top-0 bottom-0 w-1 rounded-full" style={{ backgroundColor: segment.color }} /><p className="text-lg text-gray-800 leading-relaxed font-serif whitespace-pre-wrap">{segment.text_content}</p></div></div></div>
    </div>
  );
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 500));
      const mockResults = generateMockSegments(0, 10).map(seg => ({ segment: seg, highlight: seg.text_content, rank: 1 }));
      return { results: mockResults, total: 10, facets: { categories: [], tags: [] } };
    },
    enabled: !!query
  });

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="mb-6"><h2 className="text-lg font-bold text-gray-900">{isLoading ? 'Searching...' : `${data?.total || 0} results for "${query}"`}</h2></div>
      <div className="space-y-4">{data?.results.map(r => <SegmentCard key={r.segment.id} segment={r.segment} />)}</div>
    </div>
  );
};

// --- SETTINGS COMPONENTS ---

const SortableCategoryItem = ({ category, onEdit, onDelete }: { category: Category; onEdit: (c: Category) => void; onDelete: (c: Category) => void; }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 'auto', opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg group", isDragging && "shadow-lg border-indigo-300")}>
      <div className="flex items-center gap-3"><button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"><GripVertical size={16} /></button><div className="flex items-center gap-3"><span className="text-xl w-8 text-center">{category.icon}</span><span className="font-medium text-gray-900">{category.name}</span></div></div>
      <div className="flex items-center gap-4"><span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{category.segment_count || 0} segments</span><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" onClick={() => onEdit(category)} className="h-8 px-2">Edit</Button><Button variant="ghost" onClick={() => onDelete(category)} className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">Delete</Button></div></div>
    </div>
  );
};

const CategoryManager = () => {
  const { data: categories = [] } = useCategories();
  const [items, setItems] = useState<Category[]>([]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useEffect(() => { setItems(categories); }, [categories]);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h3 className="text-lg font-medium text-gray-900">Categories</h3><Button onClick={() => { setEditCategory(null); setIsModalOpen(true); }}><Plus size={16} className="mr-2" /> Add Category</Button></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">{items.map((cat) => <SortableCategoryItem key={cat.id} category={cat} onEdit={(c) => { setEditCategory(c); setIsModalOpen(true); }} onDelete={() => {}} />)}</div>
        </SortableContext>
      </DndContext>
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title={editCategory ? "Edit Category" : "New Category"}>
        <div className="space-y-4 py-2">
          <div><label className="block text-sm font-medium text-gray-700">Name</label><Input defaultValue={editCategory?.name} placeholder="e.g. One-Liner" className="mt-1" /></div>
          <div><label className="block text-sm font-medium text-gray-700">Icon</label><Input defaultValue={editCategory?.icon} placeholder="Emoji" className="mt-1 w-20 text-center text-xl" /></div>
          <div className="flex justify-end gap-2 mt-4"><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={() => setIsModalOpen(false)}>Save</Button></div>
        </div>
      </Modal>
    </div>
  );
};

const TagManager = () => {
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: async () => Promise.resolve(MOCK_TAGS) });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h3 className="text-lg font-medium text-gray-900">Tags</h3><Button><Plus size={16} className="mr-2" /> Add Tag</Button></div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{tags.map((tag) => <tr key={tag.id}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tag.name}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tag.usage_count}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button></td></tr>)}</tbody></table>
      </div>
    </div>
  );
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'categories' | 'tags' | 'preferences' | 'data'>('categories');
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'categories', label: 'Categories', icon: FolderOpen },
    { id: 'tags', label: 'Tags', icon: Tags },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'data', label: 'Data & Sync', icon: Database },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div><h1 className="text-2xl font-bold text-gray-900">Settings</h1><p className="text-gray-500 mt-1">Manage your organization preferences and account.</p></div>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 flex-shrink-0"><nav className="space-y-1">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors", activeTab === tab.id ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50 hover:text-gray-900")}><tab.icon className={cn("mr-3 h-5 w-5 flex-shrink-0", activeTab === tab.id ? "text-indigo-500" : "text-gray-400")} />{tab.label}</button>)}</nav></aside>
        <main className="flex-1 min-w-0">
          {activeTab === 'account' && <div className="space-y-6"><h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Account</h3><div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 flex items-start justify-between"><div className="flex items-center gap-4">{user?.profile_image_url ? <img src={user.profile_image_url} alt="" className="h-16 w-16 rounded-full" /> : <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600"><User size={32} /></div>}<div><h4 className="text-lg font-medium text-gray-900">{user?.display_name}</h4><p className="text-sm text-gray-500">{user?.email}</p><p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Connected via Google</p></div></div><Button variant="secondary" onClick={logout}>Sign Out</Button></div></div>}
          {activeTab === 'categories' && <CategoryManager />}
          {activeTab === 'tags' && <TagManager />}
          {activeTab === 'preferences' && <div className="space-y-6"><h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Preferences</h3><div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-6"><div><h4 className="text-sm font-medium text-gray-900 mb-4">Appearance</h4><div className="grid grid-cols-3 gap-3">{['Light', 'Dark', 'System'].map(theme => <button key={theme} className="flex items-center justify-center px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">{theme}</button>)}</div></div></div></div>}
          {activeTab === 'data' && <div className="space-y-6"><h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Data & Sync</h3><div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-6"><div className="flex items-center justify-between"><div><h4 className="text-sm font-medium text-gray-900">Sync Status</h4><p className="text-sm text-gray-500">Last full sync: 2 minutes ago</p></div><Button variant="secondary"><RefreshCw size={16} className="mr-2" /> Sync Now</Button></div><div className="border-t border-gray-100 pt-6"><h4 className="text-sm font-medium text-gray-900 mb-2">Export Data</h4><p className="text-sm text-gray-500 mb-4">Download a JSON backup of all your segments, tags, and metadata.</p><Button variant="secondary"><Download size={16} className="mr-2" /> Export JSON</Button></div><div className="border-t border-gray-100 pt-6"><h4 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h4><Button variant="danger">Delete All Data</Button></div></div></div>}
        </main>
      </div>
    </div>
  );
};

// --- MISC COMPONENTS ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
      secondary: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 shadow-sm',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    };
    return <button ref={ref} className={cn('inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50', variants[variant], className)} {...props} />;
  }
);
Button.displayName = 'Button';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn('flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
});
Input.displayName = 'Input';

const CategoryBadge = ({ category }: { category: Category }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 border border-gray-200"><span>{category.icon}</span>{category.name}</span>
);

const TagBadge = ({ tag }: { tag: Tag }) => (
  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">{tag.name}</span>
);

const SegmentCard = ({ segment }: { segment: Segment }) => (
  <Link to={`/segments/${segment.id}`} className="group relative flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: segment.color }} />
    <div className="p-4 pl-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-2"><h3 className="text-base font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600">{segment.title || 'Untitled'}</h3><span className="text-xl">{segment.category.icon}</span></div>
      <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-grow font-serif">{segment.text_content}</p>
      <div className="mt-auto space-y-3"><div className="flex flex-wrap gap-1.5">{segment.tags.map(tag => <span key={tag.id} className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{tag.name}</span>)}</div><div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-3"><div className="flex items-center gap-3"><span className="flex items-center gap-1"><FileText size={12} />{segment.document.title}</span><span className="flex items-center gap-1"><LinkIcon size={12} />{segment.associations_count}</span></div><div className="flex items-center gap-3"><span>{segment.word_count} words</span><span>{formatDistanceToNow(new Date(segment.created_at), { addSuffix: true })}</span></div></div></div>
    </div>
  </Link>
);

const SegmentList = ({ data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage }: { data: PaginatedResponse<Segment>[] | undefined, isLoading: boolean, fetchNextPage: () => void, hasNextPage: boolean, isFetchingNextPage: boolean }) => {
  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>)}</div>;
  const allSegments = data?.flatMap(page => page.data) || [];
  if (allSegments.length === 0) return <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300"><h3 className="mt-2 text-sm font-semibold text-gray-900">No segments found</h3></div>;
  return <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{allSegments.map((segment) => <SegmentCard key={segment.id} segment={segment} />)}</div>{hasNextPage && <div className="flex justify-center pt-4"><Button variant="secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>{isFetchingNextPage ? 'Loading...' : 'Load More'}</Button></div>}</div>;
};

// --- APP CONFIG ---

const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/search" element={<Search />} />
            <Route path="/segments/:id" element={<SegmentDetail />} />
            <Route path="/settings/*" element={<Settings />} />
            <Route path="/documents" element={<div className="p-4 bg-white rounded-lg shadow text-center py-12 text-gray-500">Documents view coming soon...</div>} />
            <Route path="/tags" element={<div className="p-4 bg-white rounded-lg shadow text-center py-12 text-gray-500">Tags view coming soon...</div>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}