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

// 環境変数の読み込み (import.metaエラーを回避するための安全なアクセス)
const getEnv = (key) => {
  try {
    // @ts-ignore
    return import.meta.env[key] || '';
  } catch (e) {
    return '';
  }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');
const GEMINI_API_KEY = getEnv('VITE_GEMINI_API_KEY');

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
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIアシスタントです。学習の質問や過去問の分析、将来のキャリア相談など何でも聞いてください。' }
];

// ヘルパー：アイテムの種類を判定
const getItemType = (tags) => {
  if (!tags) return 'note';
  if (tags.includes('type:exam')) return 'exam';
  if (tags.includes('type:material')) return 'material';
  return 'note';
};

// ヘルパー：過去問のメタデータを抽出
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
  // --- 認証系ステート ---
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitLoading, setIsAuthSubmitLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);

  // --- コンテンツ系ステート ---
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
  
  // --- 詳細・追加モーダル系 ---
  const [selectedNote, setSelectedNote] = useState(null);
  const [relevanceAnalysis, setRelevanceAnalysis] = useState({ loading: false, text: null, error: null });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState('note');
  const [newNote, setNewNote] = useState({ title: '', subject: '', preview: '', tags: '' });
  const [examMeta, setExamMeta] = useState({ grade: '1年', term: '前期', type: '中間' });
  const [isAdding, setIsAdding] = useState(false);

  // --- フィルタリング系 ---
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [examFilter, setExamFilter] = useState({ grade: '', term: '', type: '' });
  
  // --- プロフィール・カレンダー系 ---
  const [profileForm, setProfileForm] = useState({ kosen: '', department: '', grade: '' });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);
  const [events, setEvents] = useState({});
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // 認証の初期化
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
      // プロフィール未設定なら強制表示
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

  // 共通チェック
  const checkReady = () => {
    if (!isCreateClientImported) throw new Error("28行目のコメントアウトを外して再デプロイしてください。");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("環境変数が読み込めていません。VercelでRedeployをしてください。");
  };

  // プロフィール更新
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
      setAnalyzeMessage({ type: 'error', text: 'プロフィールの更新に失敗しました。' });
    } finally {
      setIsProfileUpdating(false);
    }
  };

  // 手動追加
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
      setIsAddModalOpen(false); 
      setNewNote({ title: '', subject: '', preview: '', tags: '' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: `${err.message}` }); } 
    finally { setIsAdding(false); setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 5000); }
  };

  // 画像アップロード解析
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
      if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY が未設定です。");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [
          { text: "学習ノートの画像を解析し、JSONで返してください。\n{\n  \"title\": \"\",\n  \"subject\": \"\",\n  \"preview\": \"内容の詳細な要約\",\n  \"tags\": []\n}" },
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

  // AIによる専門分析
  const handleAnalyzeAI = async (item) => {
    setRelevanceAnalysis({ loading: true, text: null, error: null });
    try {
      if (!GEMINI_API_KEY) throw new Error("AIキーが設定されていません。");
      const type = getItemType(item.tags);
      const prompt = type === 'exam' 
        ? `あなたは高専のベテラン教員です。この過去問の内容を分析し、「出題分野」を【分野】として1行で答え、その後に「この問題を解くためのポイント」を3点、高専生がテストで高得点を取れるように簡潔に教えてください。\nタイトル: ${item.title}\n内容: ${item.preview}`
        : `この学習内容が、高専の各学科（機械・電気・情報・建築・物質）の専門分野で将来どう活用されるか、学科ごとに1行ずつ具体的かつモチベーションが上がるように教えてください。\nタイトル: ${item.title}\n内容: ${item.preview}`;
      
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
      });
      const result = await response.json();
      setRelevanceAnalysis({ loading: false, text: result.candidates[0].content.parts[0].text, error: null });
    } catch (err) { setRelevanceAnalysis({ loading: false, text: null, error: err.message }); }
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
        setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'APIキー未設定のデモモードです。Vercelでキーを設定してください。' }]);
        return;
      }
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `あなたは高専生をサポートする優秀なAIアシスタントです。高専の理数系科目や工学の専門知識に詳しいです。質問: ${userText}` }] }] })
      });
      const result = await response.json();
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: result.candidates[0].content.parts[0].text }]);
    } catch (err) { setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: "エラーが発生しました。" }]); } 
    finally { setIsChatLoading(false); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("このアイテムを完全に削除しますか？")) return;
    try {
      checkReady();
      await supabase.from('notes').delete().eq('id', id);
      setNotes(prev => prev.filter(n => n.id !== id));
      setSelectedNote(null);
      setAnalyzeMessage({ type: 'success', text: '削除しました。' });
    } catch (e) { setAnalyzeMessage({ type: 'error', text: e.message }); }
    finally { setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 3000); }
  };

  // カレンダー生成
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

  // 認証処理
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return setAuthError('入力してください。');
    setIsAuthSubmitLoading(true); setAuthError('');
    try {
      if (isSupabaseReady) {
        const { error } = isLoginMode 
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!isLoginMode) alert('確認メールを送信しました。リンクをクリックしてください。');
      } else {
        await new Promise(r => setTimeout(r, 1000));
        setSession({ user: { id: 'dev-user', email, user_metadata: {} } });
        setIsProfileModalOpen(true);
      }
    } catch (err) { setAuthError(err.message); } 
    finally { setIsAuthSubmitLoading(false); }
  };

  const handleSignOut = async () => {
    if (isSupabaseReady) await supabase.auth.signOut();
    else setSession(null);
  };

  // 描画ヘルパー：カード
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
            {type === 'exam' && <span className="text-[10px] font-black px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-tighter shadow-sm">{meta.grade} {meta.term}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); deleteItem(note.id); }} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">{note.title}</h3>
        <p className="text-sm text-slate-400 line-clamp-3 mb-4 leading-relaxed font-medium">{note.preview}</p>
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
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse"></div>
        <div className="w-full max-w-md bg-[#0d1424]/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 mx-4">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <GraduationCap className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-center text-white mb-2 uppercase tracking-widest">KOSEN-base</h1>
          <p className="text-center text-slate-500 text-xs font-bold mb-8 tracking-tighter">TECHNICAL COLLEGE EDUCATION SUPPORT SYSTEM</p>
          <form className="space-y-5" onSubmit={handleAuth}>
            <div className="flex bg-[#161f33] p-1.5 rounded-2xl mb-6 shadow-inner">
              <button type="button" onClick={() => setIsLoginMode(true)} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-xl transition-all ${isLoginMode ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>LOGIN</button>
              <button type="button" onClick={() => setIsLoginMode(false)} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-xl transition-all ${!isLoginMode ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>SIGN UP</button>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium" placeholder="メールアドレス" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium" placeholder="パスワード" />
            {authError && <div className="text-red-400 text-xs flex items-start bg-red-400/10 p-4 rounded-xl border border-red-500/20"><AlertCircle className="w-4 h-4 mr-3 shrink-0 mt-0.5" />{authError}</div>}
            <button type="submit" disabled={isAuthSubmitLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/20 active:scale-95 flex items-center justify-center disabled:opacity-50">
              {isAuthSubmitLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLoginMode ? 'ログインして再開' : '新しくアカウントを作成')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 font-sans overflow-hidden relative">
      
      {/* 1. 全画面詳細モーダル (復元) */}
      {selectedNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 sm:p-10 animate-in fade-in duration-300" onClick={() => setSelectedNote(null)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-[40px] p-6 sm:p-12 w-full h-full max-w-6xl shadow-2xl relative flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-8 shrink-0 border-b border-slate-800 pb-8">
              <div className="flex-1 pr-12">
                <div className="flex gap-3 mb-5">
                  <span className="text-xs font-black px-3.5 py-1.5 rounded-full bg-[#1e293b] text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">{selectedNote.subject}</span>
                  {getItemType(selectedNote.tags) === 'exam' && <span className="text-xs font-black px-3.5 py-1.5 rounded-full bg-red-950/30 text-red-400 border border-red-500/20">{getExamMeta(selectedNote.tags).grade} {getExamMeta(selectedNote.tags).term} {getExamMeta(selectedNote.tags).examType}</span>}
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">{selectedNote.title}</h2>
              </div>
              <button onClick={() => { setSelectedNote(null); setRelevanceAnalysis({ loading: false, text: null, error: null }); }} className="p-4 bg-slate-800/50 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all shadow-lg active:scale-90"><X className="w-8 h-8" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide space-y-12">
              <section>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center"><FileText className="w-4 h-4 mr-3" /> CONTENTS PREVIEW</h4>
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap text-lg sm:text-xl font-medium">{selectedNote.preview}</p>
              </section>

              <section className="bg-[#161f33] border border-emerald-500/10 rounded-[32px] p-8 sm:p-10 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center">
                    <BrainCircuit className="w-5 h-5 mr-3" /> AI ANALYSIS: {getItemType(selectedNote.tags) === 'exam' ? 'EXAM STRATEGY' : 'CAREER RELEVANCE'}
                  </h4>
                  {!relevanceAnalysis.text && !relevanceAnalysis.loading && (
                    <button onClick={() => handleAnalyzeAI(selectedNote)} className="text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl flex items-center shadow-xl transition-all active:scale-95 group">
                      <Compass className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" /> AIで分析を実行
                    </button>
                  )}
                </div>
                {relevanceAnalysis.loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mb-6" />
                    <span className="font-bold tracking-widest animate-pulse uppercase">AI IS ANALYZING DATA...</span>
                  </div>
                )}
                {relevanceAnalysis.text && (
                  <div className="text-slate-300 text-base sm:text-lg leading-loose whitespace-pre-wrap animate-in slide-in-from-bottom duration-700 p-8 bg-[#0a0f18]/50 rounded-3xl border border-slate-800 shadow-inner font-medium">
                    {relevanceAnalysis.text}
                  </div>
                )}
                {relevanceAnalysis.error && <div className="text-red-400 text-sm p-4 bg-red-400/5 rounded-xl border border-red-500/20">{relevanceAnalysis.error}</div>}
              </section>
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0">
              <div className="flex items-center text-sm text-slate-500 font-mono font-black tracking-widest"><Clock className="w-5 h-5 mr-3 text-emerald-500/60" />{selectedNote.date}</div>
              <div className="flex flex-wrap gap-3">
                {selectedNote.tags?.filter(t => !t.includes(':')).map((t, i) => (
                  <span key={i} className="text-[10px] font-black px-4 py-1.5 rounded-full bg-[#1e293b] text-slate-400 border border-slate-700/50 hover:border-emerald-500/30 transition-colors">#{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. プロフィール設定モーダル (初回強制) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-2xl p-4 animate-in fade-in duration-500">
          <div className="bg-[#0d1424] border border-slate-700 rounded-[40px] p-10 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-8 mx-auto border border-emerald-500/20 shadow-inner">
              <User className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-2 tracking-tight">プロフィール設定</h2>
            <p className="text-slate-500 text-center text-xs font-bold mb-8 uppercase tracking-widest">Setup your college identity</p>
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">College Name</label>
                <input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 transition-all font-bold" placeholder="例: 東京" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Department</label>
                <input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 transition-all font-bold" placeholder="例: 情報工学科" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Grade</label>
                <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm outline-none font-bold appearance-none">
                  <option value="" disabled>学年を選択</option>
                  {['1年', '2年', '3年', '4年', '5年', '専攻科'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isProfileUpdating} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-[20px] font-black transition-all shadow-xl active:scale-95 mt-6 flex items-center justify-center">
                {isProfileUpdating ? <Loader2 className="w-6 h-6 animate-spin" /> : 'KOSEN-base を開始する'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. 新規追加モーダル (多機能版) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-white mb-8 flex items-center uppercase tracking-widest"><Plus className="w-6 h-6 mr-3 text-emerald-500" /> Create New Item</h2>
            
            <div className="flex bg-[#161f33] p-1.5 rounded-2xl mb-8 shadow-inner border border-slate-800">
              {['note', 'exam', 'material'].map(t => (
                <button key={t} onClick={() => setNewItemType(t)} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${newItemType === t ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                  {t === 'note' ? 'ノート' : t === 'exam' ? '過去問' : '資料'}
                </button>
              ))}
            </div>

            <form onSubmit={handleManualAdd} className="space-y-5">
              <input required type="text" value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 font-bold" placeholder="タイトル (例: 線形代数 第1回)" />
              
              {newItemType === 'exam' && (
                <div className="grid grid-cols-3 gap-3">
                  <select value={examMeta.grade} onChange={e => setExamMeta({...examMeta, grade: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-xs font-bold">
                    <option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option>
                  </select>
                  <select value={examMeta.term} onChange={e => setExamMeta({...examMeta, term: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-xs font-bold">
                    <option value="前期">前期</option><option value="後期">後期</option>
                  </select>
                  <select value={examMeta.type} onChange={e => setExamMeta({...examMeta, type: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-3.5 text-xs font-bold">
                    <option value="中間">中間</option><option value="期末">期末</option><option value="小テスト">小テスト</option>
                  </select>
                </div>
              )}

              <input required type="text" value={newNote.subject} onChange={e => setNewNote({...newNote, subject: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 font-bold" placeholder="科目 (例: 数学)" />
              <textarea value={newNote.preview} onChange={e => setNewNote({...newNote, preview: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm h-32 resize-none focus:border-emerald-500 font-medium leading-relaxed" placeholder="要約や内容、問題の抜粋..." />
              <input type="text" value={newNote.tags} onChange={e => setNewNote({...newNote, tags: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 font-bold" placeholder="タグ (カンマ区切り)" />
              
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-[#161f33] text-slate-400 py-4 rounded-2xl font-black border border-slate-700 hover:bg-slate-800 transition-colors uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" disabled={isAdding} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 flex items-center justify-center uppercase tracking-widest text-xs">
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. カレンダー予定追加モーダル */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsEventModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-white mb-6 flex items-center uppercase tracking-tight"><CalendarIcon className="w-5 h-5 mr-3 text-emerald-500" /> Add Event</h2>
            <p className="text-[10px] text-slate-500 mb-6 font-mono font-black tracking-widest uppercase">{selectedDate}</p>
            <form onSubmit={handleAddEvent} className="space-y-5">
              <input type="text" autoFocus required value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-5 py-4 text-sm focus:border-emerald-500 shadow-inner font-bold" placeholder="予定 (例: 実験レポ提出)" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEventModalOpen(false)} className="flex-1 bg-[#161f33] text-slate-500 py-3.5 rounded-xl font-black border border-slate-700 text-[10px] uppercase tracking-widest">Back</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* サイドバー */}
      <aside className="w-64 bg-[#0d1424] border-r border-slate-800 flex flex-col hidden md:flex z-20 shrink-0">
        <div className="h-20 flex items-center px-8 border-b border-slate-800 shrink-0">
          <GraduationCap className="w-9 h-9 text-emerald-500 mr-4" />
          <h1 className="text-xl font-black text-white tracking-widest uppercase">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-10 px-6 space-y-2 overflow-y-auto scrollbar-hide">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedSubject(null); }} className={`w-full flex items-center px-5 py-4 rounded-2xl transition-all duration-300 ${activeView === item.id ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <item.icon className={`w-5 h-5 mr-4 ${activeView === item.id ? 'text-emerald-400' : ''}`} /><span className="font-black text-[11px] uppercase tracking-[0.1em]">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-800 shrink-0">
          <button onClick={() => { setActiveView('settings'); setSelectedSubject(null); }} className={`w-full flex items-center px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all group mb-4 rounded-xl ${activeView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'}`}>
            <Settings className="w-4 h-4 mr-4 group-hover:rotate-90 transition-transform duration-500" />SETTING
          </button>
          <div onClick={handleSignOut} className="flex items-center px-4 py-4 rounded-[24px] bg-[#161f33]/30 border border-slate-800 hover:bg-slate-800/50 hover:border-slate-700 cursor-pointer transition-all group overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black mr-4 shadow-lg border border-emerald-400/20 uppercase shrink-0 text-xs">{session.user.user_metadata?.kosen ? session.user.user_metadata.kosen[0] : 'U'}</div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-black text-slate-100 truncate tracking-tight">{session.user.user_metadata?.kosen ? `${session.user.user_metadata.kosen}高専` : 'USER'}</p>
              <p className="text-[9px] text-slate-600 font-mono font-black group-hover:text-red-400 truncate mt-0.5 tracking-tighter">{session.user.user_metadata?.grade || 'N/A'} / {session.user.user_metadata?.department || 'N/A'}</p>
            </div>
            <LogOut className="w-4 h-4 text-slate-700 group-hover:text-red-400 transition-colors ml-2" />
          </div>
          <p className="text-[9px] text-slate-800 mt-6 text-center font-mono font-black tracking-[0.3em] uppercase">VER 1.2.0 FULL</p>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0f18] overflow-hidden relative z-20">
        <header className="h-20 flex items-center justify-between px-10 border-b border-slate-800 bg-[#0d1424]/80 backdrop-blur-xl shrink-0">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="アイテムやタグを即座に検索..." className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[18px] pl-12 pr-6 py-3.5 focus:outline-none focus:border-emerald-500 transition-all text-sm font-bold shadow-inner" />
          </div>
          <div className="ml-8 flex items-center gap-4 shrink-0">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex items-center bg-[#161f33] hover:bg-slate-700 text-slate-300 border border-slate-700 px-6 py-3.5 rounded-[18px] font-black transition-all disabled:opacity-50 text-[10px] uppercase tracking-widest shadow-lg active:scale-95 group">
              {isAnalyzing ? <Loader2 className="w-4 h-4 mr-3 animate-spin text-emerald-500" /> : <ImagePlus className="w-4 h-4 mr-3 text-emerald-500 group-hover:scale-110 transition-transform" />} 
              Analyze Image
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-[18px] font-black transition-all shadow-2xl shadow-emerald-900/40 active:scale-95 text-[10px] uppercase tracking-widest flex items-center"><Plus className="w-4 h-4 mr-2" /> New Entry</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
          {analyzeMessage.text && (
            <div className="mb-8 animate-in slide-in-from-top duration-300">
              <div className={`border px-6 py-5 rounded-3xl flex items-center shadow-2xl backdrop-blur-md ${analyzeMessage.type === 'error' ? 'bg-red-950/80 border-red-800 text-red-200' : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'}`}>
                {analyzeMessage.type === 'error' ? <AlertCircle className="w-6 h-6 mr-4 shrink-0 text-red-400" /> : <CheckCircle2 className="w-6 h-6 mr-4 shrink-0 text-emerald-400" />}
                <p className="flex-1 text-sm font-black tracking-tight">{analyzeMessage.text}</p>
                <button onClick={() => setAnalyzeMessage({type: null, text: null})} className="ml-6 text-[10px] font-black uppercase tracking-widest hover:underline opacity-50">Dismiss</button>
              </div>
            </div>
          )}
          
          {/* --- DASHBOARD VIEW --- */}
          {activeView === 'dashboard' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white flex items-center mb-10 tracking-tight"><LayoutDashboard className="w-7 h-7 mr-4 text-emerald-500" /> RECENT ACTIVITY</h2>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-96"><Loader2 className="w-12 h-12 animate-spin text-emerald-500" /></div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-800 rounded-[40px] text-slate-700">
                  <Search className="w-16 h-16 mb-6 opacity-5" />
                  <p className="font-black uppercase tracking-[0.4em] text-xs">No Recent Records</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-700">{filteredItems.slice(0, 12).map(renderCard)}</div>
              )}
            </div>
          )}

          {/* --- NOTES VIEW (SUBJECT GROUPED) --- */}
          {activeView === 'notes' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom duration-500">
              {!selectedSubject ? (
                <div className="text-center py-12">
                  <div className="w-28 h-28 bg-emerald-500/10 rounded-[36px] flex items-center justify-center mx-auto mb-10 border border-emerald-500/20 shadow-inner">
                    <BookOpen className="w-14 h-14 text-emerald-500" />
                  </div>
                  <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">MY NOTES</h2>
                  <p className="text-slate-500 mb-16 font-bold tracking-tight">科目ごとに自動的にフォルダ分けされています</p>
                  
                  {filteredItems.filter(n => getItemType(n.tags) === 'note').length === 0 ? (
                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-[40px] text-slate-800 font-black">NO NOTES FOUND</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
                      {Array.from(new Set(filteredItems.filter(n => getItemType(n.tags) === 'note').map(n => n.subject))).map(sub => (
                        <div key={sub} onClick={() => setSelectedSubject(sub)} className="p-8 bg-[#0d1424] border border-slate-800 rounded-[32px] hover:border-emerald-500/40 hover:bg-[#162136] transition-all duration-300 flex items-center justify-between cursor-pointer group shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full group-hover:bg-emerald-500/10 transition-colors"></div>
                          <div className="flex items-center relative z-10">
                            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-emerald-600 transition-all duration-500 shadow-lg"><FileText className="w-7 h-7 text-white" /></div>
                            <div>
                              <p className="font-black text-slate-100 text-xl tracking-tight">{sub || '未分類'}</p>
                              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-1.5">{filteredItems.filter(n => n.subject === sub && getItemType(n.tags)==='note').length} ITEMS</p>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-emerald-500 transform group-hover:translate-x-2 transition-all" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in duration-500">
                  <button onClick={() => setSelectedSubject(null)} className="flex items-center text-slate-600 hover:text-emerald-400 font-black text-xs mb-10 transition-all group tracking-widest uppercase"><ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-2 transition-transform" /> BACK TO DIRECTORY</button>
                  <h2 className="text-3xl font-black text-white mb-10 border-l-8 border-emerald-500 pl-8 leading-none">{selectedSubject} の講義ノート</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{filteredItems.filter(n => n.subject === selectedSubject && getItemType(n.tags)==='note').map(renderCard)}</div>
                </div>
              )}
            </div>
          )}

          {/* --- EXAMS VIEW (WITH ADVANCED FILTERS) --- */}
          {activeView === 'exams' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom duration-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-6">
                <h2 className="text-3xl font-black text-white flex items-center tracking-tight"><FileText className="w-8 h-8 mr-4 text-red-500" /> EXAM ARCHIVE</h2>
                <div className="flex bg-[#161f33] border border-slate-700 rounded-3xl p-2 shadow-2xl overflow-hidden min-w-[360px]">
                  <div className="flex items-center px-4 border-r border-slate-700 text-slate-500"><Filter className="w-4 h-4" /></div>
                  <select value={examFilter.grade} onChange={e => setExamFilter({...examFilter, grade: e.target.value})} className="bg-transparent text-slate-300 text-[10px] font-black uppercase px-4 py-2 outline-none cursor-pointer hover:text-white flex-1 transition-colors">
                    <option value="">Grade</option><option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option>
                  </select>
                  <select value={examFilter.term} onChange={e => setExamFilter({...examFilter, term: e.target.value})} className="bg-transparent text-slate-300 text-[10px] font-black uppercase px-4 py-2 outline-none cursor-pointer border-l border-slate-700 hover:text-white flex-1 transition-colors">
                    <option value="">Term</option><option value="前期">前期</option><option value="後期">後期</option>
                  </select>
                  <select value={examFilter.type} onChange={e => setExamFilter({...examFilter, type: e.target.value})} className="bg-transparent text-slate-300 text-[10px] font-black uppercase px-4 py-2 outline-none cursor-pointer border-l border-slate-700 hover:text-white flex-1 transition-colors">
                    <option value="">Type</option><option value="中間">中間</option><option value="期末">期末</option><option value="小テスト">小テスト</option>
                  </select>
                </div>
              </div>
              {(() => {
                const exams = filteredItems.filter(n => {
                  if (getItemType(n.tags) !== 'exam') return false;
                  const m = getExamMeta(n.tags);
                  if (examFilter.grade && m.grade !== examFilter.grade) return false;
                  if (examFilter.term && m.term !== examFilter.term) return false;
                  if (examFilter.type && m.examType !== examFilter.type) return false;
                  return true;
                });
                return exams.length === 0 ? (
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-[40px] text-slate-800 font-black">NO EXAMS MATCH FILTERS</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{exams.map(renderCard)}</div>
                );
              })()}
            </div>
          )}

          {/* --- MATERIALS VIEW --- */}
          {activeView === 'materials' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-3xl font-black text-white flex items-center mb-12 tracking-tight"><Bookmark className="w-8 h-8 mr-4 text-blue-500" /> STUDY MATERIALS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{filteredItems.filter(n => getItemType(n.tags) === 'material').map(renderCard)}</div>
            </div>
          )}

          {/* --- CALENDAR VIEW --- */}
          {activeView === 'calendar' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-top duration-700">
              <h2 className="text-3xl font-black text-white flex items-center mb-10 tracking-tight"><CalendarIcon className="w-8 h-8 mr-4 text-emerald-500" /> SCHEDULER <span className="ml-6 text-sm text-slate-700 font-mono font-black tracking-[0.2em]">{calendarData.year} / {String(calendarData.month + 1).padStart(2,'0')}</span></h2>
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-[40px] overflow-hidden border border-slate-800 shadow-2xl">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day} className="bg-[#11192a] py-6 text-center text-[10px] font-black text-slate-600 tracking-[0.3em] uppercase">{day}</div>)}
                {calendarData.days.map((d, i) => (
                  <div key={i} onClick={() => d && (setSelectedDate(d.dateStr), setIsEventModalOpen(true))} className={`bg-[#0d1424] min-h-[160px] p-5 transition-all duration-300 relative group/cell ${d ? 'hover:bg-slate-800/50 cursor-pointer' : 'opacity-20 cursor-default'}`}>
                    {d && (
                      <>
                        <span className={`text-xs font-mono font-black transition-all ${d.dateStr === new Date().toISOString().split('T')[0] ? 'text-emerald-400 bg-emerald-500/15 px-3 py-1.5 rounded-2xl shadow-lg ring-1 ring-emerald-500/50' : 'text-slate-700 group-hover/cell:text-slate-400'}`}>{d.dayNum}</span>
                        <div className="mt-5 space-y-2">
                          {events[d.dateStr]?.map(ev => (
                            <div key={ev.id} className="px-3 py-2 bg-emerald-500/10 border-l-[3px] border-emerald-500 rounded-lg text-[10px] text-emerald-100 font-black flex justify-between items-center group/ev transition-all hover:bg-emerald-500/20">
                              <span className="truncate pr-2">{ev.title}</span>
                              <X onClick={e => { e.stopPropagation(); setEvents(p => ({ ...p, [d.dateStr]: p[d.dateStr].filter(x => x.id !== ev.id) })); }} className="w-3.5 h-3.5 opacity-0 group-hover/ev:opacity-100 text-red-500 hover:scale-125 transition-all" />
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

          {/* --- SETTINGS VIEW --- */}
          {activeView === 'settings' && (
            <div className="max-w-2xl mx-auto py-10 animate-in fade-in duration-500">
              <h2 className="text-3xl font-black text-white mb-12 flex items-center tracking-tight"><Settings className="w-8 h-8 mr-4 text-emerald-500" /> SYSTEM SETTINGS</h2>
              <div className="bg-[#0d1424] border border-slate-800 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                <form onSubmit={handleUpdateProfile} className="space-y-8">
                  <div className="space-y-2"><label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Account Email</label><input type="text" disabled value={session.user.email} className="w-full bg-[#161f33]/50 border border-slate-800 text-slate-700 rounded-2xl px-6 py-4 text-sm cursor-not-allowed font-mono font-bold" /></div>
                  <div className="space-y-2"><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Technical College Name</label><input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 font-bold transition-all" placeholder="例: 東京" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Department</label><input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 font-bold transition-all" placeholder="例: 情報工学科" /></div>
                    <div className="space-y-2"><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Academic Grade</label>
                      <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-2xl px-6 py-4 text-sm outline-none font-bold appearance-none transition-all">
                        <option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option><option value="専攻科">専攻科</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-10 flex justify-end border-t border-slate-800">
                    <button type="submit" disabled={isProfileUpdating} className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-[24px] font-black transition-all shadow-2xl active:scale-95 flex items-center justify-center min-w-[200px] disabled:opacity-50 tracking-widest uppercase text-xs">
                      {isProfileUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右サイドバー：AIチャットアシスタント */}
      <aside className="w-80 bg-[#0d1424] border-l border-slate-800 flex flex-col hidden lg:flex shrink-0 shadow-2xl relative z-20">
        <div className="h-20 flex items-center px-8 border-b border-slate-800 bg-[#0d1424] shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mr-5 border border-emerald-500/20 shadow-inner group-hover:rotate-12 transition-transform"><BrainCircuit className="w-6 h-6 text-emerald-400" /></div>
          <div><h2 className="font-black text-slate-100 text-[11px] tracking-[0.2em] uppercase leading-none">KOSEN AI</h2><div className="flex items-center mt-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span><span className="text-[9px] text-emerald-500 font-black uppercase tracking-wider">Sync Active</span></div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 font-sans scrollbar-hide">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in-95 duration-500`}>
              <div className={`max-w-[90%] rounded-[24px] p-5 leading-relaxed shadow-xl text-sm whitespace-pre-wrap font-medium ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none shadow-emerald-900/20' : 'bg-[#161f33] text-slate-200 border border-slate-800 rounded-tl-none shadow-black/40 border-l-[3px] border-l-emerald-500/50'}`}>{msg.text}</div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-[#161f33] text-slate-400 border border-slate-800 rounded-[24px] rounded-tl-none p-5 flex flex-col items-start gap-3 shadow-xl">
                <div className="flex items-center space-x-3"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">AI Thinking...</span></div>
                <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden relative"><div className="absolute h-full bg-emerald-500/50 animate-[progress_1.5s_ease-in-out_infinite] w-1/2"></div></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-8 border-t border-slate-800 bg-[#0d1424] shrink-0">
          <form onSubmit={handleSendMessage} className="relative group">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="AIに質問する..." disabled={isChatLoading} className="w-full bg-[#161f33] border border-slate-800 border-b-[3px] border-b-slate-700 text-xs rounded-2xl pl-6 pr-14 py-4 focus:outline-none focus:border-emerald-500 focus:border-b-emerald-600 transition-all shadow-inner disabled:opacity-50 font-bold" />
            <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-3 top-2.5 p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 shadow-lg active:scale-90 transition-all disabled:opacity-30"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      </aside>

      <style>{`
        @keyframes progress { 0% { left: -50%; } 100% { left: 100%; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}