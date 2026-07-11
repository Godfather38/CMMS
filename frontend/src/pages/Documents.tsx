import { useState } from 'react';
import { FileText, RefreshCw, Trash2, Plus, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button, Input, Modal } from '../components/ui';
import { useDocuments, useRegisterDocument, useSyncDocument, useDeleteDocument } from '../hooks/useDocuments';
import { apiErrorMessage } from '../services/api';

export const Documents = () => {
  const { data, isLoading } = useDocuments();
  const registerDoc = useRegisterDocument();
  const syncDoc = useSyncDocument();
  const deleteDoc = useDeleteDocument();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [fileId, setFileId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleRegister = async () => {
    const id = fileId.trim();
    if (!id) return;
    setError(null);
    try {
      await registerDoc.mutateAsync({ google_file_id: id });
      setFileId('');
      setRegisterOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleSync = async (id: string) => {
    setError(null);
    setSyncingId(id);
    try {
      await syncDoc.mutateAsync(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSyncingId(null);
    }
  };

  const documents = data?.data || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <p className="mt-1 text-sm text-gray-500">Google Docs registered with CMMS.</p>
        </div>
        <Button onClick={() => setRegisterOpen(true)}>
          <Plus size={16} className="mr-2" /> Register Document
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      ) : documents.length ? (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between bg-white rounded-lg border border-gray-200 shadow-sm p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{doc.title || 'Untitled'}</span>
                    {!doc.google_file_id.startsWith('dev-') && (
                      <a
                        href={`https://docs.google.com/document/d/${doc.google_file_id}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {doc.segment_count ?? 0} segments
                    {doc.last_synced_at
                      ? ` · synced ${formatDistanceToNow(new Date(doc.last_synced_at), { addSuffix: true })}`
                      : ' · never synced'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  className="h-9 px-3"
                  onClick={() => handleSync(doc.id)}
                  disabled={syncingId === doc.id}
                >
                  <RefreshCw size={15} className={syncingId === doc.id ? 'animate-spin' : ''} />
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deleteDoc.mutate(doc.id)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <h3 className="text-sm font-semibold text-gray-900">No documents yet</h3>
          <p className="mt-1 text-sm text-gray-500">Register a Google Doc to start marking material.</p>
        </div>
      )}

      <Modal open={registerOpen} onOpenChange={setRegisterOpen} title="Register Google Doc">
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            Paste the file ID from a Google Docs URL (the part between <code className="text-xs bg-gray-100 px-1 rounded">/d/</code> and{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">/edit</code>). Requires a connected Google account.
          </p>
          <Input
            placeholder="e.g. 1AbCdEfGhIjKlMnOpQrStUvWxYz..."
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button onClick={handleRegister} disabled={!fileId.trim() || registerDoc.isPending}>
              {registerDoc.isPending ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
