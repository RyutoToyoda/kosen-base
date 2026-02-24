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
  ChevronRight
} from 'lucide-react';

import { supabase } from './supabaseClient';

const INITIAL_CHAT = [
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIアシスタントです。ノートの解析や、学習の相談など、何でも聞いてください。' }
];

export default function App() {
  const [notes, setNotes] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState({ type: null, text: null });
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  
  const fileInputRef = useRef(null);

  // 環境変数を安全に取得（プレビュー環境でのエラー回避）
  const getGeminiKey = () => {
    try {
      // import.meta.env が存在するか確認し、VITE_GEMINI_API_KEY を取得
      const env = (import.meta && (import.meta as any).env) || {};
      return (env.VITE_GEMINI_API_KEY || '').trim();
    } catch (e) {
      return '';
    }
  };

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      // 注：プレビュー環境では常に空またはサンプルデータを返します
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setNotes(data);
      } else {
        // サンプルデータ
        setNotes([
          { 
            id: 1, 
            title: "線形代数 第3回 行列式の計算：サラスの公式と余因子展開", 
            subject: "数学", 
            date: "2026-02-24", 
            preview: "3次正方行列の行列式を求める際のサラスの公式の適用手順。また、n次行列への拡張として重要な余因子展開のコツを詳しくまとめました。計算ミスに注意が必要です。", 
            tags: ["中間試験", "数学II"] 
          },
          { 
            id: 2, 
            title: "アルゴリズムとデータ構造：二分探索ツリーの実装", 
            subject: "情報", 
            date: "2026-02-22", 
            preview: "再帰を用いた探索アルゴリズム。最良ケースO(log n)と最悪ケースO(n)の違い、および平衡木の必要性について。C言語でのポインタ操作を含みます。", 
            tags: ["C言語", "演習"] 
          },
          { 
            id: 3, 
            title: "応用物理 剛体の力学：慣性モーメントの導出", 
            subject: "物理", 
            date: "2026-02-20", 
            preview: "円盤および棒の慣性モーメントを積分により導出する過程。平行軸の定理を用いることで、回転運動方程式を簡略化する手法について。レポート課題の図解も参照。", 
            tags: ["剛体", "レポート"] 
          }
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
        // プレビュー環境（APIキーなし）の場合はシミュレーションを行う
        await new Promise(r => setTimeout(r, 1500));
        setAnalyzeMessage({ type: 'success', text: 'プレビューモード：解析シミュレーションが完了しました（Vercelでは本物が動きます）。' });
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
                { text: "提供された画像から学習ノートの情報を抽出し、JSON形式で返してください。\n{\n  \"title\": \"ノートのタイトル\",\n  \"subject\": \"科目名\",\n  \"preview\": \"内容の要約(150文字程度)\",\n  \"tags\": [\"タグ1\", \"タグ2\"]\n}" },
                { inlineData: { mimeType: file.type, data: base64Data } }
              ]
            }]
          })
        });

        if (!response.ok) throw new Error(`APIエラー: ${response.status}`);
        const result = await response.json();
        let aiText = result.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(aiText);

        await supabase.from('notes').insert([{
          ...parsedData,
          date: new Date().toISOString().split('T')[0]
        }]);

        await fetchNotes();
        setAnalyzeMessage({ type: 'success', text: 'ノートの解析と保存が完了しました！' });
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
      setChatMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: 'チャット機能のGemini連携は近日実装予定です！' }]);
    }, 1000);
  };

  const menuItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'notes', label: 'マイノート', icon: BookOpen },
    { id: 'archive', label: '過去問・資料', icon: FileText },
    { id: 'calendar', label: 'カレンダー', icon: CalendarIcon },
  ];

  return (
    <div className="flex h-screen w-full bg-[#0a0f18] text-slate-200 font-sans overflow-hidden">
      
      {/* サイドバー */}
      <aside className="w-64 bg-[#0d1424] border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <GraduationCap className="w-8 h-8 text-emerald-500 mr-3" />
          <h1 className="text-xl font-bold text-white tracking-wider uppercase">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
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
          <button className="w-full flex items-center px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors group">
            <Settings className="w-4 h-4 mr-3 group-hover:rotate-45 transition-transform" />
            設定
          </button>
          <div className="mt-4 flex items-center px-2">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold mr-3 shadow-md border border-emerald-400/20">高</div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-100 truncate">高専 太郎</p>
              <p className="text-[10px] text-slate-500 font-mono tracking-tight text-emerald-500/80">3rd Grade / IT</p>
            </div>
          </div>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0f18] overflow-hidden relative">
        {/* ヘッダー */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-[#0d1424]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex-1 max-w-2xl">
            <div className="relative group">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder="ノートや過去問を検索..." 
                className="w-full bg-[#161f33] border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium"
              />
            </div>
          </div>
          
          <div className="ml-4 flex items-center space-x-3">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="flex items-center bg-[#161f33] hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm shadow-md"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-500" /> : <ImagePlus className="w-4 h-4 mr-2 text-emerald-500" />}
              {isAnalyzing ? '解析中...' : '画像を追加'}
            </button>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-900/20 text-sm flex items-center active:scale-95">
              <Plus className="w-4 h-4 mr-1" />
              新規
            </button>
          </div>
        </header>
        
        {/* 通知エリア */}
        {analyzeMessage.text && (
          <div className="px-6 pt-4 shrink-0 absolute top-16 left-0 right-0 z-20">
            <div className={`border px-4 py-3 rounded-lg flex items-start space-x-3 shadow-2xl animate-in slide-in-from-top duration-300 ${
              analyzeMessage.type === 'error' ? 'bg-red-950/90 border-red-800 text-red-200' : 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
            }`}>
              {analyzeMessage.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 text-sm font-medium">
                <h3 className="font-black text-[10px] uppercase tracking-widest mb-0.5">{analyzeMessage.type === 'error' ? 'ERROR' : 'SUCCESS'}</h3>
                <p className="opacity-90">{analyzeMessage.text}</p>
                <button onClick={() => setAnalyzeMessage({type: null, text: null})} className="mt-2 text-[10px] font-black uppercase tracking-widest hover:opacity-100 opacity-60 underline transition-opacity">閉じる</button>
              </div>
            </div>
          </div>
        )}

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {activeView === 'dashboard' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white flex items-center tracking-tight">
                  <LayoutDashboard className="w-6 h-6 mr-3 text-emerald-500" />
                  最近のノート
                </h2>
                <div className="text-sm text-slate-500 font-bold flex items-center hover:text-emerald-400 cursor-pointer transition-colors group">
                  すべて表示 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest opacity-50">Loading data...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {notes.map(note => (
                    <div key={note.id} className="bg-[#11192a] border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 hover:bg-[#162136] transition-all duration-300 cursor-pointer group flex flex-col shadow-xl min-h-[300px]">
                      <div className="flex justify-between items-start mb-4 shrink-0">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded bg-[#1e293b] text-emerald-400 border border-emerald-500/20 uppercase tracking-tighter shadow-sm">
                          {note.subject}
                        </span>
                        <button className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-600 hover:text-slate-200">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* テキストが途切れないように min-h と flex-1 を活用 */}
                      <div className="flex-1 mb-4 flex flex-col justify-start overflow-hidden">
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors leading-snug">
                          {note.title}
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed font-medium">
                          {note.preview}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-slate-800/50 flex flex-col gap-3 shrink-0">
                        <div className="flex items-center text-[10px] text-slate-500 font-mono font-bold tracking-tight">
                          <Clock className="w-3 h-3 mr-1.5 text-emerald-500/60" />
                          {note.date}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {note.tags?.map((tag, idx) => (
                            <span key={idx} className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#1e293b] text-slate-300 border border-slate-700/50 transition-colors hover:border-emerald-500/40">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'notes' && (
            <div className="max-w-5xl mx-auto py-12 animate-in slide-in-from-bottom duration-500 text-center">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-500/20">
                <BookOpen className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">マイノート</h2>
              <p className="text-slate-400 max-w-lg mx-auto font-medium mb-12">
                保存済みノートを科目別に一括管理します。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                {['情報工学', '数学', '物理', '英語'].map(sub => (
                  <div key={sub} className="p-6 bg-[#0d1424] border border-slate-800 rounded-2xl hover:border-emerald-500/40 hover:bg-[#162136] transition-all flex items-center justify-between cursor-pointer group shadow-lg">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mr-4 group-hover:bg-emerald-600 transition-colors shadow-md border border-slate-700">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-100 text-lg">{sub}</p>
                        <p className="text-[10px] text-slate-500 font-mono">12 Items</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'archive' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-2xl font-black text-white flex items-center mb-8">
                <FileText className="w-6 h-6 mr-3 text-emerald-500" />
                過去問・資料
              </h2>
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm font-medium">
                  <thead className="bg-[#11192a] text-slate-400 font-black uppercase tracking-widest text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-8 py-5">ファイル名</th>
                      <th className="px-8 py-5">科目</th>
                      <th className="px-8 py-5">カテゴリ</th>
                      <th className="px-8 py-5 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {[
                      { name: 'R5年度_線形代数_中間試験.pdf', sub: '数学', type: '過去問', color: 'text-red-400 bg-red-400/10' },
                      { name: '信号処理_第04回講義スライド.pptx', sub: '専門', type: '資料', color: 'text-blue-400 bg-blue-400/10' },
                      { name: 'TOEIC精選模試_解答解説.pdf', sub: '英語', type: '演習', color: 'text-emerald-400 bg-emerald-400/10' },
                    ].map((file, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-all group">
                        <td className="px-8 py-5 font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">{file.name}</td>
                        <td className="px-8 py-5 text-slate-400">{file.sub}</td>
                        <td className="px-8 py-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${file.color}`}>{file.type}</span>
                        </td>
                        <td className="px-8 py-5 text-right space-x-2">
                          <button className="text-slate-500 hover:text-emerald-400 transition-colors p-1.5"><Download className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="max-w-7xl mx-auto animate-in slide-in-from-top duration-500">
              <h2 className="text-2xl font-black text-white flex items-center mb-8 tracking-tight">
                <CalendarIcon className="w-6 h-6 mr-3 text-emerald-500" />
                予定カレンダー
              </h2>
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                  <div key={day} className="bg-[#11192a] py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">{day}</div>
                ))}
                {Array.from({ length: 35 }).map((_, i) => {
                  const dayNum = (i % 31) + 1;
                  return (
                    <div key={i} className="bg-[#0d1424] min-h-[120px] p-3 hover:bg-slate-800/40 transition-all duration-300 group relative">
                      <span className={`text-[11px] font-mono ${i === 15 ? 'text-white font-bold' : 'text-slate-700'} group-hover:text-slate-400 transition-colors`}>{dayNum}</span>
                      {i === 15 && (
                        <div className="mt-2 p-1 bg-red-500/15 border-l-2 border-red-500 rounded text-[9px] text-white font-bold truncate">物理実験レポ</div>
                      )}
                      {i === 18 && (
                        <div className="mt-2 p-1 bg-emerald-500/15 border-l-2 border-emerald-500 rounded text-[9px] text-white font-bold truncate">数学小テスト</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 右サイドバー (AI Chat) */}
      <aside className="w-80 bg-[#0d1424] border-l border-slate-800 flex flex-col hidden lg:flex shrink-0 shadow-2xl relative z-30">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-[#0d1424]">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center mr-4 border border-emerald-500/20">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-black text-slate-100 text-[11px] tracking-widest uppercase">KOSEN AI</h2>
            <div className="flex items-center mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Connected</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans scrollbar-hide">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in duration-300`}>
              <div className={`max-w-[90%] rounded-2xl p-4 leading-relaxed shadow-xl text-sm ${
                msg.sender === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none font-medium' 
                  : 'bg-[#161f33] text-slate-200 border border-slate-700/50 rounded-tl-none font-medium'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-800 bg-[#0d1424]">
          <form onSubmit={handleSendMessage} className="relative group">
            <input 
              type="text" 
              value={chatInput} 
              onChange={(e) => setChatInput(e.target.value)} 
              placeholder="AIに学習内容を質問..." 
              className="w-full bg-[#161f33] border border-slate-700 text-xs rounded-2xl pl-5 pr-12 py-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600 shadow-inner" 
            />
            <button type="submit" className="absolute right-2.5 top-2.5 p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-lg active:scale-90">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}