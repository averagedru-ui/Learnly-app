import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  Trash2, ChevronLeft, ChevronRight, BrainCircuit, GraduationCap, 
  RefreshCw, X, Plus, Upload, LayoutGrid, CheckCircle2, 
  RotateCcw, Info, Check, ChevronUp, ChevronDown, 
  User, Home, BookOpen, Settings, Edit3, Target, AlertCircle,
  Image as ImageIcon, Mail, Lock, LogOut, FlaskConical
} from 'lucide-react';

// ==========================================
// VERSION TAG 
// ==========================================
const APP_VERSION = "1.1.4";

// ==========================================
// FIREBASE CONFIG
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDXSozkHRE0Agg9-uNmrxGAWiU9MtsaS-c",
  authDomain: "learnly-bb0da.firebaseapp.com",
  projectId: "learnly-bb0da",
  storageBucket: "learnly-bb0da.firebasestorage.app",
  messagingSenderId: "77667151804",
  appId: "1:77667151804:web:374ab4a0961d1af18f85b9"
};

const appId = "learnly-v1"; 
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ displayName: 'Student' });
  const [sets, setSets] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [status, setStatus] = useState('loading'); 
  const [syncing, setSyncing] = useState(false);

  // Navigation & UI State
  const [view, setView] = useState('dashboard'); 
  const [activeTab, setActiveTab] = useState('flashcards'); 
  const [activeSetId, setActiveSetId] = useState(null);
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);

  // MOBILE IMAGE FIXER
  const fixImageUrl = (url) => {
    if (!url) return '';
    let link = url.trim();
    if (link.includes('imgur.com')) {
      let id = '';
      if (link.includes('#')) id = link.split('#').pop();
      else if (link.includes('/a/')) id = link.split('/a/').pop().split(/[?#]/)[0];
      else if (link.includes('/gallery/')) id = link.split('/gallery/').pop().split(/[?#]/)[0];
      else id = link.split('/').pop().split(/[.#?]/)[0];
      if (id && id.length > 3) return `https://i.imgur.com/${id}.png`;
    }
    return link.startsWith('http://') ? link.replace('http://', 'https://') : link;
  };

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setStatus('ready');
      if (!u) setView('dashboard');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) setProfile(docSnap.data());
      else setProfile({ displayName: user.isAnonymous ? 'Guest' : 'Student' });
    });
    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    const unsubscribeSets = onSnapshot(setsPath, (snapshot) => {
      setSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const historyPath = collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory');
    const unsubscribeHistory = onSnapshot(historyPath, (snapshot) => {
      setHistoryData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
    });
    return () => { unsubscribeProfile(); unsubscribeSets(); unsubscribeHistory(); };
  }, [user]);

  const activeSet = useMemo(() => sets.find(s => s.id === activeSetId) || null, [sets, activeSetId]);

  const filteredSets = useMemo(() => {
    return (sets || [])
      .filter(s => s?.type === activeTab)
      .sort((a, b) => (a?.orderIndex || 0) - (b?.orderIndex || 0));
  }, [sets, activeTab]);

  const stats = useMemo(() => {
    const sList = sets || [];
    const hList = historyData || [];
    const totalItems = sList.reduce((acc, set) => acc + (set?.items?.length || 0), 0);
    const avg = hList.length > 0 ? Math.round((hList.reduce((a, b) => a + (b.score / b.total), 0) / hList.length) * 100) : 0;
    return { flashcards: sList.filter(s => s.type === 'flashcards').length, exams: sList.filter(s => s.type === 'quizzes').length, totalItems, avg };
  }, [sets, historyData]);

  const handleAuth = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'info'), { 
          displayName: fullName || 'Student', email, createdAt: Date.now() 
        });
      }
      setView('dashboard');
    } catch (err) { setAuthError(err.message.replace('Firebase: ', '')); }
  };

  const handleGuestEntry = async () => {
    setAuthError('');
    try {
      await signInAnonymously(auth);
      setView('dashboard');
    } catch (err) { setAuthError(err.message); }
  };

  const handleSave = async (op) => {
    if (!user) return;
    setSyncing(true);
    try { await op(); } catch (e) { console.error(e); }
    finally { setTimeout(() => setSyncing(false), 600); }
  };

  const updateSet = (id, data) => handleSave(async () => {
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', id), { ...data, updatedAt: Date.now() });
  });

  const createSet = (type) => handleSave(async () => {
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'studySets'), { 
      title: type === 'flashcards' ? 'New Deck' : 'New Exam', 
      type, items: [], 
      orderIndex: sets.filter(s => s.type === type).length, 
      updatedAt: Date.now() 
    });
    setActiveSetId(docRef.id); setActiveTab(type); setView('edit');
  });

  const startQuiz = () => {
    if (!activeSet?.items?.length) return;
    setQuizQuestions([...activeSet.items].sort(() => 0.5 - Math.random()));
    setQuizAnswers({}); setQuizResults(null); setView('quiz');
  };

  const finishQuiz = async () => {
    let score = 0; const missed = [], missedIds = [];
    quizQuestions.forEach(q => {
      if (quizAnswers[q.id] === q.correctAnswer) score++;
      else { missedIds.push(q.id); missed.push({ q: (q.question || q.term), user: quizAnswers[q.id], correct: q.correctAnswer, options: q.options, imageUrl: q.imageUrl }); }
    });
    const finalPercent = Math.round((score / quizQuestions.length) * 100);
    setQuizResults({ score, total: quizQuestions.length, missed, missedIds });
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory'), { setId: activeSetId, setTitle: activeSet.title, score, total: quizQuestions.length, timestamp: Date.now() });
    updateSet(activeSetId, { lastScore: finalPercent });
  };

  if (status === 'loading') return <div className="h-screen flex items-center justify-center bg-white"><RefreshCw className="animate-spin text-indigo-600" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-full max-w-md bg-white p-10 rounded-[3.5rem] shadow-2xl border">
        <BrainCircuit className="mx-auto text-indigo-600 mb-6" size={48} />
        <h1 className="text-2xl font-black mb-8 uppercase tracking-tight">Learnly Pro</h1>

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && <input type="text" placeholder="Full Name" onChange={e => setFullName(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />}
          <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
          <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
          {authError && <div className="text-rose-500 text-[10px] font-black uppercase text-center">{authError}</div>}
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl tracking-widest active:scale-95 transition-all">{authMode === 'login' ? 'Sign In' : 'Sign Up'}</button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-slate-100"></div>
          <span className="px-4 text-[9px] font-black uppercase text-slate-300">Or</span>
          <div className="flex-1 h-px bg-slate-100"></div>
        </div>

        <button onClick={handleGuestEntry} className="w-full bg-white border-2 border-slate-100 text-slate-400 py-4 rounded-3xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 mb-4">
          <FlaskConical size={14} className="text-indigo-400"/> Enter as Guest
        </button>

        <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-indigo-600 font-black text-[10px] uppercase underline block mx-auto">
          {authMode === 'login' ? "Need an account? Sign Up" : "Already a member? Login"}
        </button>

        <div className="mt-10 text-[8px] font-black text-slate-200 tracking-[0.3em] uppercase">Build {APP_VERSION}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans selection:bg-indigo-100">
      <nav className="bg-white border-b px-6 h-20 flex items-center justify-between sticky top-0 z-50">
        <span className="font-black text-2xl tracking-tighter cursor-pointer" onClick={() => setView('dashboard')}>LEARNLY</span>
        <div className="flex items-center gap-4">
          {syncing && <RefreshCw className="animate-spin text-indigo-500" size={16} />}
          <div onClick={() => setView('profile')} className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 cursor-pointer shadow-inner"><User size={20} /></div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8"><h1 className="text-3xl font-black uppercase tracking-tight">Your Classroom</h1></header>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 text-center">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.flashcards + stats.exams}</div><div className="text-[10px] font-black uppercase text-slate-300">Sets</div></div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.totalItems}</div><div className="text-[10px] font-black uppercase text-slate-300">Items</div></div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.avg}%</div><div className="text-[10px] font-black uppercase text-slate-300">Avg Score</div></div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{historyData.length}</div><div className="text-[10px] font-black uppercase text-slate-300">Tests</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div onClick={() => { setActiveTab('flashcards'); setView('library'); }} className="bg-white p-12 rounded-[3.5rem] shadow-sm hover:shadow-xl cursor-pointer text-center group border border-slate-100">
                <BookOpen size={48} className="mx-auto mb-4 text-indigo-600 group-hover:scale-110 transition-transform" /><h2 className="text-2xl font-black uppercase">Flashcards</h2>
              </div>
              <div onClick={() => { setActiveTab('quizzes'); setView('library'); }} className="bg-white p-12 rounded-[3.5rem] shadow-sm hover:shadow-xl cursor-pointer text-center group border border-slate-100">
                <GraduationCap size={48} className="mx-auto mb-4 text-emerald-600 group-hover:scale-110 transition-transform" /><h2 className="text-2xl font-black uppercase">Exams</h2>
              </div>
            </div>
          </div>
        )}

        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <header className="flex justify-between items-center mb-10">
              <button onClick={() => setView('dashboard')} className="font-black text-xs uppercase text-slate-400">← Back</button>
              <button onClick={() => createSet(activeTab)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl">+ New Set</button>
            </header>
            <h2 className="text-3xl font-black mb-8 uppercase tracking-tight">{activeTab}</h2>
            <div className="space-y-4">
              {filteredSets.map(set => (
                <div key={set.id} onClick={() => { setActiveSetId(set.id); setCurrentCardIndex(0); setIsFlipped(false); setView(activeTab === 'flashcards' ? 'study' : 'quiz-ready'); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 flex justify-between items-center cursor-pointer hover:border-indigo-100 transition-all relative overflow-hidden">
                  {set.lastScore !== undefined && (
                    <div className="absolute bottom-0 left-0 h-1.5 bg-indigo-500/20" style={{ width: '100%' }}>
                      <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${set.lastScore}%` }}></div>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-black">{set.title}</h3>
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] font-bold text-slate-300 uppercase">{set.items?.length || 0} Items</p>
                      {set.lastScore !== undefined && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${set.lastScore >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          Recent: {set.lastScore}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setActiveSetId(set.id); setView('edit'); }} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><Edit3 size={18}/></button>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', set.id))} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'study' && activeSet && (
          <div className="animate-in fade-in max-w-lg mx-auto py-10">
            <header className="flex justify-between items-center mb-10">
              <button onClick={() => setView('library')} className="font-black text-xs uppercase text-slate-400">← Back</button>
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{currentCardIndex + 1} / {activeSet.items.length}</span>
            </header>
            <div className="perspective-1000 w-full h-[450px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 bg-white rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-12 backface-hidden border border-slate-100">
                  {activeSet.items[currentCardIndex]?.imageUrl && (
                    <img src={activeSet.items[currentCardIndex].imageUrl} referrerPolicy="no-referrer" className="max-h-40 mb-8 rounded-2xl object-contain" alt="Diagram" />
                  )}
                  <h3 className="text-3xl font-black text-center leading-tight uppercase tracking-tighter">{activeSet.items[currentCardIndex]?.term || activeSet.items[currentCardIndex]?.question}</h3>
                  <div className="mt-10 text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Tap to flip</div>
                </div>
                <div className="absolute inset-0 bg-indigo-600 rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-12 backface-hidden rotate-y-180 text-white">
                  <p className="text-xl font-bold text-center leading-relaxed">{activeSet.items[currentCardIndex]?.definition || activeSet.items[currentCardIndex]?.correctAnswer?.toUpperCase()}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-12 gap-4">
              <button disabled={currentCardIndex === 0} onClick={() => { setCurrentCardIndex(currentCardIndex - 1); setIsFlipped(false); }} className="flex-1 bg-white p-6 rounded-3xl border shadow-sm font-black uppercase text-xs disabled:opacity-20 flex items-center justify-center gap-2"><ChevronLeft size={18}/> Prev</button>
              <button disabled={currentCardIndex === activeSet.items.length - 1} onClick={() => { setCurrentCardIndex(currentCardIndex + 1); setIsFlipped(false); }} className="flex-1 bg-indigo-600 text-white p-6 rounded-3xl shadow-xl font-black uppercase text-xs disabled:opacity-20 flex items-center justify-center gap-2">Next <ChevronRight size={18}/></button>
            </div>
          </div>
        )}

        {view === 'quiz-ready' && activeSet && (
          <div className="max-w-md mx-auto py-10 animate-in zoom-in-95 text-center">
             <div className="bg-white p-14 rounded-[4rem] shadow-2xl border relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-3 bg-indigo-600"></div>
                <GraduationCap className="mx-auto text-indigo-600 mb-8" size={72} />
                <h2 className="text-3xl font-black mb-2 uppercase">{activeSet.title}</h2>
                <p className="text-slate-400 mb-12 font-bold uppercase text-[10px] tracking-widest">{activeSet.items?.length || 0} Questions</p>
                {activeSet.lastScore !== undefined && <div className="mb-8 p-4 bg-slate-50 rounded-3xl"><p className="text-[10px] font-black uppercase text-slate-300 mb-1">Last Score</p><p className="text-2xl font-black text-indigo-600">{activeSet.lastScore}%</p></div>}
                <button onClick={startQuiz} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Start Exam</button>
             </div>
          </div>
        )}

        {view === 'quiz' && activeSet && (
          <div className="animate-in fade-in duration-300 space-y-8 pb-32">
            {!quizResults ? (
              <>
                <header className="flex justify-between items-center sticky top-20 bg-slate-50/90 py-4 z-50 backdrop-blur-md px-2"><button onClick={() => setView('library')} className="font-black text-xs text-slate-400">← Quit</button><span className="text-[10px] font-black text-indigo-600 tracking-widest">Session: {Object.keys(quizAnswers).length} / {quizQuestions.length}</span></header>
                {quizQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-50">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6 block border-b pb-4">Question {i+1}</span>
                    {q.imageUrl && <div className="mb-10 bg-slate-50 p-6 rounded-[2.5rem] flex items-center justify-center min-h-[250px] border shadow-inner"><img src={q.imageUrl} referrerPolicy="no-referrer" className="w-full h-auto object-contain max-h-[400px] rounded-xl" alt="Exam Diagram" /></div>}
                    <p className="text-2xl font-black mb-10 leading-snug">{q.question}</p>
                    <div className="grid grid-cols-1 gap-4">
                      {['a', 'b', 'c', 'd'].map(key => (
                        <button key={key} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: key})} className={`p-6 rounded-3xl text-left border-2 flex items-center gap-5 transition-all ${quizAnswers[q.id] === key ? 'border-indigo-600 bg-indigo-50 shadow-inner' : 'border-slate-50 bg-white hover:border-slate-200'}`}><span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${quizAnswers[q.id] === key ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{key.toUpperCase()}</span><span className={`font-bold ${quizAnswers[q.id] === key ? 'text-indigo-900' : 'text-slate-600'}`}>{q.options?.[key]}</span></button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={finishQuiz} className="w-full bg-indigo-600 text-white py-8 rounded-[3.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all">Submit Session</button>
              </>
            ) : (
              <div className="animate-in zoom-in-95 text-center py-6">
                <div className="bg-white p-16 rounded-[4rem] shadow-2xl mb-10 relative overflow-hidden border">
                  <div className={`absolute top-0 left-0 right-0 h-4 ${quizResults.score / quizResults.total >= 0.7 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <div className="text-6xl font-black text-indigo-600 mb-4">{Math.round((quizResults.score / quizResults.total) * 100)}%</div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-10">{quizResults.score} / {quizResults.total} Correct</h3>
                  <button onClick={() => setView('dashboard')} className="bg-slate-100 px-12 py-5 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Back to Home</button>
                </div>
                {quizResults.missed.map((m, i) => (
                  <div key={i} className="bg-white p-10 rounded-[3.5rem] shadow-sm border-l-[16px] border-rose-500 text-left mb-6 overflow-hidden">
                    {m.imageUrl && <img src={m.imageUrl} referrerPolicy="no-referrer" className="max-h-60 mb-8 object-contain rounded-2xl border" alt="Diagram" />}
                    <p className="font-black text-xl mb-8 leading-snug">{m.q}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-rose-50 p-6 rounded-3xl text-rose-700 font-bold">Picked: {m.user?.toUpperCase()}: {m.options?.[m.user]}</div>
                      <div className="bg-emerald-50 p-6 rounded-3xl text-emerald-700 font-bold">Correct: {m.correct?.toUpperCase()}: {m.options?.[m.correct]}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'edit' && activeSet && (
          <div className="animate-in fade-in pb-24">
            <header className="flex justify-between items-center mb-8 sticky top-20 bg-slate-50/90 py-4 z-40 backdrop-blur-md">
              <button onClick={() => setView('library')} className="font-black text-xs uppercase text-slate-400">← Exit</button>
              <button onClick={() => setView('library')} className="bg-indigo-600 text-white px-8 py-2 rounded-2xl font-black text-[10px] uppercase shadow-xl">Done</button>
            </header>
            <input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-4xl font-black bg-transparent outline-none mb-10 uppercase border-b-4 pb-4 focus:border-indigo-500" />
            <div className="space-y-6">
              {activeSet.items?.map((item, i) => (
                <div key={i} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-50 space-y-4">
                  <div className="flex justify-between items-center"><span className="text-xs font-black text-indigo-500 uppercase tracking-widest">Item {i+1}</span><button onClick={() => { const ni = activeSet.items.filter((_, idx) => idx !== i); updateSet(activeSetId, {items:ni}); }} className="text-slate-200 hover:text-rose-500"><Trash2 size={20}/></button></div>
                  <textarea value={item.question || item.term} onChange={e => { const ni = [...activeSet.items]; if(activeTab === 'flashcards') ni[i].term = e.target.value; else ni[i].question = e.target.value; updateSet(activeSetId, {items:ni}); }} className="w-full bg-slate-50 p-6 rounded-3xl font-bold outline-none h-32 border-2 border-transparent" placeholder="Text..." />
                  {activeTab === 'flashcards' && <textarea value={item.definition} onChange={e => { const ni = [...activeSet.items]; ni[i].definition = e.target.value; updateSet(activeSetId, {items:ni}); }} className="w-full bg-slate-50 p-6 rounded-3xl font-bold outline-none h-32 border-2 border-transparent" placeholder="Back side text..." />}
                  {activeTab === 'quizzes' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{['a','b','c','d'].map(k => (<div key={k} className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border"><button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = k; updateSet(activeSetId, {items:ni}); }} className={`w-10 h-10 rounded-xl font-black uppercase text-xs transition-all ${item.correctAnswer === k ? 'bg-indigo-600 text-white' : 'bg-white text-slate-300'}`}>{k}</button><input value={item.options?.[k] || ''} onChange={e => { const ni = [...activeSet.items]; const opt = {...ni[i].options}; opt[k] = e.target.value; ni[i].options = opt; updateSet(activeSetId, {items:ni}); }} className="bg-transparent outline-none font-bold text-sm flex-1" placeholder={`Option ${k.toUpperCase()}`} /></div>))}</div>}
                  <input value={item.imageUrl || ''} placeholder="Imgur Link" onChange={e => { const ni = [...activeSet.items]; ni[i].imageUrl = fixImageUrl(e.target.value); updateSet(activeSetId, {items:ni}); }} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black outline-none uppercase tracking-widest" />
                  {item.imageUrl && <img src={item.imageUrl} referrerPolicy="no-referrer" className="w-32 h-32 object-contain rounded-3xl border bg-slate-50" />}
                </div>
              ))}
              <button onClick={() => updateSet(activeSetId, { items: [...(activeSet.items||[]), { term: '', definition: '', question: '', imageUrl: '', options: {a:'',b:'',c:'',d:''}, correctAnswer: 'a' }] })} className="w-full py-20 border-4 border-dashed rounded-[4rem] text-slate-200 font-black uppercase text-xs tracking-widest hover:border-indigo-200 hover:text-indigo-500 transition-all">+ Add Item</button>
            </div>
          </div>
        )}

        {view === 'profile' && (
          <div className="max-w-md mx-auto py-20 animate-in zoom-in-95">
            <div className="bg-white p-16 rounded-[4rem] shadow-2xl text-center border relative overflow-hidden">
              <User size={64} className="mx-auto mb-4 text-indigo-600" />
              <h2 className="text-3xl font-black mb-10 uppercase tracking-tighter">{profile.displayName || 'Student'}</h2>
              <button onClick={() => signOut(auth)} className="w-full bg-rose-50 text-rose-600 py-6 rounded-3xl font-black uppercase text-xs tracking-widest border border-rose-100 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"><LogOut size={16}/> Sign Out</button>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-6 flex justify-around items-center z-50">
        <Home onClick={() => setView('dashboard')} className={`cursor-pointer transition-all ${view === 'dashboard' ? 'text-indigo-600 scale-125' : 'text-slate-200'}`} />
        <LayoutGrid onClick={() => { setActiveTab('flashcards'); setView('library'); }} className={`cursor-pointer transition-all ${view === 'library' && activeTab === 'flashcards' ? 'text-indigo-600 scale-125' : 'text-slate-200'}`} />
        <GraduationCap onClick={() => { setActiveTab('quizzes'); setView('library'); }} className={`cursor-pointer transition-all ${view === 'library' && activeTab === 'quizzes' ? 'text-indigo-600 scale-125' : 'text-slate-200'}`} />
        <User onClick={() => setView('profile')} className={`cursor-pointer transition-all ${view === 'profile' ? 'text-indigo-600 scale-125' : 'text-slate-200'}`} />
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}

