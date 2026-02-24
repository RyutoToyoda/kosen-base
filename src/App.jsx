import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Settings, 
  Send, 
  LayoutDashboard, 
  FileText, 
  Calendar,
  MoreVertical, 
  BrainCircuit,
  GraduationCap,
  Loader2,
  ImagePlus,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

/**
 * =========================================================================
 * 【重要：Vercelデプロイ・ローカル実行時の修正手順】
 * * 1. このプレビュー環境でのエラーを避けるため、以下の import はコメントアウトされています。
 * ローカル環境（VSCode等）では、先頭の「//」を消して有効にしてください。
 * =========================================================================
 */
import { supabase } from './supabaseClient';



// AIチャットの初期メッセージ
const INITIAL_CHAT = [
  { id: 1, sender: 'ai', text: 'こんにちは！KOSEN-base AIアシスタントです。ノートの画像解析や、授業内容の質問など、何でも聞いてください。' }
];

export default function App() {
  // --- 状態管理 ---
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState({ type: null, text: null });
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  
  const fileInputRef = useRef(null);

  // --- 環境変数（Gemini APIキー）の取得 ---
  const getGeminiKey = () => {
    try {
      return (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
    } catch (e) {
      return '';
    }
  };

  // --- データの取得 (Supabase) ---
  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      if (data) setNotes(data);
    } catch (err) {
      console.error("データ取得エラー:", err.message);
      setAnalyzeMessage({ type: 'error', text: `ノートの取得に失敗しました: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // --- 画像解析と保存のメイン処理 ---
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAnalyzeMessage({ type: null, text: null });

    try {
      // 1. 画像をBase64に変換
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      const geminiKey = getGeminiKey();
      
      let parsedData;
      if (geminiKey) {
        // 本物のAPIキーがある場合の処理
        const targetModel = "gemini-2.5-flash"; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiKey}`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "提供された画像から学習ノートの情報を抽出し、以下のJSON形式で返してください。純粋なJSONオブジェクトのみを返してください。Markdownの装飾や解説は一切不要です。\n{\n  \"title\": \"ノートのタイトル\",\n  \"subject\": \"科目名(数学, 物理, 情報など)\",\n  \"preview\": \"内容の要約(100文字程度)\",\n  \"tags\": [\"タグ1\", \"タグ2\"]\n}" },
                { inlineData: { mimeType: file.type, data: base64Data } }
              ]
            }]
          })
        });

        if (!response.ok) {
          const errorDetail = await response.text();
          throw new Error(`APIリクエスト失敗: ${response.status}`);
        }

        const result = await response.json();
        let aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(aiText);
      } else {
        // プレビュー環境（APIキーなし）での擬似動作
        await new Promise(r => setTimeout(r, 1500));
        parsedData = {
          title: "解析サンプル (プレビューモード)",
          subject: "デモ",
          preview: "Vercelの環境変数にAPIキーを設定すると、ここに実際の画像解析結果が表示されます。",
          tags: ["デモ", "Gemini 2.5"]
        };
      }

      // 3. Supabaseにデータを保存
      const newEntry = {
        ...parsedData,
        date: new Date().toISOString().split('T')[0]
      };

      const { error: insertError } = await supabase.from('notes').insert([newEntry]);
      if (insertError) throw insertError;

      await fetchNotes();
      setAnalyzeMessage({ type: 'success', text: '正常に処理されました。' });
      setTimeout(() => setAnalyzeMessage({ type: null, text: null }), 5000);

    } catch (err) {
      console.error("解析エラー:", err);
      setAnalyzeMessage({ type: 'error', text: `エラーが発生しました: ${err.message}` });
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
      const aiReply = { id: Date.now() + 1, sender: 'ai', text: 'AIチャット機能は次のアップデートで実装されます！' };
      setChatMessages(prev => [...prev, aiReply]);
    }, 1000);
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* サイドバー */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <GraduationCap className="w-8 h-8 text-emerald-500 mr-3" />
          <h1 className="text-xl font-bold text-white tracking-wider">KOSEN-base</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          <a href="#" className="flex items-center px-4 py-3 bg-slate-800 text-emerald-400 rounded-lg">
            <LayoutDashboard className="w-5 h-5 mr-3" />
            <span className="font-medium">ダッシュボード</span>
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 rounded-lg transition-colors">
            <BookOpen className="w-5 h-5 mr-3" />
            <span className="font-medium">マイノート</span>
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 rounded-lg transition-colors">
            <FileText className="w-5 h-5 mr-3" />
            <span className="font-medium">過去問・資料</span>
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 rounded-lg transition-colors">
            <Calendar className="w-5 h-5 mr-3" />
            <span className="font-medium">カレンダー</span>
          </a>
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          v1.0.0 Production Build
        </div>
      </aside>

      {/* メイン */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10">
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="ノートを検索..." 
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>
          
          <div className="ml-4 flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready</span>
            </div>

            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="flex items-center bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 mr-2 animate-spin text-emerald-500" /> : <ImagePlus className="w-5 h-5 mr-2 text-emerald-500" />}
              {isAnalyzing ? '解析中...' : '画像から追加'}
            </button>
            <button className="flex items-center bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <Plus className="w-5 h-5 mr-1" />
              新規
            </button>
          </div>
        </header>
        
        {/* メッセージ表示 */}
        {analyzeMessage.text && (
          <div className="px-6 pt-4 animate-in slide-in-from-top duration-300">
            <div className={`border px-4 py-3 rounded-lg flex items-start space-x-3 ${
              analyzeMessage.type === 'error' ? 'bg-red-900/30 border-red-800 text-red-200' : 'bg-emerald-900/30 border-emerald-800 text-emerald-200'
            }`}>
              {analyzeMessage.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <h3 className="font-bold text-sm">{analyzeMessage.type === 'error' ? 'エラー' : '完了'}</h3>
                <p className="text-xs mt-1">{analyzeMessage.text}</p>
                <button onClick={() => setAnalyzeMessage({type: null, text: null})} className="mt-2 text-xs underline opacity-70">閉じる</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <h2 className="text-2xl font-bold text-white mb-6">最近のノート</h2>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
              <p>読み込み中...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
              <p>ノートがありません。画像をアップロードしてみましょう！</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {notes.map(note => (
                <div key={note.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col h-48">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {note.subject}
                    </span>
                    <MoreVertical className="w-4 h-4 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                    {note.title}
                  </h3>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-auto">
                    {note.preview}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/50">
                    <span className="text-xs text-slate-500">{note.date}</span>
                    <div className="flex space-x-1">
                      {note.tags?.map((tag, idx) => (
                        <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
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
      </main>

      {/* AI チャット */}
      <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col hidden lg:flex">
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
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
              className="w-full bg-slate-800 border border-slate-700 text-sm text-slate-200 rounded-full pl-4 pr-10 py-2 focus:outline-none focus:border-emerald-500 transition-all"
            />
            <button type="submit" className="absolute right-1 top-1 p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </aside>

    </div>
  );
}