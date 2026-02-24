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
  Clock
} from 'lucide-react';

/**
 * 【開発・デプロイ時の注意】
 * プレビュー環境でのビルドエラー（./supabaseClient が解決できない）を防ぐため、
 * 現在 supabase は内部でモック（ダミー）として定義されています。
 * * ローカル環境や Vercel で本物の Supabase と連携させる際は、
 * 1. 以下の `import` のコメントアウトを外す
 * 2. その下の `const supabase = ...` （モック）のブロックを削除する
 */
import { supabase } from './supabaseClient';



const INITIAL_CHAT = [
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIアシスタントです。ノートの解析や、学習の相談など、何でも聞いてください。' }
];

export default function App() {
  const [notes, setNotes] = useState([]);
  const [activeView, setActiveView] = useState('dashboard'); // サイドバー切り替え用
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState({ type: null, text: null });
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  
  const fileInputRef = useRef(null);

  const getGeminiKey = () => {
    try {
      const meta = (import.meta as any);
      if (meta && meta.env) {
        return (meta.env.VITE_GEMINI_API_KEY || '').trim();
      }
    } catch (e) {}
    return '';
  };

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setNotes(data);
      } else {
        // データが空の場合の初期サンプル
        setNotes([
          { id: 1, title: "線形代数 第3回 行列式の計算", subject: "数学", date: "2026-02-24", preview: "サラスの公式を用いた3次正方行列の行列式の求め方。余因子展開への応用...", tags: ["前期", "テスト対策"] },
          { id: 2, title: "アルゴリズムとデータ構造 探索", subject: "情報", date: "2026-02-22", preview: "線形探索と二分探索の実装。時間計算量の比較 O(n) vs O(log n)。", tags: ["C言語", "課題"] },
          { id: 3, title: "応用物理 力学の基礎（剛体）", subject: "物理", date: "2026-02-20", preview: "慣性モーメントの概念と、平行軸の定理についてのまとめ。剛体の回転運動方程式。", tags: ["レポート"] }
        ]);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    setAnalyzeMessage({ type: null, text: null });

    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      const geminiKey = getGeminiKey();
      if (!geminiKey) {
        await new Promise(r => setTimeout(r, 1500));
        setAnalyzeMessage({ type: 'success', text: 'プレビューモード：解析シミュレーションが完了しました。' });
      } else {
        const targetModel = "gemini-2.5-flash"; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiKey}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "提供された画像から学習ノートの情報を抽出し、JSON形式で返してください。\n{\n  \"title\": \"ノートのタイトル\",\n  \"subject\": \"科目名\",\n  \"preview\": \"内容の要約\",\n  \"tags\": [\"タグ1\", \"タグ2\"]\n}" },
                { inlineData: { mimeType: file.type, data: base64Data } }
              ]
            }]
          })
        });

        if (!response.ok) throw new Error(`APIリクエスト失敗: ${response.status}`);
        const result = await response.json();
        let aiText = result.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(aiText);

        await supabase.from('notes').insert([{
          ...parsedData,
          date: new Date().toISOString().split('T')[0]
        }]);

        await fetchNotes();
        setAnalyzeMessage({ type: 'success', text: 'ノートが正常に解析・保存されました！' });
      }
      setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 5000);
    } catch (err) {
      setAnalyzeMessage({ type: 'error', text: `エラー: ${err.message}` });
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newUserMsg = { id: Date.now(), sender: 'user', text: chatInput };
    setChatMessages(prev => [...prev, newUserMsg]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'AIチャット機能は準備中です！' }]);
    }, 1000);
  };

  // --- サイドバーのメニュー項目定義 ---
  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'notes', label: 'マイノート', icon: BookOpen },
    { id: 'archive', label: '過去問・資料', icon: FileText },
    { id: 'calendar', label: 'カレンダー', icon: CalendarIcon },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* 左サイドバー */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <GraduationCap className="w-8 h-8 text-emerald-500 mr-3" />
          <h1 className="text-xl font-bold text-white tracking-wider">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${
                activeView === item.id 
                  ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <item.icon className={`w-5 h-5 mr-3 ${activeView === item.id ? 'text-emerald-400' : ''}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center px-4 py-2 text-slate-400 hover:text-slate-200 text-sm">
            <Settings className="w-4 h-4 mr-3" />
            設定
          </button>
          <div className="mt-4 flex items-center px-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold mr-3">高</div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-slate-200 truncate">高専 太郎</p>
              <p className="text-[10px] text-slate-500">情報工学科 3年</p>
            </div>
          </div>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
        {/* ヘッダー */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10 shrink-0">
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="ノートや資料を検索..." 
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-emerald-500 transition-all text-sm"
              />
            </div>
          </div>
          
          <div className="ml-4 flex items-center space-x-3">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="flex items-center bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-500" /> : <ImagePlus className="w-4 h-4 mr-2 text-emerald-500" />}
              {isAnalyzing ? '解析中...' : '画像から追加'}
            </button>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-900/20 text-sm flex items-center">
              <Plus className="w-4 h-4 mr-1" />
              新規
            </button>
          </div>
        </header>
        
        {/* 通知エリア */}
        {analyzeMessage.text && (
          <div className="px-6 pt-4 shrink-0">
            <div className={`border px-4 py-3 rounded-lg flex items-start space-x-3 ${
              analyzeMessage.type === 'error' ? 'bg-red-900/30 border-red-800 text-red-200' : 'bg-emerald-900/30 border-emerald-800 text-emerald-200'
            }`}>
              {analyzeMessage.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 text-sm">
                <h3 className="font-bold">{analyzeMessage.type === 'error' ? 'エラー' : '完了'}</h3>
                <p className="mt-1 opacity-90">{analyzeMessage.text}</p>
                <button onClick={() => setAnalyzeMessage({type: null, text: null})} className="mt-2 text-xs underline opacity-70">閉じる</button>
              </div>
            </div>
          </div>
        )}

        {/* コンテンツエリア (スクロール可能) */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {activeView === 'dashboard' && (
            <>
              <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                <LayoutDashboard className="w-5 h-5 mr-2 text-emerald-500" />
                最近のノート
              </h2>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
                  <p className="text-sm">読み込み中...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {notes.map(note => (
                    <div key={note.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/40 hover:bg-slate-800/40 transition-all cursor-pointer group flex flex-col min-h-[160px] h-full shadow-md">
                      <div className="flex justify-between items-start mb-3 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                          {note.subject}
                        </span>
                        <MoreVertical className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                      <h3 className="text-base font-bold text-slate-100 mb-2 group-hover:text-emerald-400 transition-colors">
                        {note.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4 overflow-hidden">
                        {note.preview}
                      </p>
                      <div className="mt-auto pt-4 border-t border-slate-800/50 flex flex-col space-y-3 shrink-0">
                        <div className="flex items-center text-[10px] text-slate-500">
                          <Clock className="w-3 h-3 mr-1.5" />
                          {note.date}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {note.tags?.map((tag, idx) => (
                            <span key={idx} className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeView === 'notes' && (
            <div className="max-w-4xl mx-auto py-10 text-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">マイノート</h2>
              <p className="text-slate-400 mb-8">保存したすべてのノートを管理できます。科目や日付でフィルタリングする機能を準備中です。</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                {['情報工学', '数学', '物理', '英語'].map(sub => (
                  <div key={sub} className="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-emerald-500/30 transition-colors flex items-center justify-between cursor-pointer">
                    <span className="font-medium">{sub}</span>
                    <span className="text-xs text-slate-500">12 記事</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'archive' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-emerald-500" />
                資料アーカイブ
              </h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-slate-400 font-medium">
                    <tr>
                      <th className="px-6 py-4">ファイル名</th>
                      <th className="px-6 py-4">科目</th>
                      <th className="px-6 py-4">種類</th>
                      <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[
                      { name: 'R5年度_線形代数_中間試験.pdf', sub: '数学', type: '過去問' },
                      { name: '信号処理_講義スライド_04.pptx', sub: '専門', type: '資料' },
                      { name: 'TOEIC_単語リスト_2025.xlsx', sub: '英語', type: '演習' },
                    ].map((file, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-200">{file.name}</td>
                        <td className="px-6 py-4 text-slate-400">{file.sub}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">{file.type}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-emerald-500 hover:text-emerald-400 p-1">
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center">
                <CalendarIcon className="w-5 h-5 mr-2 text-emerald-500" />
                課題カレンダー
              </h2>
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                  <div key={day} className="bg-slate-900 py-3 text-center text-xs font-bold text-slate-500 uppercase">{day}</div>
                ))}
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="bg-slate-900 min-h-[100px] p-2 hover:bg-slate-800/40 transition-colors relative">
                    <span className="text-[10px] text-slate-600 font-mono">{(i % 31) + 1}</span>
                    {i === 15 && <div className="mt-1 p-1 bg-red-500/10 border-l-2 border-red-500 text-[9px] text-red-400 truncate">実験レポート締切</div>}
                    {i === 18 && <div className="mt-1 p-1 bg-emerald-500/10 border-l-2 border-emerald-500 text-[9px] text-emerald-400 truncate">数学小テスト</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右サイドバー (AI Chat) */}
      <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col hidden lg:flex shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-slate-800 bg-slate-900">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mr-3">
            <BrainCircuit className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-sm">KOSEN AI</h2>
            <p className="text-[10px] text-emerald-400 flex items-center">
              <span className="w-1 h-1 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
              オンライン
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 leading-relaxed shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-sm' 
                  : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              type="text" 
              value={chatInput} 
              onChange={(e) => setChatInput(e.target.value)} 
              placeholder="質問する..." 
              className="w-full bg-slate-800 border border-slate-700 text-xs rounded-full pl-4 pr-10 py-2.5 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600 shadow-inner" 
            />
            <button type="submit" className="absolute right-1.5 top-1.5 p-1.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 transition-colors shadow-lg">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          <p className="text-[10px] text-slate-600 text-center mt-3">Gemini 2.5 Flash 解析中</p>
        </div>
      </aside>

    </div>
  );
}