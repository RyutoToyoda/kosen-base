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
  Compass,
  Bookmark,
  Filter,
  Layers
} from 'lucide-react';

// =========================================================================
// 【重要】本番環境（Vercel）で動かすための最終ステップ
// 以下の1行の先頭の「// 」を必ず消して保存してください！
// =========================================================================
import { createClient } from '@supabase/supabase-js';

// 環境変数の読み込みエラー（import.meta）を回避するための安全なアクセス
const getSafeEnv = (key) => {
  try {
    // @ts-ignore
    return import.meta.env[key] || '';
  } catch (e) {
    return '';
  }
};

const SUPABASE_URL = getSafeEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getSafeEnv('VITE_SUPABASE_ANON_KEY');
const GEMINI_API_KEY = getSafeEnv('VITE_GEMINI_API_KEY');

const isCreateClientImported = typeof createClient !== 'undefined';
const isSupabaseReady = isCreateClientImported && !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

let supabase;

if (isSupabaseReady) {
  // @ts-ignore
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIアシスタントです。学習の質問や過去問の分析など、何でも聞いてください。' }
];

const getItemType = (tags) => {
  if (!tags) return 'note';
  if (tags.includes('type:exam')) return 'exam';
  if (tags.includes('type:material')) return 'material';
  return 'note';
};

const getExamMeta = (tags) => {
  const meta = { grade: '未設定', term: '未設定', examType: '未設定' };
  tags?.forEach(t => {
    if (t.startsWith('grade:')) meta.grade = t.replace('grade:', '');
    if (t.startsWith('term:')) meta.term = t.replace('term:', '');
    if (t.startsWith('exam:')) meta.examType = t.replace('exam:', '');
  });
  return meta;
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
  const [newItemType, setNewItemType] = useState('note');
  const [newNote, setNewNote] = useState({ title: '', subject: '', preview: '', tags: '' });
  const [examMeta, setExamMeta] = useState({ grade: '1年', term: '前期', type: '中間' });
  const [isAdding, setIsAdding] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [examFilter, setExamFilter] = useState({ grade: '', term: '', type: '' });
  
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
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        handleSessionUpdate(currentSession);
      } catch (e) {
        console.error("Auth init error", e);
      } finally {
        setIsAuthLoading(false);
      }
    };
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionUpdate(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSessionUpdate = (currentSession) => {
    setSession(currentSession);
    if (currentSession?.user?.user_metadata) {
      const meta = currentSession.user.user_metadata;
      setProfileForm({ 
        kosen: meta.kosen || '', 
        department: meta.department || '', 
        grade: meta.grade || '' 
      });
      if (!meta.kosen && currentSession) setIsProfileModalOpen(true);
    } else if (currentSession) {
      setIsProfileModalOpen(true);
    }
  };

  const fetchNotes = async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('notes').select('*').order('date', { ascending: false });
      if (error) throw error;
      setNotes(data || []);
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

  const handleAddEvent = (e) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    setEvents(prev => ({
      ...prev,
      [selectedDate]: [...(prev[selectedDate] || []), { id: Date.now(), title: newEventTitle.trim() }]
    }));
    setNewEventTitle('');
    setIsEventModalOpen(false);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsProfileUpdating(true);
    try {
      if (isSupabaseReady) {
        const { data, error } = await supabase.auth.updateUser({ 
          data: { kosen: profileForm.kosen, department: profileForm.department, grade: profileForm.grade } 
        });
        if (error) throw error;
        setSession({ ...session, user: data.user });
      } else {
        await new Promise(r => setTimeout(r, 800));
        setSession({ ...session, user: { ...session.user, user_metadata: profileForm } });
      }
      setIsProfileModalOpen(false);
      setAnalyzeMessage({ type: 'success', text: 'プロフィールを更新しました。' });
      setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 3000);
    } catch (err) {
      setAnalyzeMessage({ type: 'error', text: '更新に失敗しました。' });
    } finally {
      setIsProfileUpdating(false);
    }
  };

  const checkReady = () => {
    if (!isCreateClientImported) throw new Error("28行目のコメントアウトを外してください。");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("環境変数が読み込めていません。VercelでRedeployをしてください。");
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newNote.title || !newNote.subject || !session) return;
    setIsAdding(true); setAnalyzeMessage({ type: null, text: null });
    try {
      checkReady();
      const parsedTags = newNote.tags.split(',').map(t => t.trim()).filter(Boolean);
      parsedTags.push(`type:${newItemType}`);
      if (newItemType === 'exam') {
        parsedTags.push(`grade:${examMeta.grade}`);
        parsedTags.push(`term:${examMeta.term}`);
        parsedTags.push(`exam:${examMeta.type}`);
      }
      const noteData = {
        title: newNote.title, subject: newNote.subject, preview: newNote.preview, tags: parsedTags,
        date: new Date().toISOString().split('T')[0], user_id: session.user.id
      };
      const { error } = await supabase.from('notes').insert([noteData]);
      if (error) throw error;
      await fetchNotes();
      setAnalyzeMessage({ type: 'success', text: '正常に追加されました！' });
      setIsAddModalOpen(false); setNewNote({ title: '', subject: '', preview: '', tags: '' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: `${err.message}` }); } 
    finally { setIsAdding(false); setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 5000); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setIsAnalyzing(true); setAnalyzeMessage({ type: null, text: null });
    try {
      checkReady();
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
      if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY が設定されていません。");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [
          { text: "学習ノートの画像を解析し、JSONで返してください。科目名は必ず含め、要約は詳細に抽出してください。\n{\n  \"title\": \"\",\n  \"subject\": \"\",\n  \"preview\": \"\",\n  \"tags\": []\n}" },
          { inlineData: { mimeType: file.type, data: base64Data } }
        ]}]})
      });
      if (!response.ok) throw new Error("AI解析エラー");
      const result = await response.json();
      const parsedData = JSON.parse(result.candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, '').trim());
      const finalTags = parsedData.tags || [];
      finalTags.push('type:note');
      const { error } = await supabase.from('notes').insert([{ ...parsedData, tags: finalTags, date: new Date().toISOString().split('T')[0], user_id: session.user.id }]);
      if (error) throw error;
      await fetchNotes();
      setAnalyzeMessage({ type: 'success', text: '画像からノートを生成しました！' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: `${err.message}` }); } 
    finally { setIsAnalyzing(false); setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 7000); }
  };

  const handleAnalyzeAI = async (item) => {
    setRelevanceAnalysis({ loading: true, text: null, error: null });
    try {
      if (!GEMINI_API_KEY) throw new Error("AIキーが設定されていません。");
      const type = getItemType(item.tags);
      const prompt = type === 'exam' 
        ? `あなたは高専の教員です。この過去問の内容を分析し、「どの単元・分野の問題か」を【分野】として1行で答え、その後に「この問題を解くためのポイント」を3点、簡潔に高専生に教えてください。\nタイトル: ${item.title}\n内容: ${item.preview}`
        : `この学習内容が、高専の各学科（機械・電気・情報・建築・物質）で将来どう使われるか、学科ごとに1行ずつ簡潔に教えてください。\nタイトル: ${item.title}\n内容: ${item.preview}`;
      
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
      });
      const result = await response.json();
      setRelevanceAnalysis({ loading: false, text: result.candidates[0].content.parts[0].text, error: null });
    } catch (err) { setRelevanceAnalysis({ loading: false, text: null, error: err.message }); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("削除してもよろしいですか？")) return;
    try {
      checkReady();
      await supabase.from('notes').delete().eq('id', id);
      setNotes(prev => prev.filter(n => n.id !== id));
      setSelectedNote(null);
    } catch (e) { setAnalyzeMessage({ type: 'error', text: e.message }); }
  };

  const getCalendarDays = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ dayNum: i, dateStr: `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}` });
    }
    return { days, year, month };
  };
  const calendarData = getCalendarDays();

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
        setSession({ user: { id: 'preview-id', email, user_metadata: { kosen: '東京', department: '情報', grade: '3年' } } });
      }
    } catch (err) { setAuthError('ログインに失敗しました。'); } 
    finally { setIsAuthSubmitLoading(false); }
  };

  const handleSignOut = async () => {
    if (isSupabaseReady) await supabase.auth.signOut();
    else setSession(null);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userText }]);
    setChatInput(''); setIsChatLoading(true);
    try {
      if (!GEMINI_API_KEY) {
        await new Promise(r => setTimeout(r, 1000));
        setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'APIキー未設定のデモモードです。' }]);
        return;
      }
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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

  const renderCard = (note) => {
    const type = getItemType(note.tags);
    const meta = type === 'exam' ? getExamMeta(note.tags) : null;
    return (
      <div key={note.id} onClick={() => setSelectedNote(note)} className="bg-[#11192a] border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 hover:bg-[#162136] transition-all cursor-pointer group flex flex-col shadow-xl h-full min-h-[260px] relative">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded border uppercase tracking-tighter ${type === 'exam' ? 'bg-red-950/30 text-red-400 border-red-500/20' : type === 'material' ? 'bg-blue-950/30 text-blue-400 border-blue-500/20' : 'bg-[#1e293b] text-emerald-400 border-emerald-500/20'}`}>
              {note.subject}
            </span>
            {type === 'exam' && <span className="text-[10px] font-black px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-tighter">{meta.grade} {meta.term}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); deleteItem(note.id); }} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors line-clamp-2">{note.title}</h3>
        <p className="text-sm text-slate-400 line-clamp-3 mb-4 leading-relaxed">{note.preview}</p>
        <div className="mt-auto pt-4 border-t border-slate-800/50 flex items-center text-[10px] text-slate-500 font-mono font-bold tracking-tight">
          <Clock className="w-3 h-3 mr-1.5 text-emerald-500/60" />{note.date}
        </div>
      </div>
    );
  };

  const filteredItems = notes.filter(note => {
    const q = searchQuery.toLowerCase();
    return (
      (note.title && note.title.toLowerCase().includes(q)) ||
      (note.subject && note.subject.toLowerCase().includes(q)) ||
      (note.preview && note.preview.toLowerCase().includes(q)) ||
      (note.tags && note.tags.some(t => t.toLowerCase().includes(q)))
    );
  });

  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'notes', label: 'マイノート', icon: BookOpen },
    { id: 'exams', label: '過去問', icon: FileText },
    { id: 'materials', label: '学習資料', icon: Bookmark },
    { id: 'calendar', label: 'カレンダー', icon: CalendarIcon },
  ];

  if (isAuthLoading) return <div className="flex h-screen w-full bg-[#0a0f18] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;

  if (!session) {
    return (
      <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/5 blur-[100px] rounded-full"></div>
        <div className="w-full max-w-md bg-[#0d1424]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 mx-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <GraduationCap className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-white mb-8 uppercase tracking-widest">KOSEN-base</h1>
          <form className="space-y-5" onSubmit={isLoginMode ? handleSignIn : handleSignUp}>
            <div className="flex bg-[#161f33] p-1 rounded-xl mb-6">
              <button type="button" onClick={() => setIsLoginMode(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isLoginMode ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>ログイン</button>
              <button type="button" onClick={() => setIsLoginMode(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isLoginMode ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>新規登録</button>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-emerald-500" placeholder="メールアドレス" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-emerald-500" placeholder="パスワード" />
            {authError && <div className="text-red-400 text-xs flex items-center bg-red-400/10 p-3 rounded-lg"><AlertCircle className="w-4 h-4 mr-2 shrink-0" />{authError}</div>}
            <button type="submit" disabled={isAuthSubmitLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center disabled:opacity-50">
              {isAuthSubmitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLoginMode ? 'ログイン' : '新規登録して始める')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 font-sans overflow-hidden">
      
      {/* 詳細モーダル (全画面) */}
      {selectedNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8 animate-in fade-in" onClick={() => setSelectedNote(null)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-6 sm:p-10 w-full h-full max-w-5xl shadow-2xl relative flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6 shrink-0 border-b border-slate-800 pb-6">
              <div className="flex-1 pr-8">
                <div className="flex gap-2 mb-4">
                  <span className="text-xs font-black px-3 py-1.5 rounded bg-[#1e293b] text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">{selectedNote.subject}</span>
                  {getItemType(selectedNote.tags) === 'exam' && <span className="text-xs font-black px-3 py-1.5 rounded bg-red-950/30 text-red-400 border border-red-500/20">{getExamMeta(selectedNote.tags).grade} {getExamMeta(selectedNote.tags).term} {getExamMeta(selectedNote.tags).examType}</span>}
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">{selectedNote.title}</h2>
              </div>
              <button onClick={() => { setSelectedNote(null); setRelevanceAnalysis({ loading: false, text: null, error: null }); }} className="p-3 bg-slate-800/50 hover:bg-slate-700 rounded-full text-slate-400 hover:white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-8">
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center"><FileText className="w-4 h-4 mr-2" /> コンテンツ詳細</h4>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-lg">{selectedNote.preview}</p>
              </div>
              <div className="bg-[#161f33] border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center"><BrainCircuit className="w-4 h-4 mr-2" /> AI分析：{getItemType(selectedNote.tags) === 'exam' ? '出題分野と対策ポイント' : '将来の専門分野での活用'}</h4>
                  {!relevanceAnalysis.text && !relevanceAnalysis.loading && <button onClick={() => handleAnalyzeAI(selectedNote)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center shadow-lg transition-all"><Compass className="w-3 h-3 mr-1.5" />AIに聞く</button>}
                </div>
                {relevanceAnalysis.loading && <div className="flex items-center text-slate-400 text-sm py-4"><Loader2 className="w-5 h-5 animate-spin text-emerald-500 mr-3" />AIが解析中です...</div>}
                {relevanceAnalysis.text && <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap animate-in fade-in p-4 bg-[#0d1424] rounded-xl border border-slate-800">{relevanceAnalysis.text}</div>}
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <div className="flex items-center text-xs text-slate-500 font-mono font-bold tracking-tight"><Clock className="w-4 h-4 mr-2 text-emerald-500/60" />{selectedNote.date}</div>
              <div className="flex flex-wrap gap-2">{selectedNote.tags?.filter(t => !t.includes(':')).map((t, i) => <span key={i} className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#1e293b] text-slate-400 border border-slate-700/50">#{t}</span>)}</div>
            </div>
          </div>
        </div>
      )}

      {/* プロフィール設定モーダル */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-8 w-full max-md shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-emerald-500/20"><User className="w-8 h-8 text-emerald-500" /></div>
            <h2 className="text-xl font-black text-white text-center mb-6">プロフィール設定</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500" placeholder="所属高専 (例: 東京)" />
              <input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500" placeholder="学科名 (例: 情報工学科)" />
              <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm">
                <option value="" disabled>学年を選択</option>
                <option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option><option value="専攻科">専攻科</option>
              </select>
              <button type="submit" disabled={isProfileUpdating} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold shadow-lg active:scale-95 mt-6 flex justify-center">
                {isProfileUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'KOSEN-base を開始'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 新規追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-white mb-6 flex items-center"><Plus className="w-5 h-5 mr-2 text-emerald-500" /> 新規アイテム作成</h2>
            <div className="flex bg-[#161f33] p-1 rounded-xl mb-6">
              {['note', 'exam', 'material'].map(t => (
                <button key={t} onClick={() => setNewItemType(t)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${newItemType === t ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500'}`}>
                  {t === 'note' ? 'ノート' : t === 'exam' ? '過去問' : '資料'}
                </button>
              ))}
            </div>
            <form onSubmit={handleManualAdd} className="space-y-4">
              <input required type="text" value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500" placeholder="タイトル (例: 線形代数 第1回)" />
              {newItemType === 'exam' && (
                <div className="grid grid-cols-3 gap-2">
                  <select value={examMeta.grade} onChange={e => setExamMeta({...examMeta, grade: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-3 py-3 text-xs">
                    <option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option>
                  </select>
                  <select value={examMeta.term} onChange={e => setExamMeta({...examMeta, term: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-3 py-3 text-xs">
                    <option value="前期">前期</option><option value="後期">後期</option>
                  </select>
                  <select value={examMeta.type} onChange={e => setExamMeta({...examMeta, type: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-3 py-3 text-xs">
                    <option value="中間">中間</option><option value="期末">期末</option><option value="小テスト">小テスト</option>
                  </select>
                </div>
              )}
              <input required type="text" value={newNote.subject} onChange={e => setNewNote({...newNote, subject: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500" placeholder="科目 (例: 数学)" />
              <textarea value={newNote.preview} onChange={e => setNewNote({...newNote, preview: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm h-24 resize-none focus:border-emerald-500" placeholder="要約や内容、問題の抜粋..." />
              <input type="text" value={newNote.tags} onChange={e => setNewNote({...newNote, tags: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500" placeholder="タグ (カンマ区切り)" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-[#161f33] text-white py-3 rounded-xl font-bold border border-slate-700">中止</button>
                <button type="submit" disabled={isAdding} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold flex justify-center">
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* カレンダー予定追加モーダル */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsEventModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-white mb-6 flex items-center"><CalendarIcon className="w-5 h-5 mr-2 text-emerald-500" /> 予定を追加</h2>
            <p className="text-xs text-slate-500 mb-4 font-mono">{selectedDate}</p>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <input type="text" autoFocus required value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 shadow-inner" placeholder="予定タイトル (例: レポート締切)" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsEventModalOpen(false)} className="flex-1 bg-[#161f33] text-white py-3 rounded-xl font-bold border border-slate-700">中止</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold">追加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* サイドバー */}
      <aside className="w-64 bg-[#0d1424] border-r border-slate-800 flex flex-col hidden md:flex z-20 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <GraduationCap className="w-8 h-8 text-emerald-500 mr-3" />
          <h1 className="text-xl font-bold text-white tracking-wider uppercase">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto scrollbar-hide">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedSubject(null); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${activeView === item.id ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 shadow-lg' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <item.icon className={`w-5 h-5 mr-3 ${activeView === item.id ? 'text-emerald-400' : ''}`} /><span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button onClick={() => { setActiveView('settings'); setSelectedSubject(null); }} className={`w-full flex items-center px-4 py-2.5 text-sm transition-all group mb-2 rounded-xl ${activeView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'}`}>
            <Settings className="w-4 h-4 mr-3 group-hover:rotate-45 transition-transform" />設定
          </button>
          <div onClick={handleSignOut} className="flex items-center px-3 py-3 rounded-2xl hover:bg-slate-800/60 cursor-pointer transition-all group border border-transparent hover:border-slate-700">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black mr-3 shadow-lg border border-emerald-400/20 uppercase shrink-0">{session.user.user_metadata?.kosen ? session.user.user_metadata.kosen[0] : 'U'}</div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-black text-slate-100 truncate">{session.user.user_metadata?.kosen ? `${session.user.user_metadata.kosen}高専` : 'User'}</p>
              <p className="text-[10px] text-slate-500 font-mono tracking-tight group-hover:text-red-400 truncate mt-0.5">{session.user.user_metadata?.grade || 'N/A'} / {session.user.user_metadata?.department || 'N/A'}</p>
            </div>
            <LogOut className="w-3.5 h-3.5 text-slate-600 group-hover:text-red-400 ml-2" />
          </div>
          <p className="text-[9px] text-slate-700 mt-4 text-center font-mono tracking-[0.2em] font-black uppercase">Version 1.2.0</p>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0f18] overflow-hidden relative z-20">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-[#0d1424]/80 backdrop-blur-md shrink-0">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="アイテムやタグを検索..." className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-emerald-500 transition-all text-sm font-medium" />
          </div>
          <div className="ml-4 flex items-center gap-3 shrink-0">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex items-center bg-[#161f33] hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 text-xs shadow-lg">
              {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-500" /> : <ImagePlus className="w-4 h-4 mr-2 text-emerald-500" />} 
              <span className="hidden sm:inline">画像解析</span>
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black transition-all shadow-lg active:scale-95 text-xs flex items-center"><Plus className="w-4 h-4 mr-1.5" />新規</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {activeView === 'dashboard' && (
            <div className="max-w-7xl mx-auto animate-in fade-in">
              <h2 className="text-xl font-black text-white flex items-center mb-8 tracking-tight"><LayoutDashboard className="w-6 h-6 mr-3 text-emerald-500" /> 直近の学習記録</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredItems.slice(0, 9).map(renderCard)}</div>
            </div>
          )}

          {activeView === 'notes' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom">
              {!selectedSubject ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20"><BookOpen className="w-12 h-12 text-emerald-500" /></div>
                  <h2 className="text-3xl font-black text-white mb-3">マイノート</h2>
                  <p className="text-slate-500 mb-12 font-medium">科目ごとのディレクトリで整理されています</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto text-left">
                    {Array.from(new Set(filteredItems.filter(n => getItemType(n.tags) === 'note').map(n => n.subject))).map(sub => (
                      <div key={sub} onClick={() => setSelectedSubject(sub)} className="p-6 bg-[#0d1424] border border-slate-800 rounded-2xl hover:border-emerald-500/40 transition-all flex items-center justify-between cursor-pointer group shadow-lg">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mr-4 group-hover:bg-emerald-600 transition-all"><FileText className="w-6 h-6 text-white" /></div>
                          <div><p className="font-bold text-slate-100 text-lg">{sub || '未分類'}</p><p className="text-[10px] text-slate-600 font-black uppercase">{filteredItems.filter(n => n.subject === sub).length} NOTES</p></div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-emerald-500" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in">
                  <button onClick={() => setSelectedSubject(null)} className="flex items-center text-slate-500 hover:text-emerald-400 font-black text-xs mb-8 transition-colors group uppercase tracking-widest"><ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Subject List</button>
                  <h2 className="text-2xl font-black text-white mb-8 border-l-4 border-emerald-500 pl-6">{selectedSubject} のノート一覧</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredItems.filter(n => n.subject === selectedSubject).map(renderCard)}</div>
                </div>
              )}
            </div>
          )}

          {activeView === 'exams' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-2xl font-black text-white flex items-center tracking-tight"><FileText className="w-6 h-6 mr-3 text-red-500" /> 過去問アーカイブ</h2>
                <div className="flex bg-[#161f33] border border-slate-700 rounded-2xl p-1.5 shadow-2xl">
                  <div className="flex items-center px-3 border-r border-slate-700"><Filter className="w-4 h-4 text-slate-500" /></div>
                  <select value={examFilter.grade} onChange={e => setExamFilter({...examFilter, grade: e.target.value})} className="bg-transparent text-slate-300 text-[10px] font-black uppercase px-3 py-1 outline-none cursor-pointer">
                    <option value="">全学年</option><option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option>
                  </select>
                  <select value={examFilter.term} onChange={e => setExamFilter({...examFilter, term: e.target.value})} className="bg-transparent text-slate-300 text-[10px] font-black uppercase px-3 py-1 outline-none cursor-pointer border-l border-slate-700">
                    <option value="">学期</option><option value="前期">前期</option><option value="後期">後期</option>
                  </select>
                  <select value={examFilter.type} onChange={e => setExamFilter({...examFilter, type: e.target.value})} className="bg-transparent text-slate-300 text-[10px] font-black uppercase px-3 py-1 outline-none cursor-pointer border-l border-slate-700">
                    <option value="">種別</option><option value="中間">中間</option><option value="期末">期末</option><option value="小テスト">小テスト</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.filter(n => {
                  if (getItemType(n.tags) !== 'exam') return false;
                  const m = getExamMeta(n.tags);
                  if (examFilter.grade && m.grade !== examFilter.grade) return false;
                  if (examFilter.term && m.term !== examFilter.term) return false;
                  if (examFilter.type && m.examType !== examFilter.type) return false;
                  return true;
                }).map(renderCard)}
              </div>
            </div>
          )}

          {activeView === 'materials' && (
            <div className="max-w-7xl mx-auto animate-in fade-in">
              <h2 className="text-2xl font-black text-white flex items-center mb-8"><Bookmark className="w-6 h-6 mr-3 text-blue-500" /> 学習資料・プリント</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredItems.filter(n => getItemType(n.tags) === 'material').map(renderCard)}</div>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-top">
              <h2 className="text-2xl font-black text-white flex items-center mb-8 tracking-tight"><CalendarIcon className="w-6 h-6 mr-3 text-emerald-500" /> 予定カレンダー <span className="ml-4 text-xs text-slate-600 font-mono font-bold tracking-widest">{calendarData.year}.{calendarData.month + 1}</span></h2>
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day} className="bg-[#11192a] py-4 text-center text-[10px] font-black text-slate-600 tracking-widest">{day}</div>)}
                {calendarData.days.map((d, i) => (
                  <div key={i} onClick={() => d && (setSelectedDate(d.dateStr), setIsEventModalOpen(true))} className={`bg-[#0d1424] min-h-[140px] p-3 transition-all relative ${d ? 'hover:bg-slate-800/40 cursor-pointer group' : 'opacity-30 cursor-default'}`}>
                    {d && (
                      <>
                        <span className={`text-[11px] font-mono font-black ${d.dateStr === new Date().toISOString().split('T')[0] ? 'text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg' : 'text-slate-700'}`}>{d.dayNum}</span>
                        <div className="mt-3 space-y-1">
                          {events[d.dateStr]?.map(ev => (
                            <div key={ev.id} className="px-2 py-1.5 bg-emerald-500/10 border-l-2 border-emerald-500 rounded text-[9px] text-emerald-100 font-black flex justify-between items-center group/ev">
                              <span className="truncate">{ev.title}</span>
                              <X onClick={e => { e.stopPropagation(); setEvents(p => ({ ...p, [d.dateStr]: p[d.dateStr].filter(x => x.id !== ev.id) })); }} className="w-3 h-3 opacity-0 group-hover/ev:opacity-100 text-red-400" />
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
            <div className="max-w-2xl mx-auto py-8 animate-in fade-in">
              <h2 className="text-2xl font-black text-white mb-8 flex items-center"><Settings className="w-6 h-6 mr-3 text-emerald-500" /> アカウント設定</h2>
              <div className="bg-[#0d1424] border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">EMAIL ADDRESS</label><input type="text" disabled value={session.user.email} className="w-full bg-[#161f33]/50 border border-slate-800 text-slate-700 rounded-xl px-4 py-3.5 text-sm cursor-not-allowed font-mono" /></div>
                  <div><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">COLLEGE NAME</label><input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-sm focus:border-emerald-500 font-bold" placeholder="例: 東京" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">DEPARTMENT</label><input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-sm focus:border-emerald-500 font-bold" placeholder="例: 情報工学科" /></div>
                    <div><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">GRADE</label>
                      <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none font-bold">
                        <option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option><option value="専攻科">専攻科</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-slate-800 flex justify-end">
                    <button type="submit" disabled={isProfileUpdating} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center min-w-[160px] disabled:opacity-50">
                      {isProfileUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SAVE CHANGES'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右サイドバー (チャット) */}
      <aside className="w-80 bg-[#0d1424] border-l border-slate-800 flex flex-col hidden lg:flex shrink-0 shadow-2xl relative z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-[#0d1424] shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center mr-4 border border-emerald-500/20 shadow-inner"><BrainCircuit className="w-6 h-6 text-emerald-400" /></div>
          <div><h2 className="font-black text-slate-100 text-[11px] tracking-widest uppercase">KOSEN AI</h2><div className="flex items-center mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span><span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Connected</span></div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans scrollbar-hide">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in duration-300`}>
              <div className={`max-w-[90%] rounded-2xl p-4 leading-relaxed shadow-xl text-sm whitespace-pre-wrap font-medium ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none shadow-emerald-900/10' : 'bg-[#161f33] text-slate-200 border border-slate-700/50 rounded-tl-none shadow-black/20'}`}>{msg.text}</div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start animate-in fade-in duration-300"><div className="bg-[#161f33] text-slate-400 border border-slate-700/50 rounded-2xl rounded-tl-none p-4 flex items-center space-x-2"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /><span className="text-xs font-black uppercase tracking-widest">Generating...</span></div></div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-6 border-t border-slate-800 bg-[#0d1424] shrink-0">
          <form onSubmit={handleSendMessage} className="relative group">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="AIに質問する..." disabled={isChatLoading} className="w-full bg-[#161f33] border border-slate-700 text-xs rounded-2xl pl-5 pr-12 py-4 focus:outline-none focus:border-emerald-500 transition-all shadow-inner disabled:opacity-50" />
            <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-2.5 top-2.5 p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 shadow-lg active:scale-90 transition-all"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      </aside>
    </div>
  );
}