import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Settings, 
  Send, 
  LayoutDashboard, 
  FileText, 
  Calendar as CalendarIcon,
  MoreVertical, 
  BrainCircuit,
  GraduationCap,
  Loader2,
  ImagePlus,
  AlertCircle,
  CheckCircle2,
  Download,
  Clock,
  ChevronRight,
  Trash2,
  LogOut,
  User,
  ArrowLeft,
  X,
  Compass
} from 'lucide-react';

// =========================================================================
// 【重要】本番環境（Vercel）で動かすための最終ステップ
// 以下の1行の先頭の「// 」を必ず消して保存してください！
// =========================================================================
import { createClient } from '@supabase/supabase-js';

// 一番安定して動作していた読み込み方に修正（＋白画面クラッシュの完全防止策）
const getEnvVar = (key) => {
  try {
    // プレビュー環境など import.meta 自体が存在しない場合のエラーを回避
    if (typeof import.meta === 'undefined' || !import.meta.env) return '';
    
    // Viteのビルド時に確実に置換させるための直接指定
    if (key === 'VITE_SUPABASE_URL') return import.meta.env.VITE_SUPABASE_URL || '';
    if (key === 'VITE_SUPABASE_ANON_KEY') return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (key === 'VITE_GEMINI_API_KEY') return import.meta.env.VITE_GEMINI_API_KEY || '';
    
    return import.meta.env[key] || '';
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
const globalGeminiKey = getEnvVar('VITE_GEMINI_API_KEY');

const isCreateClientImported = typeof createClient !== 'undefined';
const hasEnvVars = !!(supabaseUrl && supabaseAnonKey);
const isSupabaseReady = isCreateClientImported && hasEnvVars;

let supabase;

if (isSupabaseReady) {
  // @ts-ignore
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ error: null }),
      signUp: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null, data: { user: {} } })
    },
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null })
      }),
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  };
}

const INITIAL_CHAT = [
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIアシスタントです。学習の質問やノート内容の深掘りなど、何でも聞いてください。' }
];

// 環境変数やインポートの状況をチェックする共通関数
const checkReadyState = () => {
  if (!isCreateClientImported) {
    throw new Error("28行目のコメントアウト (import { createClient }...) が外されていません。");
  }
  const missing = [];
  if (!supabaseUrl) missing.push("URL");
  if (!supabaseAnonKey) missing.push("ANON_KEY");
  
  if (missing.length > 0) {
    throw new Error(`Supabaseの ${missing.join(' と ')} がVercelから読み込めていません。Vercel上で「Redeploy」を実行してください。`);
  }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitLoading, setIsAuthSubmitLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [notes, setNotes] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState({ type: null, text: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [selectedNote, setSelectedNote] = useState(null);
  const [relevanceAnalysis, setRelevanceAnalysis] = useState({ loading: false, text: null, error: null });
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', subject: '', preview: '', tags: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  
  const [profileForm, setProfileForm] = useState({ kosen: '', department: '', grade: '' });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);

  const [events, setEvents] = useState({});
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isSupabaseReady) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        handleSessionUpdate(session);
        setIsAuthLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        handleSessionUpdate(session);
      });

      return () => subscription.unsubscribe();
    } else {
      setIsAuthLoading(false);
    }
  }, []);

  const handleSessionUpdate = (currentSession) => {
    setSession(currentSession);
    if (currentSession?.user?.user_metadata) {
      const meta = currentSession.user.user_metadata;
      setProfileForm({ kosen: meta.kosen || '', department: meta.department || '', grade: meta.grade || '' });
      if (!meta.kosen) setIsProfileModalOpen(true);
    } else if (currentSession) {
      setIsProfileModalOpen(true);
    }
  };

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('notes').select('*').order('date', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) setNotes(data);
      else setNotes([]);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchNotes();
    else { setNotes([]); setProfileForm({ kosen: '', department: '', grade: '' }); }
  }, [session]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const getCalendarDays = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dayNum: i, dateStr });
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return { days, year, month };
  };
  const calendarData = getCalendarDays();

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsProfileUpdating(true);
    try {
      if (isSupabaseReady) {
        const { data, error } = await supabase.auth.updateUser({ data: { kosen: profileForm.kosen, department: profileForm.department, grade: profileForm.grade } });
        if (error) throw error;
        setSession({ ...session, user: data.user });
      } else {
        await new Promise(r => setTimeout(r, 1000));
        setSession({ ...session, user: { ...session.user, user_metadata: profileForm } });
      }
      setIsProfileModalOpen(false);
      if (activeView === 'settings') {
        setAnalyzeMessage({ type: 'success', text: 'プロフィールを更新しました。' });
        setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 3000);
      }
    } catch (err) {
      if (activeView === 'settings') setAnalyzeMessage({ type: 'error', text: 'プロフィールの更新に失敗しました。' });
    } finally {
      setIsProfileUpdating(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return setAuthError('入力してください。');
    setIsAuthSubmitLoading(true); setAuthError('');
    try {
      if (isSupabaseReady) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('登録確認メールを送信しました。リンクをクリックしてください。');
      } else {
        await new Promise(r => setTimeout(r, 1000));
        setSession({ user: { id: 'preview-id', email, user_metadata: {} } });
        setIsProfileModalOpen(true);
      }
    } catch (err) { setAuthError(err.message); } 
    finally { setIsAuthSubmitLoading(false); }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return setAuthError('入力してください。');
    setIsAuthSubmitLoading(true); setAuthError('');
    try {
      if (isSupabaseReady) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        await new Promise(r => setTimeout(r, 1000));
        setSession({ user: { id: 'preview-id', email, user_metadata: { kosen: '東京' } } });
      }
    } catch (err) { setAuthError('ログインに失敗しました。'); } 
    finally { setIsAuthSubmitLoading(false); }
  };

  const handleSignOut = async () => {
    if (isSupabaseReady) await supabase.auth.signOut();
    else setSession(null);
  };

  // 白画面クラッシュを防ぐため、Array.isArrayでチェックを強化
  const filteredNotes = Array.isArray(notes) ? notes.filter(note => {
    const q = searchQuery.toLowerCase();
    return (
      (note.title && note.title.toLowerCase().includes(q)) ||
      (note.subject && note.subject.toLowerCase().includes(q)) ||
      (note.preview && note.preview.toLowerCase().includes(q)) ||
      (Array.isArray(note.tags) && note.tags.some(t => typeof t === 'string' && t.toLowerCase().includes(q)))
    );
  }) : [];

  const deleteNote = async (id) => {
    if (!window.confirm("このノートを完全に削除しますか？")) { setMenuOpenId(null); return; }
    try {
      checkReadyState();
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      setNotes(prev => prev.filter(n => n.id !== id));
      setAnalyzeMessage({ type: 'success', text: 'ノートを削除しました。' });
      if (selectedNote?.id === id) setSelectedNote(null);
    } catch (err) {
      setAnalyzeMessage({ type: 'error', text: `${err.message}` });
    } finally {
      setMenuOpenId(null);
      setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 3000);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newNote.title || !newNote.subject || !session) return;
    setIsAdding(true); setAnalyzeMessage({ type: null, text: null });
    try {
      checkReadyState();
      const parsedTags = newNote.tags.split(',').map(t => t.trim()).filter(Boolean);
      const noteData = {
        title: newNote.title, subject: newNote.subject, preview: newNote.preview, tags: parsedTags,
        date: new Date().toISOString().split('T')[0], user_id: session.user.id
      };
      const { error } = await supabase.from('notes').insert([noteData]);
      if (error) throw error;
      await fetchNotes();
      setAnalyzeMessage({ type: 'success', text: '手動で追加しました！' });
      setIsAddModalOpen(false); setNewNote({ title: '', subject: '', preview: '', tags: '' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: `${err.message}` }); } 
    finally { setIsAdding(false); setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 5000); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setIsAnalyzing(true); setAnalyzeMessage({ type: null, text: null });
    try {
      checkReadyState();
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
      if (!globalGeminiKey) throw new Error("VITE_GEMINI_API_KEY がVercelに設定されていません。");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${globalGeminiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [
          { text: "提供された画像から学習ノートの情報を抽出し、JSON形式で返してください。純粋なJSONのみを返してください。\n{\n  \"title\": \"ノートのタイトル\",\n  \"subject\": \"科目名\",\n  \"preview\": \"内容の要約(150文字程度)\",\n  \"tags\": [\"タグ1\", \"タグ2\"]\n}" },
          { inlineData: { mimeType: file.type, data: base64Data } }
        ]}]})
      });
      if (!response.ok) throw new Error(`API通信エラー: ${response.status}`);
      const result = await response.json();
      let aiText = result.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(aiText.replace(/```json/gi, '').replace(/```/g, '').trim());
      const { error } = await supabase.from('notes').insert([{
        ...parsedData, date: new Date().toISOString().split('T')[0], user_id: session.user.id
      }]);
      if (error) throw error;
      await fetchNotes();
      setAnalyzeMessage({ type: 'success', text: '画像解析に成功し保存されました！' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: `${err.message}` }); } 
    finally { setIsAnalyzing(false); if (fileInputRef.current) fileInputRef.current.value = ''; setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 7000); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userText }]);
    setChatInput(''); setIsChatLoading(true);
    try {
      if (!globalGeminiKey) {
        await new Promise(r => setTimeout(r, 1000));
        setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'APIキー未設定のデモモードです。' }]);
        return;
      }
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${globalGeminiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `あなたは高専生をサポートする優秀なAIアシスタントです。質問: ${userText}` }] }] })
      });
      if (!response.ok) throw new Error("API通信エラー");
      const result = await response.json();
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: result.candidates[0].content.parts[0].text }]);
    } catch (err) { setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: "エラーが発生しました。" }]); } 
    finally { setIsChatLoading(false); }
  };

  const handleAnalyzeRelevance = async (note) => {
    setRelevanceAnalysis({ loading: true, text: null, error: null });
    try {
      if (!globalGeminiKey) throw new Error("VITE_GEMINI_API_KEY が設定されていません。");
      
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${globalGeminiKey}`;
      const prompt = `あなたは高専生をサポートするAIです。以下のノートの内容から、この知識が高専の各学科（機械、電気、情報、建築、化学など）において、具体的にどのような専門科目や将来の実務で活用されるか（役立つか）を推定し、高専生がモチベーションを持てるように分かりやすく教えてください。

【ノート情報】
タイトル: ${note.title}
科目: ${note.subject}
内容: ${note.preview}
タグ: ${Array.isArray(note.tags) ? note.tags.join(', ') : ''}

出力形式: 学科ごとの活用例を箇条書きなどで簡潔にまとめてください。`;

      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
      });

      if (!response.ok) throw new Error("API通信エラー");
      const result = await response.json();
      const aiText = result.candidates[0].content.parts[0].text;

      setRelevanceAnalysis({ loading: false, text: aiText, error: null });
    } catch (err) {
      setRelevanceAnalysis({ loading: false, text: null, error: err.message });
    }
  };

  const renderNoteCard = (note) => (
    <div 
      key={note.id} 
      onClick={() => setSelectedNote(note)}
      className="bg-[#11192a] border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 hover:bg-[#162136] transition-all duration-300 cursor-pointer group flex flex-col shadow-xl h-full min-h-[260px] relative"
    >
      <div className="flex justify-between items-start mb-4 shrink-0">
        <span className="text-[10px] font-black px-2.5 py-1 rounded bg-[#1e293b] text-emerald-400 border border-emerald-500/20 uppercase tracking-tighter shadow-sm">
          {note.subject}
        </span>
        <div className="relative z-20">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === note.id ? null : note.id); }} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-600 hover:text-slate-200">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpenId === note.id && (
            <div className="absolute right-0 top-8 w-32 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="w-full text-left px-4 py-3 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> 削除する
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 mb-4 flex flex-col justify-start overflow-hidden">
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2">{note.title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed font-medium line-clamp-3">{note.preview}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-slate-800/50 flex flex-col gap-3 shrink-0">
        <div className="flex items-center text-[10px] text-slate-500 font-mono font-bold tracking-tight">
          <Clock className="w-3 h-3 mr-1.5 text-emerald-500/60" />{note.date}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.isArray(note.tags) && note.tags.map((tag, idx) => (
            <span key={idx} className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#1e293b] text-slate-300 border border-slate-700/50 transition-colors hover:border-emerald-500/40">#{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );

  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'notes', label: 'マイノート', icon: BookOpen },
    { id: 'archive', label: '過去問・資料', icon: FileText },
    { id: 'calendar', label: 'カレンダー', icon: CalendarIcon },
  ];

  if (isAuthLoading) {
    return <div className="flex h-screen w-full bg-[#0a0f18] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 font-sans items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full"></div>
        <div className="w-full max-w-md bg-[#0d1424]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 mx-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <GraduationCap className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-white mb-2 uppercase tracking-widest">KOSEN-base</h1>
          <p className="text-center text-slate-400 text-xs font-medium mb-8">自分のアカウントでノートを管理しましょう</p>
          <form className="space-y-5">
            <div className="flex bg-[#161f33] p-1 rounded-xl mb-6">
              <button type="button" onClick={() => { setIsLoginMode(true); setAuthError(''); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isLoginMode ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>ログイン</button>
              <button type="button" onClick={() => { setIsLoginMode(false); setAuthError(''); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isLoginMode ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>新規登録</button>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm shadow-inner" placeholder="kosen@example.ac.jp" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm shadow-inner" placeholder="••••••••" />
            </div>
            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /><p className="text-red-400 text-xs font-medium leading-relaxed">{authError}</p>
              </div>
            )}
            <div className="pt-4">
              {isLoginMode ? (
                <button onClick={handleSignIn} disabled={isAuthSubmitLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center justify-center disabled:opacity-50">
                  {isAuthSubmitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ログイン'}
                </button>
              ) : (
                <button onClick={handleSignUp} disabled={isAuthSubmitLoading} className="w-full bg-[#161f33] hover:bg-slate-700 text-white py-3.5 rounded-xl font-bold transition-all border border-slate-700 active:scale-95 flex items-center justify-center disabled:opacity-50">
                  {isAuthSubmitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '新規登録して始める'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 font-sans overflow-hidden relative">
      {/* 画面外クリック検知 */}
      {menuOpenId && <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)}></div>}

      {/* --- 全画面対応：ノート詳細表示モーダル --- */}
      {selectedNote && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-300"
          onClick={() => { setSelectedNote(null); setRelevanceAnalysis({ loading: false, text: null, error: null }); }}
        >
          <div 
            className="bg-[#0d1424] border border-slate-700 rounded-3xl p-6 sm:p-10 w-full h-full max-w-5xl shadow-2xl relative flex flex-col animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6 shrink-0 border-b border-slate-800 pb-6">
              <div className="pr-4">
                <span className="text-xs font-black px-3 py-1.5 rounded bg-[#1e293b] text-emerald-400 border border-emerald-500/20 uppercase tracking-widest shadow-sm mb-4 inline-block">
                  {selectedNote.subject}
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">{selectedNote.title}</h2>
              </div>
              <button onClick={() => { setSelectedNote(null); setRelevanceAnalysis({ loading: false, text: null, error: null }); }} className="p-3 bg-slate-800/50 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors shrink-0">
                 <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-8">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" /> ノート内容
                </h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap font-medium text-base sm:text-lg">
                  {selectedNote.preview}
                </p>
              </div>

              {/* AIによる専門分野活用推定セクション */}
              <div className="bg-[#161f33] border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center">
                    <Compass className="w-4 h-4 mr-2" /> 将来の活用分野をAIに聞く
                  </h3>
                  {!relevanceAnalysis.text && !relevanceAnalysis.loading && (
                    <button 
                      onClick={() => handleAnalyzeRelevance(selectedNote)}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center shadow-lg"
                    >
                      <BrainCircuit className="w-3.5 h-3.5 mr-1.5" />
                      AIで分析する
                    </button>
                  )}
                </div>

                {relevanceAnalysis.loading && (
                  <div className="flex items-center text-slate-400 text-sm py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-500 mr-3" />
                    AIが各学科での活用方法を考えています...
                  </div>
                )}

                {relevanceAnalysis.error && (
                  <div className="text-red-400 text-sm py-2">
                    エラー: {relevanceAnalysis.error}
                  </div>
                )}

                {relevanceAnalysis.text && (
                  <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap mt-4 animate-in fade-in duration-500 p-4 bg-[#0d1424] rounded-xl border border-slate-800">
                    {relevanceAnalysis.text}
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-4">
              <div className="flex items-center text-sm text-slate-500 font-mono font-bold tracking-tight">
                <Clock className="w-4 h-4 mr-2 text-emerald-500/60" />
                {selectedNote.date}
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(selectedNote.tags) && selectedNote.tags.map((tag, idx) => (
                  <span key={idx} className="text-xs font-black px-3 py-1.5 rounded-full bg-[#1e293b] text-slate-300 border border-slate-700/50">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- カレンダー予定追加モーダル --- */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-white mb-6 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2 text-emerald-500" />
              予定を追加
            </h2>
            <p className="text-xs text-slate-400 mb-4 font-mono">{selectedDate}</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newEventTitle.trim()) return;
              setEvents(prev => ({
                ...prev,
                [selectedDate]: [...(prev[selectedDate] || []), { id: Date.now(), title: newEventTitle.trim() }]
              }));
              setNewEventTitle('');
              setIsEventModalOpen(false);
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">予定のタイトル</label>
                <input 
                  type="text" autoFocus required 
                  value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} 
                  className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm shadow-inner" 
                  placeholder="レポート提出期限..." 
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => {setIsEventModalOpen(false); setNewEventTitle('');}} className="flex-1 bg-[#161f33] hover:bg-slate-700 text-white py-3 rounded-xl font-bold border border-slate-700 text-sm">キャンセル</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm">追加する</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 初期プロフィール設定モーダル */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner mb-6 mx-auto">
              <User className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-black text-white text-center mb-2">プロフィール設定</h2>
            <p className="text-xs text-slate-400 text-center mb-6">あなたに合った学習環境を作るために教えてください</p>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">高専名</label>
                <input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" placeholder="例: 東京" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">学科</label>
                <input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" placeholder="例: 情報工学科" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">学年</label>
                <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm appearance-none">
                  <option value="" disabled>選択してください</option>
                  <option value="1年">1年</option>
                  <option value="2年">2年</option>
                  <option value="3年">3年</option>
                  <option value="4年">4年</option>
                  <option value="5年">5年</option>
                  <option value="専攻科1年">専攻科1年</option>
                  <option value="専攻科2年">専攻科2年</option>
                </select>
              </div>
              <button type="submit" disabled={isProfileUpdating} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center mt-6 disabled:opacity-50">
                {isProfileUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'KOSEN-base を始める'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 手動追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-white mb-6 flex items-center"><Plus className="w-5 h-5 mr-2 text-emerald-500" />手動でノートを追加</h2>
            <form onSubmit={handleManualAdd} className="space-y-4">
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">タイトル (必須)</label><input type="text" required value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" placeholder="線形代数 第1回..." /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">科目 (必須)</label><input type="text" required value={newNote.subject} onChange={e => setNewNote({...newNote, subject: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" placeholder="数学" /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">要約 / 内容</label><textarea value={newNote.preview} onChange={e => setNewNote({...newNote, preview: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm h-24 resize-none" placeholder="主な内容..." /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">タグ (カンマ区切り)</label><input type="text" value={newNote.tags} onChange={e => setNewNote({...newNote, tags: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" placeholder="前期, 課題..." /></div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-[#161f33] hover:bg-slate-700 text-white py-3 rounded-xl font-bold border border-slate-700 text-sm">キャンセル</button>
                <button type="submit" disabled={isAdding} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center text-sm disabled:opacity-50">{isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : '追加する'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* サイドバー */}
      <aside className="w-64 bg-[#0d1424] border-r border-slate-800 flex flex-col hidden md:flex z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <GraduationCap className="w-8 h-8 text-emerald-500 mr-3" />
          <h1 className="text-xl font-bold text-white tracking-wider uppercase">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setSelectedSubject(null); }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                activeView === item.id 
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon className={`w-5 h-5 mr-3 ${activeView === item.id ? 'text-emerald-400' : ''}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => { setActiveView('settings'); setSelectedSubject(null); }}
            className={`w-full flex items-center px-4 py-2 text-sm transition-colors group mb-2 rounded-xl ${activeView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            <Settings className="w-4 h-4 mr-3 group-hover:rotate-45 transition-transform" />
            設定
          </button>
          
          <div onClick={handleSignOut} className="flex items-center px-3 py-2 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors group">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold mr-3 shadow-md border border-emerald-400/20 uppercase">
              {session.user.user_metadata?.kosen ? session.user.user_metadata.kosen[0] : 'U'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-slate-100 truncate">
                {session.user.user_metadata?.kosen ? `${session.user.user_metadata.kosen}高専` : 'User'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono tracking-tight group-hover:text-red-400 transition-colors flex items-center mt-0.5 truncate">
                {session.user.user_metadata?.grade ? `${session.user.user_metadata.grade} / ${session.user.user_metadata.department}` : '未設定'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0f18] overflow-hidden relative z-20">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-[#0d1424]/80 backdrop-blur-md shrink-0">
          <div className="flex-1 max-w-2xl">
            <div className="relative group">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="自分のノートを検索..." 
                className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium"
              />
            </div>
          </div>
          
          <div className="ml-4 flex items-center space-x-3">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex items-center bg-[#161f33] hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm shadow-md">
              {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-500" /> : <ImagePlus className="w-4 h-4 mr-2 text-emerald-500" />} {isAnalyzing ? '解析中...' : '画像を追加'}
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-900/20 text-sm flex items-center active:scale-95">
              <Plus className="w-4 h-4 mr-1" /> 新規
            </button>
          </div>
        </header>
        
        {analyzeMessage.text && (
          <div className="px-6 pt-4 shrink-0 absolute top-16 left-0 right-0 z-30">
            <div className={`border px-4 py-3 rounded-lg flex items-start space-x-3 shadow-2xl animate-in slide-in-from-top duration-300 ${analyzeMessage.type === 'error' ? 'bg-red-950/90 border-red-800 text-red-200' : 'bg-emerald-950/90 border-emerald-800 text-emerald-200'}`}>
              {analyzeMessage.type === 'error' ? <AlertCircle className="w-5 h-5 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 mt-0.5" />}
              <div className="flex-1 text-sm font-medium">
                <h3 className="font-black text-[10px] uppercase tracking-widest mb-0.5">{analyzeMessage.type === 'error' ? 'ERROR' : 'SUCCESS'}</h3>
                <p className="opacity-90">{analyzeMessage.text}</p>
                <button onClick={() => setAnalyzeMessage({type: null, text: null})} className="mt-2 text-[10px] font-black uppercase tracking-widest hover:opacity-100 opacity-60 underline transition-opacity">閉じる</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {activeView === 'dashboard' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white flex items-center tracking-tight">
                  <LayoutDashboard className="w-6 h-6 mr-3 text-emerald-500" />
                  {searchQuery ? `「${searchQuery}」の検索結果` : '最近のノート'}
                </h2>
                <div className="text-sm text-slate-500 font-bold flex items-center hover:text-emerald-400 cursor-pointer transition-colors group">
                  すべて表示 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" /><p className="text-xs font-black uppercase tracking-widest opacity-50">Syncing...</p></div>
              ) : filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500"><Search className="w-12 h-12 mb-4 opacity-20" /><p className="font-bold">ノートが見つかりません</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredNotes.map(renderNoteCard)}
                </div>
              )}
            </div>
          )}

          {activeView === 'notes' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom duration-500">
              {!selectedSubject ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-500/20">
                    <BookOpen className="w-12 h-12 text-emerald-500" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-3 tracking-tight">マイノート</h2>
                  <p className="text-slate-400 max-w-lg mx-auto font-medium mb-12">保存済みノートを科目別に一括管理します。</p>
                  
                  {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500">
                      <p className="font-bold">まだノートがありません</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-5xl mx-auto">
                      {Array.from(new Set(notes.map(n => n.subject).filter(Boolean))).map(sub => {
                        const count = notes.filter(n => n.subject === sub).length;
                        return (
                          <div key={sub} onClick={() => setSelectedSubject(sub)} className="p-6 bg-[#0d1424] border border-slate-800 rounded-2xl hover:border-emerald-500/40 hover:bg-[#162136] transition-all flex items-center justify-between cursor-pointer group shadow-lg">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mr-4 group-hover:bg-emerald-600 transition-colors shadow-md border border-slate-700">
                                <FileText className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-100 text-lg">{sub}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{count} Items</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-500" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in duration-300">
                  <button onClick={() => setSelectedSubject(null)} className="flex items-center text-slate-400 hover:text-emerald-400 font-bold text-sm mb-6 transition-colors group">
                    <ArrowLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                    科目一覧へ戻る
                  </button>
                  <h2 className="text-2xl font-black text-white mb-8 flex items-center border-b border-slate-800 pb-4">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center mr-3 border border-emerald-500/30">
                      <BookOpen className="w-4 h-4 text-emerald-500" />
                    </div>
                    {selectedSubject} のノート
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {notes.filter(n => n.subject === selectedSubject).map(renderNoteCard)}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'archive' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white flex items-center mb-8"><FileText className="w-6 h-6 mr-3 text-emerald-500" />過去問・資料</h2>
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm font-medium">
                  <thead className="bg-[#11192a] text-slate-400 font-black uppercase tracking-widest text-[10px] border-b border-slate-800">
                    <tr><th className="px-8 py-5">ファイル名</th><th className="px-8 py-5">科目</th><th className="px-8 py-5">カテゴリ</th><th className="px-8 py-5 text-right">操作</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    <tr><td colSpan="4" className="px-8 py-10 text-center text-slate-500 text-sm font-bold border-none">まだ資料がありません</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-top duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white flex items-center tracking-tight">
                  <CalendarIcon className="w-6 h-6 mr-3 text-emerald-500" />
                  予定カレンダー <span className="ml-4 text-sm text-slate-500 font-medium">({calendarData.year}年 {calendarData.month + 1}月)</span>
                </h2>
              </div>
              
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                  <div key={day} className="bg-[#11192a] py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">{day}</div>
                ))}
                
                {calendarData.days.map((dayObj, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      if (dayObj) {
                        setSelectedDate(dayObj.dateStr);
                        setIsEventModalOpen(true);
                      }
                    }}
                    className={`bg-[#0d1424] min-h-[120px] p-3 transition-all duration-300 relative ${dayObj ? 'hover:bg-slate-800/40 cursor-pointer group' : 'opacity-50'}`}
                  >
                    {dayObj && (
                      <>
                        <span className={`text-[11px] font-mono transition-colors ${dayObj.dateStr === new Date().toISOString().split('T')[0] ? 'text-emerald-400 font-black text-sm' : 'text-slate-500 group-hover:text-slate-300'}`}>
                          {dayObj.dayNum}
                        </span>
                        
                        <div className="mt-2 space-y-1">
                          {events[dayObj.dateStr]?.map(ev => (
                            <div key={ev.id} className="p-1.5 bg-emerald-500/15 border-l-2 border-emerald-500 rounded text-[10px] text-emerald-100 font-bold flex justify-between items-center group/event">
                              <span className="truncate">{ev.title}</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEvents(prev => ({
                                    ...prev,
                                    [dayObj.dateStr]: prev[dayObj.dateStr].filter(item => item.id !== ev.id)
                                  }));
                                }}
                                className="text-emerald-400 hover:text-red-400 opacity-0 group-hover/event:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="max-w-2xl mx-auto py-8 animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white mb-8 flex items-center">
                <Settings className="w-6 h-6 mr-3 text-emerald-500" />
                アカウント設定
              </h2>
              
              <div className="bg-[#0d1424] border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-6 border-b border-slate-800 pb-4">プロフィール</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">メールアドレス</label>
                    <input type="text" disabled value={session?.user?.email || ''} className="w-full bg-[#161f33]/50 border border-slate-800 text-slate-500 rounded-xl px-4 py-3 text-sm cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">高専名</label>
                    <input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm shadow-inner" placeholder="例: 東京" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">学科</label>
                      <input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm shadow-inner" placeholder="例: 情報工学科" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">学年</label>
                      <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm appearance-none shadow-inner">
                        <option value="" disabled>選択してください</option>
                        <option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option>
                        <option value="4年">4年</option><option value="5年">5年</option>
                        <option value="専攻科1年">専攻科1年</option><option value="専攻科2年">専攻科2年</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <button type="submit" disabled={isProfileUpdating} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center disabled:opacity-50 text-sm">
                      {isProfileUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      変更を保存
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右サイドバー (AI Chat) */}
      <aside className="w-80 bg-[#0d1424] border-l border-slate-800 flex flex-col hidden lg:flex shrink-0 shadow-2xl relative z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-[#0d1424]">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center mr-4 border border-emerald-500/20"><BrainCircuit className="w-6 h-6 text-emerald-400" /></div>
          <div><h2 className="font-black text-slate-100 text-[11px] tracking-widest uppercase">KOSEN AI</h2><div className="flex items-center mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span><span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Connected</span></div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans scrollbar-hide">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in duration-300`}>
              <div className={`max-w-[90%] rounded-2xl p-4 leading-relaxed shadow-xl text-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none font-medium' : 'bg-[#161f33] text-slate-200 border border-slate-700/50 rounded-tl-none font-medium'}`}>{msg.text}</div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start animate-in fade-in duration-300"><div className="bg-[#161f33] text-slate-400 border border-slate-700/50 rounded-2xl rounded-tl-none p-4 flex items-center space-x-2"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /><span className="text-xs font-bold">考え中...</span></div></div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-6 border-t border-slate-800 bg-[#0d1424]">
          <form onSubmit={handleSendMessage} className="relative group">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="AIに学習内容を質問..." disabled={isChatLoading} className="w-full bg-[#161f33] border border-slate-700 text-xs rounded-2xl pl-5 pr-12 py-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600 shadow-inner disabled:opacity-50" />
            <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-2.5 top-2.5 p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-lg active:scale-90 disabled:opacity-50 disabled:hover:bg-emerald-600"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      </aside>
    </div>
  );
}