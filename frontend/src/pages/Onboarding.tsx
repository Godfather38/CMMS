import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  Tags,
  FileText,
  PlayCircle,
  Check,
  ArrowRight,
  SkipForward,
  GripVertical,
  RefreshCw,
} from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useOnboardingStore, ONBOARDING_TOTAL_STEPS } from '../stores/onboardingStore';
import { useAuthStore } from '../stores/authStore';
import { useCategories } from '../hooks/useCategories';
import { useRegisterDocument } from '../hooks/useDocuments';
import { api, apiErrorMessage } from '../services/api';

const OnboardingLayout = ({ children, step }: { children: React.ReactNode; step: number }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-xl">
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-indigo-600">
              Step {step} of {ONBOARDING_TOTAL_STEPS}
            </span>
            <div className="h-2 flex-1 mx-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(step / ONBOARDING_TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  </div>
);

const FolderSetupStep = () => {
  const { setFolderId, nextStep } = useOnboardingStore();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [folderInput, setFolderInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const id = folderInput.trim();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch('/auth/me', { watched_folder_id: id });
      updateUser(res.data.data.user);
      setFolderId(id);
      nextStep();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-6">
        <FolderPlus className="h-8 w-8 text-blue-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Where should we watch for material?</h2>
      <p className="text-gray-500 mb-8">
        CMMS syncs with a Google Drive folder. Create a folder in Drive (e.g. "CMMS Material"), then paste its folder
        ID from the URL here.
      </p>

      <div className="space-y-4 text-left">
        <Input
          placeholder="Google Drive folder ID"
          value={folderInput}
          onChange={(e) => setFolderInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleSave} disabled={!folderInput.trim() || saving} className="w-full h-11">
          {saving ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : null}
          {saving ? 'Saving...' : 'Save Watched Folder'}
        </Button>
        <button onClick={nextStep} className="w-full text-sm text-gray-500 hover:text-gray-900">
          Skip for now — I'll set this in Settings later
        </button>
      </div>
    </div>
  );
};

const CategoriesStep = () => {
  const { nextStep } = useOnboardingStore();
  const navigate = useNavigate();
  const { data: categories } = useCategories();

  return (
    <div>
      <div className="text-center mb-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 mb-4">
          <Tags className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Organize your way</h2>
        <p className="text-gray-500">
          We've set up default categories for comedy writing. You can customize them now or later in Settings.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {categories?.slice(0, 4).map((cat) => (
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
        {categories && categories.length > 4 && (
          <div className="text-center text-xs text-gray-400 italic">+ {categories.length - 4} more</div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => navigate('/settings')}>
          Customize
        </Button>
        <Button className="flex-1" onClick={nextStep}>
          Use Defaults
        </Button>
      </div>
    </div>
  );
};

const FirstDocStep = () => {
  const { nextStep, setFirstDocCreated } = useOnboardingStore();
  const registerDoc = useRegisterDocument();
  const [fileId, setFileId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    const id = fileId.trim();
    if (!id) return;
    setError(null);
    try {
      await registerDoc.mutateAsync({ google_file_id: id });
      setFirstDocCreated(true);
      nextStep();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
        <FileText className="h-8 w-8 text-yellow-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Register your first document</h2>
      <p className="text-gray-500 mb-8">
        Paste the file ID of a Google Doc that holds your material (the part of the URL between /d/ and /edit).
      </p>

      <div className="space-y-4 text-left">
        <Input
          placeholder="Google Docs file ID"
          value={fileId}
          onChange={(e) => setFileId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleRegister} disabled={!fileId.trim() || registerDoc.isPending} className="w-full h-11">
          {registerDoc.isPending ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : null}
          {registerDoc.isPending ? 'Registering...' : 'Register Document'}
        </Button>
        <button onClick={nextStep} className="w-full text-sm text-gray-500 hover:text-gray-900">
          I'll do this later
        </button>
      </div>
    </div>
  );
};

const TourStep = () => {
  const { nextStep } = useOnboardingStore();
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-100 mb-6">
        <PlayCircle className="h-8 w-8 text-pink-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">How it works</h2>
      <div className="text-left bg-gray-50 rounded-lg border border-gray-200 p-5 mb-8 space-y-3 text-sm text-gray-700">
        <div className="flex gap-2"><Check className="text-green-600 w-4 h-4 mt-0.5 flex-shrink-0" /> <span><strong>Documents</strong> are your Google Docs, registered with CMMS.</span></div>
        <div className="flex gap-2"><Check className="text-green-600 w-4 h-4 mt-0.5 flex-shrink-0" /> <span><strong>Segments</strong> are marked pieces of material inside them — each gets a category, tags, and a color.</span></div>
        <div className="flex gap-2"><Check className="text-green-600 w-4 h-4 mt-0.5 flex-shrink-0" /> <span><strong>Search</strong> finds any bit by its text, category, or tags.</span></div>
        <div className="flex gap-2"><Check className="text-green-600 w-4 h-4 mt-0.5 flex-shrink-0" /> <span><strong>Associations</strong> link a bit to its versions and callbacks across documents — same color everywhere.</span></div>
      </div>
      <Button onClick={nextStep} className="w-full h-11">
        Got it <SkipForward size={14} className="ml-2" />
      </Button>
    </div>
  );
};

const CompleteStep = () => {
  const navigate = useNavigate();
  const { markCompleted } = useOnboardingStore();

  const handleFinish = () => {
    markCompleted();
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

export const Onboarding = () => {
  const { currentStep } = useOnboardingStore();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <FolderSetupStep />;
      case 2:
        return <CategoriesStep />;
      case 3:
        return <FirstDocStep />;
      case 4:
        return <TourStep />;
      case 5:
        return <CompleteStep />;
      default:
        return <FolderSetupStep />;
    }
  };

  return <OnboardingLayout step={currentStep}>{renderStep()}</OnboardingLayout>;
};
