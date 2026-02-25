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
  Clock,
  ChevronRight,
  Trash2,
  LogOut,
  User,
  ArrowLeft,
  X,
  Compass,
  Bookmark,
  Filter
} from 'lucide-react';

// =========================================================================
// 本番環境（Vercel）用設定
// SupabaseとGeminiの環境変数を読み込みます。
// =========================================================================
import { createClient } from '@supabase/supabase-js';

// Viteの静的置換とプレビュー環境の両方に対応した安全な読み込み
// @ts-ignore
const SUPABASE_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL || '' : '';
// @ts-ignore
const SUPABASE_ANON_KEY = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY || '' : '';
// @ts-ignore
const VERCEL_GEMINI_API_KEY = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY || '' : '';

const apiKey = ""; // プレビュー環境用の自動注入APIキー
const GEMINI_API_KEY = VERCEL_GEMINI_API_KEY || apiKey;

const isCreateClientImported = typeof createClient !== 'undefined';
const hasEnvVars = SUPABASE_URL && SUPABASE_URL.length > 5 && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 5;
const isSupabaseReady = isCreateClientImported && hasEnvVars;

let supabase;

if (isSupabaseReady) {
  // @ts-ignore
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  // 環境変数が未設定の場合のダミーオブジェクト
  const getErrorMessage = () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return "Vercelの環境変数（VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY）が読み込めていません。設定とRedeployを確認してください。";
    }
    return "Supabaseの初期化に失敗しました。";
  };
  const mockError = { error: { message: getErrorMessage() }, data: null };
  
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve(mockError),
      signUp: () => Promise.resolve(mockError),
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
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIです。学習の相談、過去問の傾向分析、将来のキャリアについて何でも聞いてください。' }
];

// ヘルパー：タグからアイテムの種類を判定
const getItemType = (tags) => {
  if (!tags || !Array.isArray(tags)) return 'note';
  if (tags.includes('type:exam')) return 'exam';
  if (tags.includes('type:material')) return 'material';
  return 'note';
};

// ヘルパー：タグから過去問のメタデータを抽出
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
  // --- ステート管理 ---
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

  // --- 認証の初期化 ---
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

  // --- データ取得 ---
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

  // --- 準備状態の確認 ---
  const checkReady = () => {
    if (!isSupabaseReady) {
      throw new Error("環境変数が読み込めていません。Vercelで「Redeploy」を行ってください。");
    }
  };

  // --- アクションハンドラー ---
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
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY が未設定です。");
      
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [
          { text: "学習ノートの画像を解析し、JSON形式で返してください。\n{\n  \"title\": \"\",\n  \"subject\": \"\",\n  \"preview\": \"詳細な要約\",\n  \"tags\": []\n}" },
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
      setAnalyzeMessage({ type: 'success', text: '画像からノートを作成しました！' });
    } catch (err) { setAnalyzeMessage({ type: 'error', text: err.message }); } 
    finally { setIsAnalyzing(false); if (fileInputRef.current) fileInputRef.current.value = ''; setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 7000); }
  };

  const handleAnalyzeAI = async (item) => {
    setRelevanceAnalysis({ loading: true, text: null, error: null });
    try {
      if (!GEMINI_API_KEY) throw new Error("APIキーが設定されていません。");
      const type = getItemType(item.tags);
      const prompt = type === 'exam' 
        ? `高専の教員として、この過去問のタイトル「${item.title}」と内容「${item.preview}」から出題分野を特定し、解法のポイントを3点簡潔に教えてください。`
        : `この学習内容「${item.title}」が、高専の各学科（機械・電気・情報・建築・物質等）で将来どう使われるか、学科ごとに1行ずつ簡潔に教えてください。`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
        setChatMessages(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: 'APIキー未設定のため、デモモードです。' }]);
        return;
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `あなたは高専生専用のAIアシスタントです。質問: ${userText}` }] }] })
      });
      const result = await response.json();
      setChatMessages(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: result.candidates[0].content.parts[0].text }]);
    } catch (err) { setChatMessages(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: "通信エラーが発生しました。" }]); } 
    finally { setIsChatLoading(false); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("完全に削除しますか？")) return;
    try {
      checkReady();
      await supabase.from('notes').delete().eq('id', id);
      setNotes(prev => prev.filter(n => n.id !== id));
      setSelectedNote(null);
      setAnalyzeMessage({ type: 'success', text: '削除しました。' });
    } catch (e) { setAnalyzeMessage({ type: 'error', text: e.message }); }
    finally { setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 3000); }
  };

  // --- カレンダー生成 ---
  const getCalendar = () => {
    const d = new Date();
    const year = d.getFullYear(), month = d.getMonth();
    const first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
    const days = Array(first.getDay()).fill(null);
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({ day: i, dateStr: `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}` });
    }
    return { days, year, month };
  };
  const calendar = getCalendar();

  // --- UI レンダリングヘルパー ---
  const renderCard = (note) => {
    const type = getItemType(note.tags);
    const meta = type === 'exam' ? getExamMeta(note.tags) : null;
    return (
      <div key={note.id} onClick={() => setSelectedNote(note)} className="bg-[#11192a] border border-slate-800 rounded-3xl p-6 hover:border-emerald-500/50 hover:bg-[#162136] transition-all cursor-pointer group flex flex-col shadow-xl min-h-[240px] relative text-left">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${type === 'exam' ? 'bg-red-950/30 text-red-400 border-red-500/20' : type === 'material' ? 'bg-blue-950/30 text-blue-400 border-blue-500/20' : 'bg-[#1e293b] text-emerald-400 border-emerald-500/20'}`}>
              {note.subject}
            </span>
            {type === 'exam' && meta && <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-widest">{meta.grade} {meta.term}</span>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); deleteItem(note.id); }} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors active:scale-90"><Trash2 className="w-4 h-4" /></button>
        </div>
        <h3 className="text-lg font-black text-white mb-2 group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">{note.title}</h3>
        <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed font-medium">{note.preview}</p>
        <div className="mt-auto pt-4 border-t border-slate-800/50 flex items-center text-[10px] text-slate-500 font-mono font-black uppercase">
          <Clock className="w-3 h-3 mr-1.5 text-emerald-500/60" />{note.date}
        </div>
      </div>
    );
  };

  const filteredItems = Array.isArray(notes) ? notes.filter(n => {
    const q = searchQuery.toLowerCase();
    return (n.title && n.title.toLowerCase().includes(q)) || 
           (n.subject && n.subject.toLowerCase().includes(q)) || 
           (n.preview && n.preview.toLowerCase().includes(q));
  }) : [];

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
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full animate-pulse"></div>
        <div className="w-full max-w-md bg-[#0d1424]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 mx-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <GraduationCap className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-center text-white mb-2 uppercase tracking-widest">KOSEN-base</h1>
          <p className="text-center text-slate-500 text-[10px] font-black mb-8 tracking-[0.2em] uppercase">Engineering Hub</p>
          <form className="space-y-5" onSubmit={(e) => {
            e.preventDefault();
            setIsAuthSubmitLoading(true); setAuthError('');
            const action = isLoginMode ? supabase.auth.signInWithPassword({ email, password }) : supabase.auth.signUp({ email, password });
            action.then(({error}) => {
              if (error) setAuthError(error.message);
              else if (!isLoginMode) alert("確認メールを送信しました。");
              setIsAuthSubmitLoading(false);
            });
          }}>
            <div className="flex bg-[#161f33] p-1.5 rounded-xl mb-6 shadow-inner">
              <button type="button" onClick={() => setIsLoginMode(true)} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-lg transition-all ${isLoginMode ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>ログイン</button>
              <button type="button" onClick={() => setIsLoginMode(false)} className={`flex-1 py-2.5 text-xs font-black uppercase rounded-lg transition-all ${!isLoginMode ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>新規登録</button>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-emerald-500 font-bold" placeholder="メールアドレス" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-emerald-500 font-bold" placeholder="パスワード" />
            {authError && <div className="text-red-400 text-xs flex items-start bg-red-400/10 p-3 rounded-lg border border-red-500/20"><AlertCircle className="w-4 h-4 mr-2 shrink-0" />{authError}</div>}
            <button type="submit" disabled={isAuthSubmitLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center disabled:opacity-50 text-sm tracking-widest">
              {isAuthSubmitLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLoginMode ? 'ログイン' : 'アカウント作成')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 font-sans overflow-hidden relative text-left">
      
      {/* 画面外クリックでメニュー閉じる */}
      {menuOpenId && <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)}></div>}

      {/* --- 全画面詳細モーダル --- */}
      {selectedNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-300" onClick={() => setSelectedNote(null)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-6 sm:p-10 w-full h-full max-w-5xl shadow-2xl relative flex flex-col overflow-hidden text-left" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6 shrink-0 border-b border-slate-800 pb-6">
              <div className="flex-1 pr-8">
                <div className="flex gap-3 mb-4">
                  <span className="text-xs font-black px-3 py-1.5 rounded-full bg-[#1e293b] text-emerald-400 border border-emerald-500/20 uppercase">{selectedNote.subject}</span>
                  {getItemType(selectedNote.tags) === 'exam' && <span className="text-xs font-black px-3 py-1.5 rounded-full bg-red-950/30 text-red-400 border border-red-500/20 uppercase">{getExamMeta(selectedNote.tags).grade} {getExamMeta(selectedNote.tags).term} {getExamMeta(selectedNote.tags).examType}</span>}
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">{selectedNote.title}</h2>
              </div>
              <button onClick={() => { setSelectedNote(null); setRelevanceAnalysis({ loading: false, text: null, error: null }); }} className="p-3 bg-slate-800/50 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-8">
              <section>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center"><FileText className="w-4 h-4 mr-2" /> コンテンツ内容</h4>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-lg sm:text-xl font-medium">{selectedNote.preview}</p>
              </section>

              <section className="bg-[#161f33] border border-emerald-500/10 rounded-3xl p-6 sm:p-8 shadow-inner">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center"><BrainCircuit className="w-5 h-5 mr-3" /> AI Analysis</h4>
                  {!relevanceAnalysis.text && !relevanceAnalysis.loading && (
                    <button onClick={() => handleAnalyzeAI(selectedNote)} className="text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl flex items-center shadow-lg transition-all active:scale-95 uppercase tracking-widest"><Compass className="w-4 h-4 mr-2" /> 分析を実行</button>
                  )}
                </div>
                {relevanceAnalysis.loading && <div className="flex items-center text-slate-400 text-sm py-8 justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500 mr-4" /><span className="font-black tracking-widest animate-pulse uppercase">Thinking...</span></div>}
                {relevanceAnalysis.text && <div className="text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap animate-in fade-in p-6 bg-[#0a0f18]/50 rounded-2xl border border-slate-800 shadow-inner">{relevanceAnalysis.text}</div>}
              </section>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <div className="flex items-center text-sm text-slate-500 font-mono font-black tracking-widest"><Clock className="w-5 h-5 mr-3 text-emerald-500/60" />{selectedNote.date}</div>
              <div className="flex flex-wrap gap-2">
                {selectedNote.tags?.filter(t => !t.includes(':')).map((t, i) => (
                  <span key={i} className="text-[10px] font-black px-3 py-1.5 rounded-full bg-[#1e293b] text-slate-400 border border-slate-700/50">#{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- プロフィール設定モーダル --- */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in text-left">
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-emerald-500/20"><User className="w-8 h-8 text-emerald-500" /></div>
            <h2 className="text-2xl font-black text-white text-center mb-6">プロフィール設定</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm focus:border-emerald-500 font-bold" placeholder="高専名 (例: 東京)" />
              <input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm focus:border-emerald-500 font-bold" placeholder="学科名 (例: 情報工学科)" />
              <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm outline-none font-bold">
                <option value="" disabled>学年を選択</option>
                {['1年', '2年', '3年', '4年', '5年', '専攻科'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button type="submit" disabled={isProfileUpdating} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black mt-6 flex justify-center uppercase tracking-widest text-xs">
                {isProfileUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'KOSEN-base を開始'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- 新規追加モーダル --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 text-left" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-white mb-6 flex items-center uppercase tracking-widest"><Plus className="w-6 h-6 mr-3 text-emerald-500" /> 新規アイテム作成</h2>
            <div className="flex bg-[#161f33] p-1.5 rounded-xl mb-6 shadow-inner border border-slate-800">
              {['note', 'exam', 'material'].map(t => (
                <button key={t} onClick={() => setNewItemType(t)} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${newItemType === t ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                  {t === 'note' ? 'ノート' : t === 'exam' ? '過去問' : '資料'}
                </button>
              ))}
            </div>
            <form onSubmit={handleManualAdd} className="space-y-4">
              <input required type="text" value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm focus:border-emerald-500 font-bold" placeholder="タイトル" />
              {newItemType === 'exam' && (
                <div className="grid grid-cols-3 gap-3">
                  <select value={examMeta.grade} onChange={e => setExamMeta({...examMeta, grade: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-3 py-3 text-xs font-bold"><option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option></select>
                  <select value={examMeta.term} onChange={e => setExamMeta({...examMeta, term: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-3 py-3 text-xs font-bold"><option value="前期">前期</option><option value="後期">後期</option></select>
                  <select value={examMeta.type} onChange={e => setExamMeta({...examMeta, type: e.target.value})} className="bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-3 py-3 text-xs font-bold"><option value="中間">中間</option><option value="期末">期末</option><option value="小テスト">小テスト</option></select>
                </div>
              )}
              <input required type="text" value={newNote.subject} onChange={e => setNewNote({...newNote, subject: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm focus:border-emerald-500 font-bold" placeholder="科目名" />
              <textarea value={newNote.preview} onChange={e => setNewNote({...newNote, preview: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm h-32 resize-none focus:border-emerald-500 font-medium" placeholder="内容の要約..." />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-[#161f33] text-slate-400 py-3.5 rounded-xl font-black border border-slate-700 text-xs tracking-widest uppercase">キャンセル</button>
                <button type="submit" disabled={isAdding} className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-black shadow-lg flex items-center justify-center text-xs tracking-widest uppercase">
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- カレンダー予定追加モーダル --- */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsEventModalOpen(false)}>
          <div className="bg-[#0d1424] border border-slate-700 rounded-3xl p-8 w-full max-w-sm shadow-2xl text-left" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-white mb-6 flex items-center uppercase tracking-tight"><CalendarIcon className="w-6 h-6 mr-3 text-emerald-500" /> 予定を追加</h2>
            <p className="text-[10px] text-slate-500 mb-6 font-mono font-black tracking-widest uppercase">{selectedDate}</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newEventTitle.trim()) return;
              setEvents(prev => ({ ...prev, [selectedDate]: [...(prev[selectedDate] || []), { id: Date.now(), title: newEventTitle.trim() }] }));
              setNewEventTitle(''); setIsEventModalOpen(false);
            }} className="space-y-4">
              <input type="text" autoFocus required value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-5 py-4 text-sm focus:border-emerald-500 shadow-inner font-bold" placeholder="予定内容" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEventModalOpen(false)} className="flex-1 bg-[#161f33] text-slate-500 py-3 rounded-xl font-black border border-slate-700 text-[10px] uppercase tracking-widest">キャンセル</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* サイドバー */}
      <aside className="w-64 bg-[#0d1424] border-r border-slate-800 flex flex-col hidden md:flex z-20 shrink-0 text-left">
        <div className="h-20 flex items-center px-8 border-b border-slate-800 shrink-0">
          <GraduationCap className="w-8 h-8 text-emerald-500 mr-4" />
          <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-8 px-6 space-y-2 overflow-y-auto scrollbar-hide">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveView(item.id); setSelectedSubject(null); }} className={`w-full flex items-center px-5 py-3.5 rounded-xl transition-all duration-300 ${activeView === item.id ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'}`}>
              <item.icon className={`w-5 h-5 mr-4 ${activeView === item.id ? 'text-emerald-400' : ''}`} /><span className="font-black text-[10px] uppercase tracking-[0.15em]">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-800 shrink-0">
          <button onClick={() => { setActiveView('settings'); setSelectedSubject(null); }} className={`w-full flex items-center px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all group mb-4 rounded-lg ${activeView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800/50'}`}>
            <Settings className="w-4 h-4 mr-4 group-hover:rotate-90 transition-transform" />設定
          </button>
          <div onClick={handleSignOut} className="flex items-center px-4 py-3.5 rounded-2xl bg-[#161f33]/30 border border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-all group">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black mr-4 text-xs">{session.user.user_metadata?.kosen ? session.user.user_metadata.kosen[0] : 'U'}</div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-black text-slate-100 truncate tracking-tight uppercase">{session.user.user_metadata?.kosen ? `${session.user.user_metadata.kosen}` : 'USER'}</p>
              <p className="text-[9px] text-slate-600 font-mono font-black group-hover:text-red-400 truncate uppercase mt-0.5">{session.user.user_metadata?.grade || 'N/A'}</p>
            </div>
            <LogOut className="w-4 h-4 text-slate-700 group-hover:text-red-400 ml-2 shrink-0" />
          </div>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0f18] overflow-hidden relative z-20 text-left">
        <header className="h-20 flex items-center justify-between px-10 border-b border-slate-800 bg-[#0d1424]/80 backdrop-blur-xl shrink-0">
          <div className="flex-1 max-w-xl relative group">
            <Search className="w-5 h-5 absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="アイテムを検索..." className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl pl-14 pr-6 py-3.5 focus:outline-none focus:border-emerald-500 text-sm font-bold shadow-inner placeholder:text-slate-700" />
          </div>
          <div className="ml-8 flex items-center gap-4 shrink-0">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex items-center bg-[#161f33] hover:bg-slate-700 text-slate-400 border border-slate-700 px-6 py-3.5 rounded-xl font-black transition-all disabled:opacity-50 text-[10px] uppercase tracking-widest shadow-lg active:scale-95">
              {isAnalyzing ? <Loader2 className="w-4 h-4 mr-3 animate-spin text-emerald-500" /> : <ImagePlus className="w-4 h-4 mr-3 text-emerald-500" />} 画像から追加
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-xl font-black shadow-lg active:scale-95 text-[10px] uppercase tracking-widest flex items-center"><Plus className="w-4 h-4 mr-2" /> 新規作成</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 scrollbar-hide text-left">
          {analyzeMessage.text && (
            <div className="mb-8 animate-in slide-in-from-top duration-300">
              <div className={`border px-6 py-4 rounded-2xl flex items-center shadow-lg backdrop-blur-md ${analyzeMessage.type === 'error' ? 'bg-red-950/80 border-red-800 text-red-200' : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'}`}>
                {analyzeMessage.type === 'error' ? <AlertCircle className="w-6 h-6 mr-4 text-red-400" /> : <CheckCircle2 className="w-6 h-6 mr-4 text-emerald-400" />}
                <p className="flex-1 text-sm font-black">{analyzeMessage.text}</p>
                <button onClick={() => setAnalyzeMessage({type: null, text: null})} className="text-[10px] font-black uppercase opacity-50 hover:underline">Close</button>
              </div>
            </div>
          )}
          
          {/* --- VIEW: DASHBOARD --- */}
          {activeView === 'dashboard' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white flex items-center mb-10 uppercase tracking-widest"><LayoutDashboard className="w-6 h-6 mr-4 text-emerald-500" /> 最近の活動</h2>
              {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-emerald-500" /></div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-800 rounded-3xl text-slate-700">
                  <Search className="w-16 h-16 mb-6 opacity-10" />
                  <p className="font-black uppercase tracking-[0.2em] text-xs">アイテムが見つかりません</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{filteredItems.slice(0, 12).map(renderCard)}</div>
              )}
            </div>
          )}

          {/* --- VIEW: NOTES --- */}
          {activeView === 'notes' && (
            <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom duration-500">
              {!selectedSubject ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20"><BookOpen className="w-12 h-12 text-emerald-500" /></div>
                  <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-widest">マイノート</h2>
                  <p className="text-slate-600 mb-12 font-black tracking-widest uppercase text-xs">科目ごとに整理されています</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    {Array.from(new Set(filteredItems.filter(n => getItemType(n.tags) === 'note').map(n => n.subject))).map(sub => (
                      <div key={sub} onClick={() => setSelectedSubject(sub)} className="p-8 bg-[#0d1424] border border-slate-800 rounded-3xl hover:border-emerald-500/40 transition-all flex items-center justify-between cursor-pointer group shadow-lg">
                        <div className="flex items-center">
                          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-emerald-600 transition-colors"><FileText className="w-7 h-7 text-white" /></div>
                          <div>
                            <p className="font-black text-slate-100 text-lg tracking-tight mb-1">{sub || '未分類'}</p>
                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{filteredItems.filter(n => n.subject === sub && getItemType(n.tags)==='note').length} Records</p>
                          </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-emerald-500 transform group-hover:translate-x-2 transition-transform" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-500 text-left">
                  <button onClick={() => setSelectedSubject(null)} className="flex items-center text-slate-600 hover:text-emerald-400 font-black text-xs mb-10 transition-all uppercase tracking-widest group"><ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" /> 科目一覧に戻る</button>
                  <h2 className="text-3xl font-black text-white mb-10 border-l-8 border-emerald-500 pl-6 uppercase">{selectedSubject} のノート</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{filteredItems.filter(n => n.subject === selectedSubject && getItemType(n.tags)==='note').map(renderCard)}</div>
                </div>
              )}
            </div>
          )}

          {/* --- VIEW: EXAMS --- */}
          {activeView === 'exams' && (
            <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom duration-500 text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-6">
                <h2 className="text-3xl font-black text-white flex items-center uppercase tracking-widest"><FileText className="w-8 h-8 mr-4 text-red-500" /> 過去問アーカイブ</h2>
                <div className="flex bg-[#161f33] border border-slate-700 rounded-2xl p-1.5 shadow-lg min-w-[360px]">
                  <div className="flex items-center px-4 border-r border-slate-700"><Filter className="w-4 h-4 text-slate-500" /></div>
                  <select value={examFilter.grade} onChange={e => setExamFilter({...examFilter, grade: e.target.value})} className="bg-transparent text-slate-400 text-[10px] font-black uppercase px-4 py-2 outline-none cursor-pointer flex-1"><option value="">全学年</option><option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option></select>
                  <select value={examFilter.term} onChange={e => setExamFilter({...examFilter, term: e.target.value})} className="bg-transparent text-slate-400 text-[10px] font-black uppercase px-4 py-2 outline-none cursor-pointer border-l border-slate-700 flex-1"><option value="">全学期</option><option value="前期">前期</option><option value="後期">後期</option></select>
                  <select value={examFilter.type} onChange={e => setExamFilter({...examFilter, type: e.target.value})} className="bg-transparent text-slate-400 text-[10px] font-black uppercase px-4 py-2 outline-none cursor-pointer border-l border-slate-700 flex-1"><option value="">種別</option><option value="中間">中間</option><option value="期末">期末</option><option value="小テスト">小テスト</option></select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

          {/* --- VIEW: MATERIALS --- */}
          {activeView === 'materials' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-500 text-left">
              <h2 className="text-3xl font-black text-white flex items-center mb-12 uppercase tracking-widest"><Bookmark className="w-8 h-8 mr-4 text-blue-500" /> 学習資料・プリント</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{filteredItems.filter(n => getItemType(n.tags) === 'material').map(renderCard)}</div>
            </div>
          )}

          {/* --- VIEW: CALENDAR --- */}
          {activeView === 'calendar' && (
            <div className="max-w-6xl mx-auto animate-in slide-in-from-top duration-700 text-left">
              <h2 className="text-3xl font-black text-white flex items-center mb-10 uppercase tracking-widest"><CalendarIcon className="w-8 h-8 mr-4 text-emerald-500" /> 予定カレンダー <span className="ml-6 text-sm text-slate-600 font-mono tracking-[0.3em]">{calendar.year}.{String(calendar.month + 1).padStart(2,'0')}</span></h2>
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day} className="bg-[#11192a] py-6 text-center text-[10px] font-black text-slate-600 tracking-widest">{day}</div>)}
                {calendar.days.map((d, i) => (
                  <div key={i} onClick={() => d && (setSelectedDate(d.dateStr), setIsEventModalOpen(true))} className={`bg-[#0d1424] min-h-[140px] p-4 transition-all relative ${d ? 'hover:bg-slate-800/50 cursor-pointer group/cell' : 'opacity-20 cursor-default'}`}>
                    {d && (
                      <>
                        <span className={`text-xs font-mono font-black ${d.dateStr === new Date().toISOString().split('T')[0] ? 'text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg' : 'text-slate-600'}`}>{d.day}</span>
                        <div className="mt-4 space-y-2">
                          {events[d.dateStr]?.map(ev => (
                            <div key={ev.id} className="px-3 py-2 bg-emerald-500/10 border-l-[3px] border-emerald-500 rounded-md text-[9px] text-emerald-100 font-black flex justify-between items-center group/ev">
                              <span className="truncate pr-2">{ev.title}</span>
                              <X onClick={e => { e.stopPropagation(); setEvents(p => ({ ...p, [d.dateStr]: p[d.dateStr].filter(x => x.id !== ev.id) })); }} className="w-3 h-3 opacity-0 group-hover/ev:opacity-100 text-red-500" />
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

          {/* --- VIEW: SETTINGS --- */}
          {activeView === 'settings' && (
            <div className="max-w-2xl mx-auto py-12 animate-in fade-in duration-500 text-left">
              <h2 className="text-3xl font-black text-white mb-10 flex items-center uppercase tracking-widest"><Settings className="w-8 h-8 mr-4 text-emerald-500" /> 設定</h2>
              <div className="bg-[#0d1424] border border-slate-800 rounded-3xl p-10 shadow-xl border-t-emerald-500/30">
                <form onSubmit={handleUpdateProfile} className="space-y-8">
                  <div className="space-y-2"><label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">アカウント</label><input type="text" disabled value={session.user.email} className="w-full bg-[#161f33]/50 border border-slate-800 text-slate-500 rounded-xl px-6 py-4 text-sm font-mono font-black" /></div>
                  <div className="space-y-2"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">所属高専</label><input required type="text" value={profileForm.kosen} onChange={e => setProfileForm({...profileForm, kosen: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-6 py-4 text-sm focus:border-emerald-500 font-bold" /></div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">学科</label><input required type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-6 py-4 text-sm focus:border-emerald-500 font-bold" /></div>
                    <div className="space-y-2"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">学年</label>
                      <select required value={profileForm.grade} onChange={e => setProfileForm({...profileForm, grade: e.target.value})} className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-xl px-6 py-4 text-sm outline-none font-bold">
                        <option value="1年">1年</option><option value="2年">2年</option><option value="3年">3年</option><option value="4年">4年</option><option value="5年">5年</option><option value="専攻科">専攻科</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-8 flex justify-end border-t border-slate-800">
                    <button type="submit" disabled={isProfileUpdating} className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-xl font-black shadow-lg active:scale-95 flex items-center justify-center min-w-[200px] uppercase text-[10px] tracking-widest">保存</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右サイドバー (AI Chat) */}
      <aside className="w-80 bg-[#0d1424] border-l border-slate-800 flex flex-col hidden lg:flex shrink-0 shadow-2xl relative z-20 text-left">
        <div className="h-20 flex items-center px-8 border-b border-slate-800 bg-[#0d1424] shrink-0">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mr-5 border border-emerald-500/20"><BrainCircuit className="w-6 h-6 text-emerald-400" /></div>
          <div><h2 className="font-black text-slate-100 text-[11px] tracking-widest uppercase mb-1">KOSEN AI</h2><div className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span><span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest opacity-80">Online</span></div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 font-sans scrollbar-hide text-left">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300 text-left`}>
              <div className={`max-w-[95%] rounded-2xl p-5 leading-relaxed shadow-lg text-sm whitespace-pre-wrap font-medium ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-[#161f33] text-slate-200 border border-slate-800 rounded-tl-none border-l-[4px] border-l-emerald-500'}`}>{msg.text}</div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-[#161f33] text-slate-500 border border-slate-800 rounded-2xl rounded-tl-none p-5 flex flex-col items-start gap-4">
                <div className="flex items-center space-x-3"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Processing...</span></div>
                <div className="w-48 h-1.5 bg-slate-800/50 rounded-full overflow-hidden relative"><div className="absolute h-full bg-emerald-500/40 animate-[progress_1.5s_ease-in-out_infinite] w-2/3"></div></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-8 border-t border-slate-800 bg-[#0d1424] shrink-0 text-left">
          <form onSubmit={handleSendMessage} className="relative group">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="AIアシスタントに質問..." disabled={isChatLoading} className="w-full bg-[#161f33] border border-slate-800 border-b-[3px] border-b-slate-700 text-xs rounded-xl pl-5 pr-14 py-4 focus:outline-none focus:border-emerald-500 focus:border-b-emerald-600 transition-all font-bold" />
            <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-2 top-2 p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-lg active:scale-90 transition-transform"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      </aside>
    </div>
  );
}