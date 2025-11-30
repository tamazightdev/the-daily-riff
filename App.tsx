import React, { useState, useEffect } from 'react';
import { GeminiModel, BlogPost, SavedPost } from './types';
import { generateBlogPosts } from './services/geminiService';
import { savePostLocally, getSavedPosts, deleteSavedPost } from './services/localDb';
import { initGoogleDrive, saveToGoogleDrive } from './services/driveService';
import SettingsModal from './components/SettingsModal';
import SavedPostsModal from './components/SavedPostsModal';
import BlogPostCard from './components/BlogPostCard';
import { SettingsIcon, SparklesIcon, ListIcon } from './components/Icons';

function App() {
  // Settings State
  const [apiKey, setApiKey] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [model, setModel] = useState<GeminiModel>(GeminiModel.PRO);
  
  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Data State
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);

  // Load settings and data on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedModel = localStorage.getItem('gemini_model') as GeminiModel;
    const storedClientId = localStorage.getItem('google_client_id');
    
    if (storedKey) setApiKey(storedKey);
    if (storedModel) setModel(storedModel);
    if (storedClientId) setGoogleClientId(storedClientId);

    // Load Local DB posts
    loadSavedPosts();

    // Open settings if no key found
    if (!storedKey) {
      setIsSettingsOpen(true);
    }

    // Init Drive if client ID exists
    if (storedClientId) {
      initGoogleDrive(storedClientId, () => console.log("Google Drive Initialized"));
    }
  }, []);

  const loadSavedPosts = async () => {
    try {
      const loaded = await getSavedPosts();
      setSavedPosts(loaded.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error("Failed to load local DB", e);
    }
  };

  // Handlers
  const handleSaveSettings = (key: string, clientId: string, newModel: GeminiModel) => {
    setApiKey(key);
    setGoogleClientId(clientId);
    setModel(newModel);
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('google_client_id', clientId);
    localStorage.setItem('gemini_model', newModel);
    
    if (clientId) {
      initGoogleDrive(clientId, () => console.log("Google Drive Initialized after save"));
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setPosts([]);
    setSources([]);

    try {
      const result = await generateBlogPosts(apiKey, model, topic);
      setPosts(result.posts);
      setSources(result.sources);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocally = async (post: BlogPost) => {
    try {
      await savePostLocally(post);
      await loadSavedPosts();
      // Optional: Show ephemeral success
    } catch (e) {
      console.error("Save local failed", e);
      setError("Failed to save locally");
    }
  };

  const handleDeleteSaved = async (id: string) => {
    await deleteSavedPost(id);
    await loadSavedPosts();
  };

  const handleSaveToDrive = async (post: BlogPost) => {
    if (!googleClientId) {
      setError("Please set a Google Client ID in Settings to use Drive.");
      setIsSettingsOpen(true);
      return;
    }
    try {
      setSuccessMsg(null);
      await saveToGoogleDrive(post.title, post.content);
      setSuccessMsg(`Saved "${post.title}" to Google Drive!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error("Drive save failed", e);
      if (e.error === 'popup_blocked_by_browser') {
         setError("Pop-up blocked. Please allow pop-ups for Google Login.");
      } else {
         setError("Failed to save to Drive. Check console or Client ID.");
      }
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden relative py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      
      {/* Decorative Background Blobs */}
      <div className="fixed top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="fixed top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="fixed -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-12 relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-black text-white p-2 rounded-lg shadow-lg">
            <span className="font-serif font-bold text-xl">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">The Daily Riff</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsSavedModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass-panel hover:bg-white/50 transition-colors text-gray-700 font-medium text-sm"
          >
            <ListIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Saved Riffs ({savedPosts.length})</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-full glass-panel hover:bg-white/50 transition-colors text-gray-700"
            title="Settings"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl relative z-10 flex flex-col gap-8 flex-grow">
        
        {/* Input Section */}
        <section className="w-full max-w-2xl mx-auto">
          <div className="glass-panel rounded-3xl p-2 shadow-xl">
            <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What's on your mind today? (e.g. 'The fear of starting')"
                className="flex-grow bg-transparent px-6 py-4 text-lg text-gray-800 placeholder-gray-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !topic}
                className={`
                  px-8 py-4 rounded-2xl font-semibold text-white shadow-lg flex items-center justify-center gap-2
                  transition-all transform active:scale-95
                  ${loading || !topic ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}
                `}
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    <span>Riff</span>
                  </>
                )}
              </button>
            </form>
          </div>
          <p className="text-center mt-4 text-gray-500 text-sm">
            Using <span className="font-semibold">{model === GeminiModel.PRO ? 'Gemini 2.5 Pro' : 'Gemini Flash'}</span> with Google Search Grounding
          </p>
        </section>

        {/* Feedback Messages */}
        {error && (
          <div className="w-full max-w-2xl mx-auto p-4 rounded-xl bg-red-50/80 border border-red-200 text-red-600 text-center animate-fade-in">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="w-full max-w-2xl mx-auto p-4 rounded-xl bg-green-50/80 border border-green-200 text-green-700 text-center animate-fade-in">
            {successMsg}
          </div>
        )}

        {/* Results Section */}
        {posts.length > 0 && (
          <section className="animate-fade-in w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {posts.map((post, index) => (
                <div key={index} className="h-full">
                  <BlogPostCard 
                    post={post} 
                    onSaveLocal={handleSaveLocally} 
                    onSaveDrive={handleSaveToDrive}
                  />
                </div>
              ))}
            </div>

            {/* Sources Attribution */}
            {sources.length > 0 && (
              <div className="mt-12 glass-panel rounded-xl p-6 max-w-2xl mx-auto">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Grounding Sources</h4>
                <div className="flex flex-wrap gap-2">
                  {sources.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate max-w-[200px] bg-white/50 px-2 py-1 rounded border border-blue-100"
                    >
                      {new URL(src).hostname}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      
      <footer className="mt-12 text-center text-gray-400 text-sm pb-6 relative z-10">
        <p>Built with React, Gemini & IndexedDB.</p>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        googleClientId={googleClientId}
        model={model}
        onSave={handleSaveSettings}
      />

      <SavedPostsModal 
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        posts={savedPosts}
        onDelete={handleDeleteSaved}
      />
    </div>
  );
}

export default App;
