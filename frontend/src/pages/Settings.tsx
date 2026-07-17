import { useState } from 'react';
import { User as UserIcon, FolderOpen, Tags, Database, CheckCircle2, RefreshCw, Save, ClipboardCopy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { Button, Input } from '../components/ui';
import { CategoryManager } from '../components/categories/CategoryManager';
import { TagManager } from '../components/tags/TagManager';
import { useAuthStore } from '../stores/authStore';
import { useSyncStatus, useFullSync } from '../hooks/useSync';
import { api, apiErrorMessage } from '../services/api';

const AddonCard = () => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyConnectCode = async () => {
    setError(null);
    try {
      const res = await api.post('/auth/addon-token');
      await navigator.clipboard.writeText(res.data.data.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 6000);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-3">
      <h4 className="text-sm font-medium text-gray-900">Google Docs add-on</h4>
      <p className="text-sm text-gray-500">
        Mark and tag material from inside Google Docs. Install the sidebar once per doc (see the{' '}
        <a
          href="https://github.com/Godfather38/CMMS/tree/main/apps-script"
          target="_blank"
          rel="noreferrer"
          className="text-indigo-600 hover:underline"
        >
          install guide
        </a>
        ), then paste a connect code into it.
      </p>
      <Button onClick={copyConnectCode} variant="secondary">
        <ClipboardCopy size={16} className="mr-2" />
        {copied ? 'Copied!' : 'Copy connect code'}
      </Button>
      {copied && (
        <p className="text-sm text-green-600">
          Copied — paste it into the CMMS sidebar in Google Docs. Valid for 90 days.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

const AccountTab = () => {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);
  const [folderId, setFolderId] = useState(user?.watched_folder_id || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveFolder = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.patch('/auth/me', { watched_folder_id: folderId.trim() || null });
      updateUser(res.data.data.user);
      setMessage('Saved.');
    } catch (err) {
      setMessage(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Account</h3>
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          {user?.profile_image_url ? (
            <img src={user.profile_image_url} alt="" className="h-16 w-16 rounded-full" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <UserIcon size={32} />
            </div>
          )}
          <div>
            <h4 className="text-lg font-medium text-gray-900">{user?.display_name}</h4>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Signed in
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={logout}>Sign Out</Button>
      </div>
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-3">
        <h4 className="text-sm font-medium text-gray-900">Watched Drive Folder</h4>
        <p className="text-sm text-gray-500">
          Documents in this Google Drive folder are auto-registered during a full sync. Paste the folder ID from its
          Drive URL.
        </p>
        <div className="flex gap-2">
          <Input value={folderId} onChange={(e) => setFolderId(e.target.value)} placeholder="Drive folder ID" />
          <Button onClick={saveFolder} disabled={saving}>
            <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </div>
      <AddonCard />
    </div>
  );
};

const DataTab = () => {
  const { data: syncStatus } = useSyncStatus();
  const fullSync = useFullSync();
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setError(null);
    try {
      await fullSync.mutateAsync();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Data &amp; Sync</h3>
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Sync Status</h4>
            <p className="text-sm text-gray-500">
              {syncStatus?.last_full_sync
                ? `Last full sync: ${formatDistanceToNow(new Date(syncStatus.last_full_sync), { addSuffix: true })}`
                : 'Never synced'}
            </p>
            {syncStatus?.watched_folder?.id ? (
              <p className="text-xs text-gray-400 mt-1">Watching folder {syncStatus.watched_folder.id}</p>
            ) : (
              <p className="text-xs text-amber-600 mt-1">No watched folder configured (see Account tab)</p>
            )}
          </div>
          <Button variant="secondary" onClick={handleSync} disabled={fullSync.isPending}>
            <RefreshCw size={16} className={cn('mr-2', fullSync.isPending && 'animate-spin')} />
            {fullSync.isPending ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export const Settings = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'categories' | 'tags' | 'data'>('categories');
  const tabs = [
    { id: 'account', label: 'Account', icon: UserIcon },
    { id: 'categories', label: 'Categories', icon: FolderOpen },
    { id: 'tags', label: 'Tags', icon: Tags },
    { id: 'data', label: 'Data & Sync', icon: Database },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your organization preferences and account.</p>
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <tab.icon className={cn('mr-3 h-5 w-5 flex-shrink-0', activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400')} />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'categories' && <CategoryManager />}
          {activeTab === 'tags' && <TagManager />}
          {activeTab === 'data' && <DataTab />}
        </main>
      </div>
    </div>
  );
};
