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
// 以下の1行の先頭の「// 」を必ず消して保存し、GitHubにプッシュしてください！
// =========================================================================
import { createClient } from '@supabase/supabase-js';

/**
 * 環境変数の安全な読み込み
 * Viteのビルド時警告を回避し、ランタイムでのクラッシュを防ぐための防衛的コード
 */
const getSafeEnv = (name) => {
  try {
    // Viteはビルド時に import.meta.env.VITE_XXX を静的に置換します
    if (name === 'VITE_SUPABASE_URL') return import.meta.env.VITE_SUPABASE_URL || '';
    if (name === 'VITE_SUPABASE_ANON_KEY') return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (name === 'VITE_GEMINI_API_KEY') return import.meta.env.VITE_GEMINI_API_KEY || '';
    return '';
  } catch (e) {
    return '';
  }
};

const SUPABASE_URL = getSafeEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getSafeEnv('VITE_SUPABASE_ANON_KEY');
const GEMINI_API_KEY = getSafeEnv('VITE_GEMINI_API_KEY');

// ライブラリが正しく読み込まれているか、環境変数があるかをチェック
const isCreateClientImported = typeof createClient !== 'undefined';
const hasEnvVars = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
const isSupabaseReady = isCreateClientImported && hasEnvVars;

let supabase;

if (isSupabaseReady) {
  // @ts-ignore
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  // 未準備時の詳細なエラー特定用メッセージ
  const getInitErrorMessage = () => {
    if (!isCreateClientImported) return "28行目のインポートがコメントアウトされたままです。";
    if (!hasEnvVars) return "Vercelの環境変数が設定されていないか、Redeployが必要です。";
    return "Supabaseの初期化に失敗しました。";
  };

  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ error: { message: getInitErrorMessage() } }),
      signUp: () => Promise.resolve({ error: { message: getInitErrorMessage() } }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null, data: { user: {} } })
    },
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  };
}

const INITIAL_CHAT = [
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIアシスタントです。学習の相談や過去問の分析、将来のキャリアについて何でも聞いてください。' }
];

// ヘルパー：アイテムの種類をタグから判定
const getItemType = (tags) => {
  if (!tags || !Array.isArray(tags)) return 'note';
  if (tags.includes('type:exam')) return 'exam';
  if (tags.includes('type:material')) return 'material';
  return 'note';
};

// ヘルパー：過去問のメタデータをタグから抽出
const getExamMeta = (tags) => {
  const meta = { grade: '未設定', term: '未設定', examType: '未設定' };
  tags?.forEach(t => {
    if (typeof t !== 'string') return;
    if (t.startsWith('grade:')) meta.grade = t.replace('grade:', '');
    if (t.startsWith('term:')) meta.term = t.replace('term:', '');
    if (t.startsWith('exam:')) meta.examType = t.replace('exam:', '');
  });
  return meta;
};

export default function App() {
  // --- ステート：認証 ---
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitLoading, setIsAuthSubmitLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);

  // --- ステート：メインコンテンツ ---
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
  
  // --- ステート：詳細表示 & モーダル ---
  const [selectedNote, setSelectedNote] = useState(null);
  const [relevanceAnalysis, setRelevanceAnalysis] = useState({ loading: false, text: null, error: null });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState('note');
  const [newNote, setNewNote] = useState({ title: '', subject: '', preview: '', tags: '' });
  const [examMeta, setExamMeta] = useState({ grade: '1年', term: '前期', type: '中間' });
  const [isAdding, setIsAdding] = useState(false);

  // --- ステート：フィルター & プロフィール ---
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [examFilter, setExamFilter] = useState({ grade: '', term: '', type: '' });
  const [profileForm, setProfileForm] = useState({ kosen: '', department: '', grade: '' });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileUpdating, setIsProfileUpdating] = useState(false);

  // --- ステート：カレンダー ---
  const [events, setEvents] = useState({});
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // 1. 認証の初期化
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

  // 2. データ取得
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

  // チャット自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // 3. 準備状態のバリデーション
  const checkReady = () => {
    if (!isCreateClientImported) {
      throw new Error("28行目のコメントアウト (import { createClient }...) を外して保存し、再デプロイしてください。");
    }
    if (!hasEnvVars) {
      throw new Error(`環境変数が読み込めていません。Viteの仕様上、Vercelで設定した後に「Redeploy」を実行する必要があります。`);
    }
  };

  // 4. アクションハンドラー
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

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newNote.title || !newNote.subject || !session) return;
    setIsAdding(true); setAnalyzeMessage({ type: null, text: null });
    try {
      checkReady();
      const tags = newNote.tags.split(',').map(t => t.trim()).filter(Boolean);
      tags.push(`type:${newItemType}`);
      if (newItemType === 'exam') {
        tags.push(`grade:${examMeta.grade}`, `term:${examMeta.term}`, `exam:${examMeta.type}`);
      }
      const { error } = await supabase.from('notes').insert([{
        title: newNote.title, subject: newNote.subject, preview: newNote.preview, tags: tags,
        date: new Date().toISOString().split('T')[0], user_id: session.user.id
      }]);
      if (error) throw error;
      await fetchNotes();
      setAnalyzeMessage({ type: 'success', text: 'アイテムを追加しました。' });
      setIsAddModalOpen(false); setNewNote({ title: '', subject: '', preview: '', tags: '' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: err.message }); } 
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
      if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY が未設定です。");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [
          { text: "高専の学習ノート画像を解析し、JSON形式で返してください。タイトル、科目、詳細な要約を抽出してください。\n{\n  \"title\": \"\",\n  \"subject\": \"\",\n  \"preview\": \"\",\n  \"tags\": []\n}" },
          { inlineData: { mimeType: file.type, data: base64Data } }
        ]}]})
      });
      if (!response.ok) throw new Error("AI解析エラーが発生しました。");
      const result = await response.json();
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsedData = JSON.parse(aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim());
      const tags = parsedData.tags || [];
      tags.push('type:note');
      const { error } = await supabase.from('notes').insert([{ ...parsedData, tags, date: new Date().toISOString().split('T')[0], user_id: session.user.id }]);
      if (error) throw error;
      await fetchNotes();
      setAnalyzeMessage({ type: 'success', text: '画像をノートとして保存しました！' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: err.message }); } 
    finally { setIsAnalyzing(false); setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 7000); }
  };

  const handleAnalyzeAI = async (item) => {
    setRelevanceAnalysis({ loading: true, text: null, error: null });
    try {
      if (!GEMINI_API_KEY) throw new Error("APIキーが設定されていません。");
      const type = getItemType(item.tags);
      const prompt = type === 'exam' 
        ? `高専の教員として、この過去問のタイトル「${item.title}」と内容「${item.preview}」から出題分野を特定し、解法のポイントを3点簡潔に教えてください。`
        : `この学習内容「${item.title}」が、高専の各学科（機械・電気・情報・建築・物質）で将来どう使われるか、学科ごとに1行ずつ簡潔に教えてください。`;
      
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
        setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'APIキーが未設定のため、デモモードで動作しています。Vercelでキーを設定してください。' }]);
        return;
      }
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `あなたは高専生をサポートする優秀なAI学習アシスタントです。質問: ${userText}` }] }] })
      });
      const result = await response.json();
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: result.candidates[0].content.parts[0].text }]);
    } catch (err) { setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: "エラーが発生しました。" }]); } 
    finally { setIsChatLoading(false); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("完全に削除してもよろしいですか？")) return;
    try {
      checkReady();
      await supabase.from('notes').delete().eq('id', id);
      setNotes(prev => prev.filter(n => n.id !== id));
      setSelectedNote(null);
      setAnalyzeMessage({ type: 'success', text: 'アイテムを削除しました。' });
    } catch (e) { setAnalyzeMessage({ type: 'error', text: e.message }); }
    finally { setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 3000); }
  };

  // 5. カレンダー生成
  const getCalendar = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({ day: i, dateStr: `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}` });
    }
    return { days, year, month };
  };
  const calendar = getCalendar();

  // 6. 描画ヘルパー
  const renderCard = (note) => {
    const type = getItemType(note.tags);
    const meta = type === 'exam' ? getExamMeta(note.tags) : null;
    return (
      <div key={note.id} onClick={() => setSelectedNote(note)} className="bg-[#11192a] border border-slate-800 rounded-[32px] p-7 hover:border-emerald-500/50 hover:bg-[#162136] transition-all cursor-pointer group flex flex-col shadow-2xl min-h-[280px] relative text-left">
        <div className="flex justify-between items-start mb-5">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest shadow-sm ${type === 'exam' ? 'bg-red-950/30 text-red-400 border-red-500/20' : type === 'material' ? 'bg-blue-950/30 text-blue-400 border-blue-500/20' : 'bg-[#1e293b] text-emerald-400 border-emerald-500/20'}`}>
              {note.subject}
            </span>
            {type === 'exam' && <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-widest">{meta.grade} {meta.term}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); deleteItem(note.id); }} className="p-2 hover:bg-red-500/10 rounded-full text-slate-600 hover:text-red-400 transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>
        </div>
        <h3 className="text-xl font-black text-white mb-3 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug tracking-tight">{note.title}</h3>
        <p className="text-sm text-slate-400 line-clamp-3 mb-4 leading-relaxed font-medium opacity-80">{note.preview}</p>
        <div className="mt-auto pt-5 border-t border-slate-800/50 flex items-center text-[10px] text-slate-600 font-mono font-black tracking-widest uppercase">
          <Clock className="w-3 h-3 mr-2 text-emerald-500/60" />{note.date}
        </div>
      </div>
    );
  };

  const filteredItems = notes.filter(n => {
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q) || (n.preview && n.preview.toLowerCase().includes(q));
  });

  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'notes', label: 'マイノート', icon: BookOpen },
    { id: 'exams', label: '過去問', icon: FileText },
    { id: 'materials', label: '学習資料', icon: Bookmark },
    { id: 'calendar', label: 'カレンダー', icon: CalendarIcon },
  ];

  if (isAuthLoading) return <div className="flex h-screen w-full bg-[#0a0f18] items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-emerald-500" /></div>;

  if (!session) {
    return (
      <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-emerald-500/5 blur-[160px] rounded-full animate-pulse"></div>
        <div className="w-full max-w-md bg-[#0d1424]/90 backdrop-blur-3xl border border-slate-800 rounded-[48px] p-12 shadow-2xl relative z-10 mx-4">
          <div className="flex justify-center mb-10">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <GraduationCap className="w-12 h-12 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-center text-white mb-2 uppercase tracking-[0.15em] tracking-tighter">KOSEN-base</h1>
          <p className="text-center text-slate-600 text-[10px] font-black mb-12 tracking-[0.4em] uppercase opacity-60 leading-none">Engineering Hub for Students</p>
          <form className="space-y-6" onSubmit={(e) => {
            e.preventDefault();
            setIsAuthSubmitLoading(true); setAuthError('');
            const action = isLoginMode ? supabase.auth.signInWithPassword({ email, password }) : supabase.auth.signUp({ email, password });
            action.then(({error}) => {
              if (error) setAuthError(error.message);
              else if (!isLoginMode) alert("確認メールを送信しました。リンクをクリックしてください。");
              setIsAuthSubmitLoading(false);
            });
          }}>
            <div className="flex bg-[#161f33] p-1.5 rounded-2xl mb-8 shadow-inner border border-slate-800">
              <button type="button" onClick={() => setIsLoginMode(true)} className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all ${isLoginMode ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500'}`}>LOGIN</button>
              <button type="button" onClick={() => setIsLoginMode(false)} className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all ${!isLoginMode ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500'}`}>SIGN UP</button>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[20px] px-6 py-5 text-sm focus:border-emerald-500 transition-all font-bold placeholder:text-slate-700" placeholder="Email Address" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[20px] px-6 py-5 text-sm focus:border-emerald-500 transition-all font-bold placeholder:text-slate-700" placeholder="Password" />
            {authError && <div className="text-red-400 text-xs flex items-start bg-red-400/5 p-5 rounded-2xl border border-red-500/20 text-left"><AlertCircle className="w-5 h-5 mr-3 shrink-0" />{authError}</div>}
            <button type="submit" disabled={isAuthSubmitLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-[24px] font-black transition-all shadow-2xl shadow-emerald-900/40 active:scale-95 flex items-center justify-center disabled:opacity-50 text-sm tracking-widest uppercase text-left">
              {isAuthSubmitLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLoginMode ? 'Sign In Now' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 font-sans overflow-hidden relative text-left">
      
      {/* 画面全体をクリックした際にメニューを閉じる透明レイヤー */}
      {menuOpenId && <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)}></div>}

      {/* --- 1. 全画面詳細ダイアログ --- */}
      {selectedNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 sm:p-10 animate-in fade-in duration-500" onClick={() => setSelectedNote(null)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-[48px] p-6 sm:p-12 w-full h-full max-w-6xl shadow-2xl relative flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-10 shrink-0 border-b border-slate-800 pb-10 text-left">
              <div className="flex-1 pr-12">
                <div className="flex gap-4 mb-6">
                  <span className="text-xs font-black px-4 py-2 rounded-full bg-[#1e293b] text-emerald-400 border border-emerald-500/20 uppercase tracking-widest shadow-lg">{selectedNote.subject}</span>
                  {getItemType(selectedNote.tags) === 'exam' && <span className="text-xs font-black px-4 py-2 rounded-full bg-red-950/30 text-red-400 border border-red-500/20 uppercase tracking-widest shadow-lg">{getExamMeta(selectedNote.tags).grade} {getExamMeta(selectedNote.tags).term} {getExamMeta(selectedNote.tags).examType}</span>}
                </div>
                <h2 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tighter">{selectedNote.title}</h2>
              </div>
              <button onClick={() => { setSelectedNote(null); setRelevanceAnalysis({ loading: false, text: null, error: null }); }} className="p-5 bg-slate-800/50 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all shadow-2xl active:scale-90"><X className="w-10 h-10" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide space-y-16 text-left">
              <section>
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] mb-8 flex items-center"><FileText className="w-5 h-5 mr-4" /> Description</h4>
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap text-xl sm:text-2xl font-medium tracking-tight">{selectedNote.preview}</p>
              </section>

              <section className="bg-[#161f33] border border-emerald-500/10 rounded-[40px] p-10 sm:p-14 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-6">
                  <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.5em] flex items-center leading-none">
                    <BrainCircuit className="w-6 h-6 mr-4" /> AI Analytics Engine
                  </h4>
                  {!relevanceAnalysis.text && !relevanceAnalysis.loading && (
                    <button onClick={() => handleAnalyzeAI(selectedNote)} className="text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-[20px] flex items-center shadow-2xl transition-all active:scale-95 group tracking-widest uppercase">
                      <Compass className="w-5 h-5 mr-3 group-hover:rotate-180 transition-transform duration-700" /> Start Analysis
                    </button>
                  )}
                </div>
                {relevanceAnalysis.loading && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm">
                    <Loader2 className="w-16 h-16 animate-spin text-emerald-500 mb-8" />
                    <span className="font-black tracking-[0.3em] animate-pulse uppercase">Neural Processing...</span>
                  </div>
                )}
                {relevanceAnalysis.text && (
                  <div className="text-slate-300 text-lg sm:text-xl leading-loose whitespace-pre-wrap animate-in slide-in-from-bottom duration-1000 p-10 bg-[#0a0f18]/50 rounded-[32px] border border-slate-800 shadow-inner font-medium text-left">
                    {relevanceAnalysis.text}
                  </div>
                )}
              </section>
            </div>
            
            <div className="mt-10 pt-10 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-8 shrink-0">
              <div className="flex items-center text-sm text-slate-600 font-mono font-black tracking-[0.3em] uppercase"><Clock className="w-5 h-5 mr-4 text-emerald-500/60" /> Recorded: {selectedNote.date}</div>
              <div className="flex flex-wrap gap-4">
                {selectedNote.tags?.filter(t => !t.includes(':')).map((t, i) => (
                  <span key={i} className="text-[11px] font-black px-5 py-2 rounded-full bg-[#1e293b] text-slate-400 border border-slate-700/50 hover:border-emerald-500/30 transition-colors uppercase tracking-widest shadow-sm">#{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 2. プロフィール設定モーダル --- */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4 animate-in fade-in duration-700">
          <div className="bg-[#0d1424] border border-slate-700 rounded-[56px] p-12 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-[32px] flex items-center justify-center mb-10 mx-auto border border-emerald-500/20 shadow-inner text-left">
              <User className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black text-white text-center mb-2 tracking-tighter">Identity Setup</h2>
            <p className="text-slate-600 text-center text-[10px] font-black mb-12 tracking-[0.4em] uppercase text-left">Configure your college profile</p>
            <form onSubmit={handleUpdateProfile} className="space-y-6 text-left">
              <input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[24px] px-7 py-5 text-sm focus:border-emerald-500 transition-all font-bold placeholder:text-slate-700" placeholder="高専名 (例: 東京)" />
              <input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[24px] px-7 py-5 text-sm focus:border-emerald-500 transition-all font-bold placeholder:text-slate-700" placeholder="学科名 (例: 情報工学科)" />
              <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[24px] px-7 py-5 text-sm outline-none font-bold appearance-none">
                <option value="" disabled>学年を選択</option>
                {['1年', '2年', '3年', '4年', '5年', '専攻科'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button type="submit" disabled={isProfileUpdating} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-[28px] font-black transition-all shadow-2xl active:scale-95 mt-8 flex items-center justify-center uppercase text-xs tracking-widest">
                {isProfileUpdating ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Enter KOSEN-base'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- 3. 新規追加モーダル --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-[48px] p-10 w-full max-w-xl shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-white mb-10 flex items-center tracking-widest uppercase leading-none text-left"><Plus className="w-8 h-8 mr-4 text-emerald-500" /> New Record</h2>
            
            <div className="flex bg-[#161f33] p-1.5 rounded-[20px] mb-10 shadow-inner border border-slate-800 text-left">
              {['note', 'exam', 'material'].map(t => (
                <button key={t} onClick={() => setNewItemType(t)} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-2xl transition-all ${newItemType === t ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-slate-600 hover:text-slate-400'}`}>
                  {t === 'note' ? 'Lecture' : t === 'exam' ? 'Exam' : 'Resource'}
                </button>
              ))}
            </div>

            <form onSubmit={handleManualAdd} className="space-y-6 text-left">
              <input required type="text" value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[20px] px-6 py-5 text-sm focus:border-emerald-500 font-bold placeholder:text-slate-700" placeholder="Entry Title" />
              
              {newItemType === 'exam' && (
                <div className="grid grid-cols-3 gap-4">
                  <select value={examMeta.grade} onChange={e => setExamMeta({...examMeta, grade: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-4 text-xs font-black uppercase tracking-widest transition-all"><option value="1年">1st</option><option value="2年">2nd</option><option value="3年">3rd</option><option value="4年">4th</option><option value="5年">5th</option></select>
                  <select value={examMeta.term} onChange={e => setExamMeta({...examMeta, term: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-4 text-xs font-black uppercase tracking-widest transition-all"><option value="前期">Pre</option><option value="後期">Post</option></select>
                  <select value={examMeta.type} onChange={e => setExamMeta({...examMeta, type: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-4 py-4 text-xs font-black uppercase tracking-widest transition-all"><option value="中間">Mid</option><option value="期末">Final</option><option value="小テスト">Mini</option></select>
                </div>
              )}

              <input required type="text" value={newNote.subject} onChange={e => setNewNote({...newNote, subject: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[20px] px-6 py-5 text-sm focus:border-emerald-500 font-bold placeholder:text-slate-700" placeholder="Subject Name" />
              <textarea value={newNote.preview} onChange={e => setNewNote({...newNote, preview: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[20px] px-6 py-5 text-sm h-40 resize-none focus:border-emerald-500 font-medium leading-relaxed placeholder:text-slate-700" placeholder="Content details..." />
              
              <div className="flex gap-4 pt-8 text-left">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-[#161f33] text-slate-600 py-4 rounded-2xl font-black border border-slate-700 text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all">Cancel</button>
                <button type="submit" disabled={isAdding} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-2xl active:scale-95 flex items-center justify-center text-[10px] uppercase tracking-[0.2em]">
                  {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Push to DB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 4. カレンダー予定追加モーダル --- */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsEventModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-[40px] p-10 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-white mb-8 flex items-center uppercase tracking-tighter leading-none text-left"><CalendarIcon className="w-7 h-7 mr-4 text-emerald-500" /> New Event</h2>
            <p className="text-[10px] text-slate-600 mb-8 font-mono font-black tracking-widest uppercase leading-none border-l-2 border-emerald-500 pl-4 text-left">{selectedDate}</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newEventTitle.trim()) return;
              setEvents(prev => ({ ...prev, [selectedDate]: [...(prev[selectedDate] || []), { id: Date.now(), title: newEventTitle.trim() }] }));
              setNewEventTitle(''); setIsEventModalOpen(false);
            }} className="space-y-6 text-left">
              <input type="text" autoFocus required value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[20px] px-6 py-5 text-sm focus:border-emerald-500 shadow-inner font-bold placeholder:text-slate-700" placeholder="Title" />
              <div className="flex gap-4 pt-4 text-left">
                <button type="button" onClick={() => setIsEventModalOpen(false)} className="flex-1 bg-[#161f33] text-slate-600 py-4 rounded-2xl font-black border border-slate-700 text-[10px] uppercase">Back</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* サイドバー */}
      <aside className="w-72 bg-[#0d1424] border-r border-slate-800 flex flex-col hidden md:flex z-20 shrink-0 shadow-2xl">
        <div className="h-24 flex items-center px-10 border-b border-slate-800 shrink-0 text-left">
          <GraduationCap className="w-10 h-10 text-emerald-500 mr-5" />
          <h1 className="text-2xl font-black text-white tracking-[0.1em] uppercase leading-none tracking-tighter">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-12 px-8 space-y-3 overflow-y-auto scrollbar-hide text-left">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedSubject(null); }} className={`w-full flex items-center px-6 py-5 rounded-[24px] transition-all duration-300 ${activeView === item.id ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shadow-xl' : 'text-slate-600 hover:bg-slate-800/50 hover:text-slate-300 hover:translate-x-1'}`}>
              <item.icon className={`w-6 h-6 mr-5 ${activeView === item.id ? 'text-emerald-400' : ''}`} /><span className="font-black text-[11px] uppercase tracking-[0.2em]">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-8 border-t border-slate-800 shrink-0 text-left">
          <button onClick={() => { setActiveView('settings'); setSelectedSubject(null); }} className={`w-full flex items-center px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all group mb-6 rounded-2xl ${activeView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800/50'}`}>
            <Settings className="w-5 h-5 mr-5 group-hover:rotate-180 transition-transform duration-1000" />SETTING
          </button>
          <div onClick={handleSignOut} className="flex items-center px-5 py-5 rounded-[32px] bg-[#161f33]/30 border border-slate-800 hover:bg-slate-800/50 hover:border-slate-700 cursor-pointer transition-all group overflow-hidden shadow-sm text-left">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black mr-5 shadow-lg border border-emerald-400/20 uppercase shrink-0 text-sm leading-none">{session.user.user_metadata?.kosen ? session.user.user_metadata.kosen[0] : 'U'}</div>
            <div className="overflow-hidden flex-1 text-left">
              <p className="text-xs font-black text-slate-100 truncate tracking-tight uppercase leading-none mb-1.5">{session.user.user_metadata?.kosen ? `${session.user.user_metadata.kosen}` : 'USER'}</p>
              <p className="text-[9px] text-slate-600 font-mono font-black group-hover:text-red-400 truncate tracking-tighter uppercase leading-none">{session.user.user_metadata?.grade || 'N/A'} / {session.user.user_metadata?.department || 'N/A'}</p>
            </div>
            <LogOut className="w-5 h-5 text-slate-700 group-hover:text-red-400 transition-colors ml-3 shrink-0" />
          </div>
          <p className="text-[9px] text-slate-800 mt-10 text-center font-mono font-black tracking-[0.3em] uppercase opacity-30">VER 1.2.1 RELOADED</p>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0f18] overflow-hidden relative z-20 text-left">
        <header className="h-24 flex items-center justify-between px-12 border-b border-slate-800 bg-[#0d1424]/80 backdrop-blur-xl shrink-0 text-left">
          <div className="flex-1 max-w-2xl relative group text-left text-left">
            <Search className="w-6 h-6 absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-700 group-focus-within:text-emerald-500 transition-colors" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search records, tags, subjects..." className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[24px] pl-14 pr-8 py-4 focus:outline-none focus:border-emerald-500 transition-all text-sm font-black shadow-inner placeholder:text-slate-800 text-left" />
          </div>
          <div className="ml-10 flex items-center gap-5 shrink-0 text-left">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex items-center bg-[#161f33] hover:bg-slate-700 text-slate-400 border border-slate-700 px-7 py-4 rounded-[20px] font-black transition-all disabled:opacity-50 text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 group text-left">
              {isAnalyzing ? <Loader2 className="w-5 h-5 mr-3 animate-spin text-emerald-500" /> : <ImagePlus className="w-5 h-5 mr-3 text-emerald-500 group-hover:rotate-12 transition-transform" />} 
              Analyze
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-9 py-4 rounded-[20px] font-black transition-all shadow-[0_0_24px_rgba(16,185,129,0.3)] active:scale-95 text-[10px] uppercase tracking-widest flex items-center leading-none text-left"><Plus className="w-5 h-5 mr-2.5" /> Create</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 scrollbar-hide text-left">
          {analyzeMessage.text && (
            <div className="mb-10 animate-in slide-in-from-top duration-500 text-left">
              <div className={`border px-7 py-6 rounded-[32px] flex items-center shadow-2xl backdrop-blur-md ${analyzeMessage.type === 'error' ? 'bg-red-950/80 border-red-800 text-red-200' : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'}`}>
                {analyzeMessage.type === 'error' ? <AlertCircle className="w-7 h-7 mr-5 shrink-0 text-red-400" /> : <CheckCircle2 className="w-7 h-7 mr-5 shrink-0 text-emerald-400" />}
                <p className="flex-1 text-sm font-black tracking-tight text-left leading-relaxed text-left">{analyzeMessage.text}</p>
                <button onClick={() => setAnalyzeMessage({type: null, text: null})} className="ml-8 text-[11px] font-black uppercase tracking-[0.2em] hover:underline opacity-40">Close</button>
              </div>
            </div>
          )}
          
          {/* --- DASHBOARD VIEW --- */}
          {activeView === 'dashboard' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-700 text-left">
              <h2 className="text-3xl font-black text-white flex items-center mb-12 tracking-tighter text-left leading-none uppercase tracking-[0.1em] text-left"><LayoutDashboard className="w-8 h-8 mr-5 text-emerald-500" /> Latest Activity</h2>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[50vh]"><Loader2 className="w-16 h-16 animate-spin text-emerald-500" /></div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-slate-800 rounded-[56px] text-slate-800 group transition-colors hover:border-emerald-500/20 text-left">
                  <Search className="w-20 h-20 mb-8 opacity-5 group-hover:opacity-10 transition-opacity" />
                  <p className="font-black uppercase tracking-[0.5em] text-[10px]">No Data Streams Found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 text-left">{filteredItems.slice(0, 12).map(renderCard)}</div>
              )}
            </div>
          )}

          {/* --- NOTES VIEW --- */}
          {activeView === 'notes' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom duration-700 text-left">
              {!selectedSubject ? (
                <div className="text-center py-16 text-left">
                  <div className="w-32 h-32 bg-emerald-500/10 rounded-[48px] flex items-center justify-center mx-auto mb-12 border border-emerald-500/20 shadow-2xl"><BookOpen className="w-16 h-16 text-emerald-500" /></div>
                  <h2 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase leading-none text-center">Note Archives</h2>
                  <p className="text-slate-600 mb-20 font-black tracking-[0.2em] uppercase text-xs opacity-50 text-center">Lecture streams grouped by subject</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
                    {Array.from(new Set(filteredItems.filter(n => getItemType(n.tags) === 'note').map(n => n.subject))).map(sub => (
                      <div key={sub} onClick={() => setSelectedSubject(sub)} className="p-10 bg-[#0d1424] border border-slate-800 rounded-[40px] hover:border-emerald-500/40 hover:bg-[#162136] transition-all duration-500 flex items-center justify-between cursor-pointer group shadow-2xl text-left relative overflow-hidden text-left">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full transition-all group-hover:bg-emerald-500/10"></div>
                        <div className="flex items-center relative z-10 text-left text-left">
                          <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mr-8 group-hover:bg-emerald-600 transition-all duration-700 shadow-xl shrink-0"><FileText className="w-8 h-8 text-white" /></div>
                          <div>
                            <p className="font-black text-slate-100 text-2xl tracking-tighter leading-none mb-3 text-left">{sub || 'Global'}</p>
                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] leading-none text-left">{filteredItems.filter(n => n.subject === sub && getItemType(n.tags)==='note').length} Records</p>
                          </div>
                        </div>
                        <ChevronRight className="w-7 h-7 text-slate-800 group-hover:text-emerald-500 transform group-hover:translate-x-3 transition-all shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-700 text-left text-left">
                  <button onClick={() => setSelectedSubject(null)} className="flex items-center text-slate-600 hover:text-emerald-400 font-black text-xs mb-12 transition-all uppercase tracking-[0.3em] leading-none group text-left"><ArrowLeft className="w-6 h-6 mr-4 group-hover:-translate-x-3 transition-all" /> Return to Root</button>
                  <h2 className="text-4xl font-black text-white mb-12 border-l-[12px] border-emerald-500 pl-10 leading-none uppercase tracking-tighter text-left">{selectedSubject} Stream</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 text-left">{filteredItems.filter(n => n.subject === selectedSubject && getItemType(n.tags)==='note').map(renderCard)}</div>
                </div>
              )}
            </div>
          )}

          {activeView === 'exams' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-bottom duration-700 text-left text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-16 gap-8 text-left leading-none text-left">
                <h2 className="text-4xl font-black text-white flex items-center tracking-tighter uppercase leading-none text-left"><FileText className="w-10 h-10 mr-5 text-red-500" /> Exam Core</h2>
                <div className="flex bg-[#161f33] border border-slate-700 rounded-[28px] p-2 shadow-2xl min-w-[420px] shadow-black/50 text-left text-left">
                  <div className="flex items-center px-5 border-r border-slate-700 text-slate-600"><Filter className="w-5 h-5" /></div>
                  <select value={examFilter.grade} onChange={e => setExamFilter({...examFilter, grade: e.target.value})} className="bg-transparent text-slate-400 text-[11px] font-black uppercase px-5 py-3 outline-none cursor-pointer flex-1 transition-all hover:text-white">
                    <option value="">Year</option><option value="1年">1st</option><option value="2年">2nd</option><option value="3年">3rd</option><option value="4年">4th</option><option value="5年">5th</option>
                  </select>
                  <select value={examFilter.term} onChange={e => setExamFilter({...examFilter, term: e.target.value})} className="bg-transparent text-slate-400 text-[11px] font-black uppercase px-5 py-3 outline-none cursor-pointer border-l border-slate-700 flex-1 transition-all hover:text-white">
                    <option value="">Term</option><option value="前期">Pre</option><option value="後期">Post</option>
                  </select>
                  <select value={examFilter.type} onChange={e => setExamFilter({...examFilter, type: e.target.value})} className="bg-transparent text-slate-400 text-[11px] font-black uppercase px-5 py-3 outline-none cursor-pointer border-l border-slate-700 flex-1 transition-all hover:text-white">
                    <option value="">Exam</option><option value="中間">Mid</option><option value="期末">Final</option><option value="小テスト">Mini</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 text-left">
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
            <div className="max-w-7xl mx-auto animate-in fade-in duration-700 text-left text-left">
              <h2 className="text-4xl font-black text-white flex items-center mb-16 tracking-tighter uppercase leading-none text-left"><Bookmark className="w-10 h-10 mr-5 text-blue-500" /> Digital Library</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 text-left">{filteredItems.filter(n => getItemType(n.tags) === 'material').map(renderCard)}</div>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-top duration-1000 text-left text-left">
              <h2 className="text-4xl font-black text-white flex items-center mb-12 tracking-tighter text-left leading-none uppercase text-left"><CalendarIcon className="w-10 h-10 mr-6 text-emerald-500" /> Timeline <span className="ml-8 text-base text-slate-700 font-mono font-black tracking-[0.4em] opacity-40">{calendar.year}.{String(calendar.month + 1).padStart(2,'0')}</span></h2>
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-[56px] overflow-hidden border border-slate-800 shadow-[0_32px_64px_rgba(0,0,0,0.5)] text-left">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day} className="bg-[#11192a] py-8 text-center text-[11px] font-black text-slate-700 tracking-[0.4em] uppercase border-b border-slate-800/50">{day}</div>)}
                {calendar.days.map((d, i) => (
                  <div key={i} onClick={() => d && (setSelectedDate(d.dateStr), setIsEventModalOpen(true))} className={`bg-[#0d1424] min-h-[180px] p-6 transition-all duration-500 relative ${d ? 'hover:bg-slate-800/50 cursor-pointer group/cell' : 'opacity-20 cursor-default shadow-inner'} text-left`}>
                    {d && (
                      <>
                        <span className={`text-sm font-mono font-black transition-all ${d.dateStr === new Date().toISOString().split('T')[0] ? 'text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-2xl ring-1 ring-emerald-500/50 shadow-emerald-500/20' : 'text-slate-800'}`}>{d.day}</span>
                        <div className="mt-8 space-y-3 text-left text-left text-left">
                          {events[d.dateStr]?.map(ev => (
                            <div key={ev.id} className="px-4 py-3 bg-emerald-500/10 border-l-[4px] border-emerald-500 rounded-xl text-[10px] text-emerald-100 font-black flex justify-between items-center transition-all hover:bg-emerald-500/20 group/ev shadow-lg text-left">
                              <span className="truncate pr-3 uppercase tracking-tighter">{ev.title}</span>
                              <X onClick={e => { e.stopPropagation(); setEvents(p => ({ ...p, [d.dateStr]: p[d.dateStr].filter(x => x.id !== ev.id) })); }} className="w-4 h-4 opacity-0 group-hover/ev:opacity-100 text-red-500 hover:scale-150 transition-all cursor-pointer" />
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
            <div className="max-w-2xl mx-auto py-16 animate-in fade-in duration-700 text-left text-left">
              <h2 className="text-4xl font-black text-white mb-16 flex items-center tracking-tighter leading-none uppercase tracking-[0.1em] text-left"><Settings className="w-10 h-10 mr-6 text-emerald-500" /> Preferences</h2>
              <div className="bg-[#0d1424] border border-slate-800 rounded-[56px] p-14 shadow-[0_48px_96px_rgba(0,0,0,0.6)] relative overflow-hidden text-left border-t-emerald-500/30 text-left">
                <form onSubmit={handleUpdateProfile} className="space-y-10 text-left text-left">
                  <div className="space-y-3 text-left text-left"><label className="block text-[11px] font-black text-slate-700 uppercase tracking-[0.5em] ml-2 text-left">Account Holder</label><input type="text" disabled value={session.user.email} className="w-full bg-[#161f33]/50 border border-slate-800 text-slate-800 rounded-[28px] px-8 py-5 text-sm cursor-not-allowed font-mono font-black tracking-tight text-left" /></div>
                  <div className="space-y-3 text-left text-left"><label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] ml-2 text-left">College Campus</label><input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[28px] px-8 py-5 text-sm focus:border-emerald-500 font-black transition-all shadow-inner text-left" placeholder="Technical College" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left text-left">
                    <div className="space-y-3 text-left text-left text-left"><label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] ml-2 text-left">Engineering Major</label><input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[28px] px-8 py-5 text-sm focus:border-emerald-500 font-black transition-all shadow-inner text-left" placeholder="Department" /></div>
                    <div className="space-y-3 text-left text-left text-left"><label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] ml-2 text-left">Current Grade</label>
                      <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-[28px] px-8 py-5 text-sm outline-none font-black appearance-none transition-all shadow-inner text-left">
                        <option value="1年">1st Year</option><option value="2年">2nd Year</option><option value="3年">3rd Year</option><option value="4年">4th Year</option><option value="5年">5th Year</option><option value="専攻科">Adv. Course</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-12 flex justify-end border-t border-slate-800 text-left">
                    <button type="submit" disabled={isProfileUpdating} className="bg-emerald-600 hover:bg-emerald-500 text-white px-16 py-5 rounded-[32px] font-black transition-all shadow-2xl active:scale-95 flex items-center justify-center min-w-[240px] disabled:opacity-50 uppercase text-[11px] tracking-[0.4em] text-left">Save Identity</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右サイドバー：AIチャット */}
      <aside className="w-96 bg-[#0d1424] border-l border-slate-800 flex flex-col hidden lg:flex shrink-0 shadow-[0_0_64px_rgba(0,0,0,0.5)] relative z-20 text-left text-left">
        <div className="h-24 flex items-center px-10 border-b border-slate-800 bg-[#0d1424] shrink-0 text-left text-left">
          <div className="w-14 h-14 rounded-[20px] bg-emerald-500/10 flex items-center justify-center mr-6 border border-emerald-500/20 shadow-inner shrink-0 transition-all hover:rotate-12 hover:scale-110 text-left"><BrainCircuit className="w-7 h-7 text-emerald-400" /></div>
          <div className="text-left"><h2 className="font-black text-slate-100 text-[12px] tracking-[0.3em] uppercase leading-none mb-1.5 text-left text-left">KOSEN AI</h2><div className="flex items-center mt-1.5 text-left"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2.5 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)] text-left"></span><span className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em] opacity-80 text-left">Syncing Intelligence</span></div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-10 space-y-10 font-sans scrollbar-hide text-left text-left text-left">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500 text-left text-left text-left`}>
              <div className={`max-w-[95%] rounded-[32px] p-6 leading-relaxed shadow-xl text-base whitespace-pre-wrap font-medium text-left ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none shadow-emerald-900/30' : 'bg-[#161f33] text-slate-200 border border-slate-800 rounded-tl-none border-l-[5px] border-l-emerald-500 shadow-black/50'}`}>{msg.text}</div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start animate-in fade-in duration-500 text-left text-left">
              <div className="bg-[#161f33] text-slate-500 border border-slate-800 rounded-[32px] rounded-tl-none p-6 flex flex-col items-start gap-4 shadow-2xl min-w-[200px] text-left">
                <div className="flex items-center space-x-4 text-left"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /><span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 text-left">Cognitive Load...</span></div>
                <div className="w-56 h-2 bg-slate-800/50 rounded-full overflow-hidden relative shadow-inner text-left"><div className="absolute h-full bg-emerald-500/40 animate-[progress_2s_ease-in-out_infinite] w-2/3 text-left"></div></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-10 border-t border-slate-800 bg-[#0d1424] shrink-0 text-left text-left">
          <form onSubmit={handleSendMessage} className="relative group text-left text-left">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Consult the expert AI..." disabled={isChatLoading} className="w-full bg-[#161f33] border border-slate-800 border-b-[4px] border-b-slate-700 text-sm rounded-[24px] pl-7 pr-16 py-5 focus:outline-none focus:border-emerald-500 focus:border-b-emerald-600 transition-all font-black shadow-inner placeholder:text-slate-800 text-left" />
            <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-3.5 top-3.5 p-4 bg-emerald-600 text-white rounded-[18px] hover:bg-emerald-500 shadow-2xl active:scale-75 transition-all disabled:opacity-20 text-left"><Send className="w-5 h-5" /></button>
          </form>
        </div>
      </aside>

      <style>{`
        @keyframes progress { 0% { left: -100%; } 100% { left: 100%; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}