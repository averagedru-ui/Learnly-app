import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, setPersistence, browserLocalPersistence,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup
} from 'firebase/auth';
import {
  getFirestore, collection, doc, addDoc, updateDoc,
  deleteDoc, onSnapshot, setDoc
} from 'firebase/firestore';
import {
  Trash2, BrainCircuit, GraduationCap, RefreshCw,
  LayoutGrid, User, Home, BookOpen, Edit3, LogOut,
  FlaskConical, Upload, CheckCircle, XCircle
} from 'lucide-react';

const APP_VERSION = "1.2.0";

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

const OPTION_KEYS = ['a', 'b', 'c', 'd'];

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ displayName: 'Student' });
  const [sets, setSets] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [status, setStatus] = useState('loading');
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('flashcards');
  const [activeSetId, setActiveSetId] = useState(null);

  // Auth
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');

  // Profile edit
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  // Flashcard
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz — answers keyed by q._qid
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);

  // Bulk import
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');

  // ── Helpers ────────────────────────────────────────────────────
  const fixImageUrl = (url) => {
    if (!url) return '';
    let link = url.trim();
    if (link.includes('imgur.com')) {
      let id = link.includes('#') ? link.split('#').pop() : link.split('/').pop().split(/[.#?]/)[0];
      return `https://i.imgur.com/${id}.png`;
    }
    return link;
  };

  // ── Firebase ───────────────────────────────────────────────────
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setStatus('ready');
      if (!u) setView('dashboard');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    onSnapshot(profileRef, (snap) => {
      if (snap.exists()) setProfile(snap.data());
      else setProfile({ displayName: user.isAnonymous ? 'Guest' : 'Student' });
    });
    onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'studySets'), (snap) => {
      setSets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory'), (snap) => {
      setHistoryData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp - a.timestamp));
    });
  }, [user]);

  const activeSet = useMemo(() => sets.find(s => s.id === activeSetId) || null, [sets, activeSetId]);
  const filteredSets = useMemo(() =>
    (sets || []).filter(s => s?.type === activeTab).sort((a, b) => (a?.orderIndex || 0) - (b?.orderIndex || 0)),
    [sets, activeTab]);
  const stats = useMemo(() => {
    const sList = sets || [];
    const hList = historyData || [];
    const totalItems = sList.reduce((acc, s) => acc + (s?.items?.length || 0), 0);
    const avg = hList.length > 0
      ? Math.round((hList.reduce((a, b) => a + (b.score / b.total), 0) / hList.length) * 100) : 0;
    return { sets: sList.length, totalItems, avg, tests: hList.length };
  }, [sets, historyData]);

  // ── Auth ───────────────────────────────────────────────────────
  const handleAuth = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'info'),
          { displayName: fullName || 'Student', email, createdAt: Date.now() });
      }
      setView('dashboard');
    } catch (err) { setAuthError(err.message.replace('Firebase: ', '')); }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await setDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'info'),
        { displayName: cred.user.displayName || 'Student', email: cred.user.email, createdAt: Date.now() },
        { merge: true });
      setView('dashboard');
    } catch (err) { setAuthError(err.message.replace('Firebase: ', '')); }
  };

  const handleForgotPassword = async () => {
    if (!email) { setAuthError('Enter your email above first.'); return; }
    try { await sendPasswordResetEmail(auth, email); setAuthError('Reset email sent! Check your inbox.'); }
    catch (err) { setAuthError(err.message.replace('Firebase: ', '')); }
  };

  const handleGuestEntry = async () => {
    try { await signInAnonymously(auth); setView('dashboard'); }
    catch (err) { setAuthError(err.message); }
  };

  // ── Data ───────────────────────────────────────────────────────
  const handleSave = async (op) => {
    if (!user) return;
    setSyncing(true);
    try { await op(); } catch (e) { console.error(e); }
    finally { setTimeout(() => setSyncing(false), 600); }
  };

  const updateSet = (id, data) => handleSave(async () => {
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', id),
      { ...data, updatedAt: Date.now() });
  });

  // ── Bulk Import ────────────────────────────────────────────────
  const handleBulkImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n').filter(l => l.trim().length > 0);
    const newItems = lines.map(line => {
      if (activeTab === 'flashcards') {
        const parts = line.split(/\s*[:\-\t]\s*/);
        return { term: parts[0]?.trim() || '', definition: parts[1]?.trim() || '', question: '', imageUrl: '', options: { a: '', b: '', c: '', d: '' }, correctAnswer: 'a' };
      } else {
        const pipe = line.split('|').map(p => p.trim());
        if (pipe.length >= 5) {
          return { question: pipe[0], options: { a: pipe[1] || '', b: pipe[2] || '', c: pipe[3] || '', d: pipe[4] || '' }, correctAnswer: (pipe[5] || 'a').toLowerCase(), term: '', definition: '', imageUrl: '' };
        }
        const parts = line.split(/\s*[:\-\t]\s*/);
        return { question: parts[0]?.trim() || '', options: { a: parts[1]?.trim() || '', b: '', c: '', d: '' }, correctAnswer: 'a', term: '', definition: '', imageUrl: '' };
      }
    });
    updateSet(activeSetId, { items: [...(activeSet?.items || []), ...newItems] });
    setImportText('');
    setIsImporting(false);
  };

  // ── Quiz ───────────────────────────────────────────────────────
  const startQuiz = () => {
    const shuffled = [...activeSet.items].sort(() => 0.5 - Math.random()).map((q, i) => ({ ...q, _qid: q.id || `q_${i}_${Date.now()}` }));
    setQuizQuestions(shuffled);
    setQuizAnswers({});
    setQuizResults(null);
    setView('quiz');
  };

  const finishQuiz = async () => {
    let score = 0;
    const missed = [];
    quizQuestions.forEach(q => {
      const selected = quizAnswers[q._qid];
      const correct = q.correctAnswer?.toLowerCase();
      if (selected === correct) score++;
      else missed.push({ q: q.question || q.term, user: selected, correct, options: q.options, imageUrl: q.imageUrl });
    });
    const pct = Math.round((score / quizQuestions.length) * 100);
    setQuizResults({ score, total: quizQuestions.length, missed, pct });
    await handleSave(async () => {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory'),
        { setId: activeSetId, setTitle: activeSet.title, score, total: quizQuestions.length, timestamp: Date.now() });
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', activeSetId),
        { lastScore: pct, updatedAt: Date.now() });
    });
  };

  // ── Loading ────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div className="h-screen flex items-center justify-center bg-white">
      <RefreshCw className="animate-spin text-indigo-600" />
    </div>
  );

  // ── Auth Screen ────────────────────────────────────────────────
  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white p-10 rounded-[3.5rem] shadow-2xl border">
        <BrainCircuit className="mx-auto text-indigo-600 mb-6" size={48} />
        <h1 className="text-2xl font-black mb-8 uppercase tracking-tight">Learnly Pro</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" />
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">
            {authMode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
          {authMode === 'login' && (
            <button type="button" onClick={handleForgotPassword} className="w-full text-slate-400 font-black text-[10px] uppercase">
              Forgot Password?
            </button>
          )}
        </form>
        {authError && <p className="mt-4 text-rose-500 text-xs font-bold text-center">{authError}</p>}
        <button onClick={handleGuestEntry} className="mt-6 w-full text-slate-400 font-black text-[10px] uppercase flex items-center justify-center gap-2">
          <FlaskConical size={14} /> Enter as Guest
        </button>
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-slate-100" /><span className="text-[9px] font-black text-slate-300 uppercase">Or</span><div className="flex-1 h-px bg-slate-100" />
        </div>
        <button onClick={handleGoogleSignIn} className="w-full bg-white border-2 border-slate-100 py-4 rounded-3xl font-black text-xs uppercase flex items-center justify-center gap-3 hover:border-indigo-200 active:scale-95 transition-all">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="mt-8 text-indigo-600 font-black text-[10px] uppercase underline">
          {authMode === 'login' ? 'Sign Up' : 'Login'}
        </button>
        <div className="mt-10 text-[8px] font-black text-slate-200 tracking-[0.3em] uppercase">Build {APP_VERSION}</div>
      </div>
    </div>
  );

  // ── Main App ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans selection:bg-indigo-100">

      <nav className="bg-white border-b px-6 h-20 flex items-center justify-between sticky top-0 z-50">
        <span className="font-black text-2xl tracking-tighter cursor-pointer" onClick={() => setView('dashboard')}>LEARNLY</span>
        <div className="flex items-center gap-4">
          {syncing && <RefreshCw className="animate-spin text-indigo-400" size={16} />}
          <div onClick={() => setView('profile')} className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 cursor-pointer shadow-inner">
            <User size={20} />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">

        {/* ── DASHBOARD ── */}
        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8"><h1 className="text-3xl font-black uppercase">Your Classroom</h1></header>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.sets}</div><div className="text-[10px] font-black uppercase text-slate-300">Sets</div></div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.totalItems}</div><div className="text-[10px] font-black uppercase text-slate-300">Total Items</div></div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-emerald-500">{stats.avg}%</div><div className="text-[10px] font-black uppercase text-slate-300">Avg Score</div></div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.tests}</div><div className="text-[10px] font-black uppercase text-slate-300">Tests Taken</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div onClick={() => { setActiveTab('flashcards'); setView('library'); }} className="bg-white p-12 rounded-[3.5rem] border border-slate-100 text-center cursor-pointer group hover:shadow-xl transition-all">
                <BookOpen size={48} className="mx-auto mb-4 text-indigo-600 group-hover:scale-110 transition-transform" /><h2 className="text-2xl font-black uppercase">Flashcards</h2>
              </div>
              <div onClick={() => { setActiveTab('quizzes'); setView('library'); }} className="bg-white p-12 rounded-[3.5rem] border border-slate-100 text-center cursor-pointer group hover:shadow-xl transition-all">
                <GraduationCap size={48} className="mx-auto mb-4 text-emerald-600 group-hover:scale-110 transition-transform" /><h2 className="text-2xl font-black uppercase">Exams</h2>
              </div>
            </div>
          </div>
        )}

        {/* ── LIBRARY ── */}
        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <header className="flex justify-between items-center mb-10">
              <button onClick={() => setView('dashboard')} className="font-black text-xs uppercase text-slate-400">← Back</button>
              <button onClick={() => {
                handleSave(async () => {
                  const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'studySets'), { title: 'New Set', type: activeTab, items: [], updatedAt: Date.now() });
                  setActiveSetId(docRef.id); setView('edit');
                });
              }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl">+ New Set</button>
            </header>
            <div className="space-y-4">
              {filteredSets.length === 0 && (
                <div className="text-center py-20 text-slate-300 font-black uppercase text-xs">No sets yet — create one above</div>
              )}
              {filteredSets.map(set => (
                <div key={set.id}
                  onClick={() => { setActiveSetId(set.id); setCurrentCardIndex(0); setIsFlipped(false); setView(activeTab === 'flashcards' ? 'study' : 'quiz-ready'); }}
                  className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 flex justify-between items-center cursor-pointer relative overflow-hidden">
                  {set.lastScore !== undefined && <div className="absolute bottom-0 left-0 h-1.5 bg-indigo-500 transition-all" style={{ width: `${set.lastScore}%` }} />}
                  <div className="flex-1">
                    <h3 className="text-lg font-black">{set.title}</h3>
                    <p className="text-[10px] font-bold text-slate-300 uppercase">{set.items?.length || 0} Items</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {set.lastScore !== undefined && (
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${set.lastScore >= 80 ? 'bg-emerald-50 text-emerald-600' : set.lastScore >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500'}`}>
                        {set.lastScore}%
                      </span>
                    )}
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Edit3 size={18} onClick={() => { setActiveSetId(set.id); setView('edit'); }} className="text-slate-300 hover:text-indigo-600 cursor-pointer" />
                      <Trash2 size={18} onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', set.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EDITOR ── */}
        {view === 'edit' && activeSet && (
          <div className="animate-in fade-in pb-24">
            <header className="flex justify-between items-center mb-8 sticky top-20 bg-slate-50/90 py-4 z-40 backdrop-blur-md px-2">
              <button onClick={() => setView('library')} className="font-black text-xs uppercase text-slate-400">← Exit</button>
              <div className="flex gap-2">
                <button onClick={() => setIsImporting(true)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 transition-all">
                  <Upload size={14} /> Bulk
                </button>
                <button onClick={() => setView('library')} className="bg-indigo-600 text-white px-8 py-2 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Done</button>
              </div>
            </header>

            {/* Bulk Import Modal */}
            {isImporting && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-xl font-black uppercase mb-2">Bulk Import</h3>
                  {activeTab === 'flashcards' ? (
                    <p className="text-[10px] font-bold text-slate-400 mb-6 leading-relaxed">
                      One card per line:<br /><span className="text-indigo-500">Term : Definition</span>
                    </p>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-400 mb-6 leading-relaxed">
                      One question per line:<br />
                      <span className="text-indigo-500">Question | A | B | C | D | correct_letter</span><br />
                      <span className="text-slate-400">e.g. What is 2+2 | 3 | 4 | 5 | 6 | b</span>
                    </p>
                  )}
                  <textarea value={importText} onChange={e => setImportText(e.target.value)}
                    className="w-full h-48 bg-slate-50 rounded-3xl p-6 font-bold text-sm outline-none border-2 border-slate-50 focus:border-indigo-100 mb-6 resize-none"
                    placeholder={activeTab === 'flashcards' ? 'Mitosis : Cell division process\nPhotosynthesis : Converting light to energy' : 'Capital of France | London | Paris | Berlin | Rome | b'} />
                  <div className="flex gap-4">
                    <button onClick={() => { setIsImporting(false); setImportText(''); }} className="flex-1 py-4 font-black uppercase text-xs text-slate-400">Cancel</button>
                    <button onClick={handleBulkImport} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">Import</button>
                  </div>
                </div>
              </div>
            )}

            <input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })}
              className="w-full text-4xl font-black bg-transparent outline-none mb-10 uppercase border-b-4 pb-4 focus:border-indigo-500" />

            <div className="space-y-6">
              {activeSet.items?.map((item, i) => (
                <div key={i} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-50 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-indigo-500 uppercase tracking-widest">{activeTab === 'flashcards' ? `Card ${i + 1}` : `Question ${i + 1}`}</span>
                    <Trash2 size={16} onClick={() => updateSet(activeSetId, { items: activeSet.items.filter((_, idx) => idx !== i) })} className="text-slate-200 hover:text-rose-500 cursor-pointer" />
                  </div>

                  {activeTab === 'flashcards' && (
                    <>
                      <textarea value={item.term || ''} onChange={e => { const ni = [...activeSet.items]; ni[i] = { ...ni[i], term: e.target.value }; updateSet(activeSetId, { items: ni }); }}
                        className="w-full bg-slate-50 p-6 rounded-3xl font-bold outline-none h-24 border border-transparent focus:border-indigo-100 resize-none" placeholder="Term..." />
                      <textarea value={item.definition || ''} onChange={e => { const ni = [...activeSet.items]; ni[i] = { ...ni[i], definition: e.target.value }; updateSet(activeSetId, { items: ni }); }}
                        className="w-full bg-slate-50 p-6 rounded-3xl font-bold outline-none h-24 border border-transparent focus:border-indigo-100 resize-none" placeholder="Definition..." />
                    </>
                  )}

                  {activeTab === 'quizzes' && (
                    <>
                      <textarea value={item.question || ''} onChange={e => { const ni = [...activeSet.items]; ni[i] = { ...ni[i], question: e.target.value }; updateSet(activeSetId, { items: ni }); }}
                        className="w-full bg-slate-50 p-6 rounded-3xl font-bold outline-none h-24 border border-transparent focus:border-indigo-100 resize-none" placeholder="Question..." />
                      <div className="space-y-2">
                        {OPTION_KEYS.map(key => (
                          <div key={key} className="flex items-center gap-3">
                            <button onClick={() => { const ni = [...activeSet.items]; ni[i] = { ...ni[i], correctAnswer: key }; updateSet(activeSetId, { items: ni }); }}
                              className={`w-8 h-8 rounded-xl font-black text-xs flex-shrink-0 transition-all ${item.correctAnswer === key ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                              {key.toUpperCase()}
                            </button>
                            <input value={item.options?.[key] || ''} onChange={e => { const ni = [...activeSet.items]; ni[i] = { ...ni[i], options: { ...ni[i].options, [key]: e.target.value } }; updateSet(activeSetId, { items: ni }); }}
                              className="flex-1 bg-slate-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-indigo-100 text-sm" placeholder={`Option ${key.toUpperCase()}...`} />
                          </div>
                        ))}
                        <p className="text-[9px] font-black text-slate-300 uppercase pl-11">Tap letter to set correct answer</p>
                      </div>
                    </>
                  )}

                  <input value={item.imageUrl || ''} placeholder="Imgur Image Link (optional)"
                    onChange={e => { const ni = [...activeSet.items]; ni[i] = { ...ni[i], imageUrl: fixImageUrl(e.target.value) }; updateSet(activeSetId, { items: ni }); }}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black outline-none uppercase tracking-widest border border-transparent focus:border-indigo-100" />
                  {item.imageUrl && <img src={item.imageUrl} className="w-32 h-32 object-contain rounded-3xl border bg-slate-50" />}
                </div>
              ))}

              <button onClick={() => updateSet(activeSetId, { items: [...(activeSet.items || []), { term: '', definition: '', question: '', imageUrl: '', options: { a: '', b: '', c: '', d: '' }, correctAnswer: 'a' }] })}
                className="w-full py-20 border-4 border-dashed rounded-[4rem] text-slate-200 font-black uppercase text-xs tracking-widest hover:border-indigo-200 hover:text-indigo-500 transition-all">
                + Add Item
              </button>
            </div>
          </div>
        )}

        {/* ── FLASHCARD STUDY ── */}
        {view === 'study' && activeSet && (
          <div className="animate-in fade-in max-w-lg mx-auto py-10">
            <header className="flex justify-between items-center mb-10">
              <button onClick={() => setView('library')} className="font-black text-xs uppercase text-slate-400">← Exit</button>
              <span className="text-[10px] font-black text-indigo-600">{currentCardIndex + 1} / {activeSet.items.length}</span>
            </header>
            {activeSet.items.length === 0 ? (
              <div className="text-center py-20 text-slate-300 font-black uppercase text-xs">No cards in this set</div>
            ) : (
              <>
                <div className="perspective-1000 w-full h-[400px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                  <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                    <div className="absolute inset-0 bg-white rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-12 backface-hidden border border-slate-100">
                      {activeSet.items[currentCardIndex]?.imageUrl && (
                        <img src={activeSet.items[currentCardIndex].imageUrl} referrerPolicy="no-referrer" className="max-h-40 mb-6 object-contain rounded-2xl" />
                      )}
                      <h3 className="text-2xl font-black text-center uppercase">{activeSet.items[currentCardIndex]?.term}</h3>
                      <p className="text-[10px] font-black text-slate-300 uppercase mt-6">Tap to flip</p>
                    </div>
                    <div className="absolute inset-0 bg-indigo-600 rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-12 backface-hidden rotate-y-180 text-white">
                      <p className="text-xl font-bold text-center">{activeSet.items[currentCardIndex]?.definition}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between mt-12 gap-4">
                  <button disabled={currentCardIndex === 0} onClick={() => { setCurrentCardIndex(currentCardIndex - 1); setIsFlipped(false); }} className="flex-1 bg-white p-6 rounded-3xl border shadow-sm font-black uppercase text-xs disabled:opacity-30 active:scale-95 transition-all">Prev</button>
                  <button disabled={currentCardIndex === activeSet.items.length - 1} onClick={() => { setCurrentCardIndex(currentCardIndex + 1); setIsFlipped(false); }} className="flex-1 bg-indigo-600 text-white p-6 rounded-3xl shadow-xl font-black uppercase text-xs disabled:opacity-30 active:scale-95 transition-all">Next</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── QUIZ READY ── */}
        {view === 'quiz-ready' && activeSet && (
          <div className="max-w-md mx-auto py-10 text-center">
            <div className="bg-white p-14 rounded-[4rem] shadow-2xl border">
              <GraduationCap className="mx-auto text-indigo-600 mb-8" size={72} />
              <h2 className="text-3xl font-black mb-2 uppercase">{activeSet.title}</h2>
              <p className="text-slate-400 mb-4 font-medium text-sm">{activeSet.items?.length || 0} Questions</p>
              {activeSet.lastScore !== undefined && (
                <p className="text-indigo-500 font-black text-sm mb-8">Last Score: {activeSet.lastScore}%</p>
              )}
              <button onClick={startQuiz} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Start Exam</button>
            </div>
          </div>
        )}

        {/* ── QUIZ ── */}
        {view === 'quiz' && activeSet && (
          <div className="animate-in fade-in duration-300 space-y-8 pb-32">
            {!quizResults ? (
              <>
                <header className="flex justify-between items-center sticky top-20 bg-slate-50/90 py-4 z-50 backdrop-blur-md px-2">
                  <button onClick={() => setView('library')} className="font-black text-xs text-slate-400">← Quit</button>
                  <span className="text-[10px] font-black text-indigo-600 tracking-widest">{Object.keys(quizAnswers).length} / {quizQuestions.length} Answered</span>
                </header>

                {quizQuestions.map((q, i) => (
                  <div key={q._qid} className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-50">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6 block border-b pb-4">Question {i + 1}</span>
                    {q.imageUrl && (
                      <div className="mb-10 bg-slate-50 p-6 rounded-[2.5rem] flex items-center justify-center min-h-[200px] border shadow-inner">
                        <img src={q.imageUrl} referrerPolicy="no-referrer" className="w-full h-auto object-contain max-h-[400px] rounded-xl" />
                      </div>
                    )}
                    <p className="text-2xl font-black mb-10 leading-snug">{q.question}</p>
                    <div className="grid grid-cols-1 gap-4">
                      {OPTION_KEYS.map(key => {
                        if (!q.options?.[key]) return null;
                        const isSelected = quizAnswers[q._qid] === key;
                        return (
                          <button key={key} onClick={() => setQuizAnswers({ ...quizAnswers, [q._qid]: key })}
                            className={`p-6 rounded-3xl text-left border-2 flex items-center gap-5 transition-all active:scale-[0.98] ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-inner' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isSelected ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                              {key.toUpperCase()}
                            </span>
                            <span className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>{q.options[key]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button onClick={finishQuiz} className="w-full bg-indigo-600 text-white py-8 rounded-[3.5rem] font-black text-xl shadow-2xl active:scale-95 transition-all">
                  Submit Session
                </button>
              </>
            ) : (
              <div className="animate-in zoom-in-95 text-center py-6">
                {/* Score card */}
                <div className="bg-white p-16 rounded-[4rem] shadow-2xl mb-10 relative overflow-hidden border">
                  <div className={`absolute top-0 left-0 right-0 h-4 ${quizResults.pct >= 70 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className={`text-6xl font-black mb-4 ${quizResults.pct >= 80 ? 'text-emerald-500' : quizResults.pct >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {quizResults.pct}%
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">{quizResults.score} / {quizResults.total} Correct</h3>
                  <p className="font-black uppercase text-sm text-slate-400 mb-10">
                    {quizResults.pct >= 80 ? '🎉 Great Work!' : quizResults.pct >= 60 ? '👍 Keep Studying' : '📚 Review & Retry'}
                  </p>
                  <div className="flex gap-4">
                    <button onClick={startQuiz} className="flex-1 bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Retry</button>
                    <button onClick={() => setView('dashboard')} className="flex-1 bg-slate-100 py-5 rounded-3xl font-black uppercase text-xs active:scale-95 transition-all">Home</button>
                  </div>
                </div>

                {/* Missed questions */}
                {quizResults.missed.length > 0 && (
                  <>
                    <h3 className="font-black uppercase text-xs text-slate-400 mb-4 tracking-widest text-left">Missed Questions ({quizResults.missed.length})</h3>
                    {quizResults.missed.map((m, i) => (
                      <div key={i} className="bg-white p-10 rounded-[3.5rem] shadow-sm border-l-[8px] border-rose-400 text-left mb-6 overflow-hidden">
                        {m.imageUrl && <img src={m.imageUrl} referrerPolicy="no-referrer" className="max-h-60 mb-8 object-contain rounded-2xl border" />}
                        <p className="font-black text-xl mb-8 leading-snug">{m.q}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-rose-50 p-6 rounded-3xl flex items-start gap-3">
                            <XCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[9px] font-black uppercase text-rose-400 mb-1">You picked</p>
                              <p className="font-bold text-rose-700 text-sm">{m.user ? `${m.user.toUpperCase()}: ${m.options?.[m.user] || 'Unknown'}` : 'Skipped'}</p>
                            </div>
                          </div>
                          <div className="bg-emerald-50 p-6 rounded-3xl flex items-start gap-3">
                            <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Correct Answer</p>
                              <p className="font-bold text-emerald-700 text-sm">{m.correct?.toUpperCase()}: {m.options?.[m.correct]}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE ── */}
        {view === 'profile' && (
          <div className="max-w-md mx-auto py-10 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-50 text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                <User size={36} className="text-indigo-600" />
              </div>
              {editingName ? (
                <div className="flex gap-2 mt-2">
                  <input autoFocus value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newDisplayName.trim()) {
                        handleSave(async () => { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { ...profile, displayName: newDisplayName.trim() }, { merge: true }); });
                        setEditingName(false);
                      }
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    className="flex-1 bg-slate-50 p-3 rounded-2xl font-black text-center outline-none border border-indigo-200 text-sm uppercase" placeholder="Your name" />
                  <button onClick={() => {
                    if (newDisplayName.trim()) { handleSave(async () => { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { ...profile, displayName: newDisplayName.trim() }, { merge: true }); }); }
                    setEditingName(false);
                  }} className="bg-indigo-600 text-white px-4 rounded-2xl font-black text-xs uppercase">Save</button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <h2 className="text-2xl font-black uppercase">{profile.displayName || 'Student'}</h2>
                  <Edit3 size={14} className="text-slate-300 hover:text-indigo-600 cursor-pointer" onClick={() => { setNewDisplayName(profile.displayName || ''); setEditingName(true); }} />
                </div>
              )}
              {!user?.isAnonymous && <p className="text-[10px] font-bold text-slate-300 uppercase mt-1">{user?.email}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 text-center"><div className="text-2xl font-black text-indigo-600">{stats.sets}</div><div className="text-[9px] font-black uppercase text-slate-300 mt-1">Sets</div></div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 text-center"><div className="text-2xl font-black text-emerald-500">{stats.tests}</div><div className="text-[9px] font-black uppercase text-slate-300 mt-1">Quizzes</div></div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 text-center"><div className="text-2xl font-black text-indigo-600">{stats.avg}%</div><div className="text-[9px] font-black uppercase text-slate-300 mt-1">Avg Score</div></div>
            </div>
            <button onClick={() => signOut(auth)} className="w-full bg-rose-50 text-rose-600 py-6 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}

      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-6 flex justify-around items-center z-50 shadow-lg">
        <Home onClick={() => setView('dashboard')} className={`cursor-pointer transition-colors ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-200'}`} />
        <LayoutGrid onClick={() => { setActiveTab('flashcards'); setView('library'); }} className={`cursor-pointer transition-colors ${view === 'library' && activeTab === 'flashcards' ? 'text-indigo-600' : 'text-slate-200'}`} />
        <GraduationCap onClick={() => { setActiveTab('quizzes'); setView('library'); }} className={`cursor-pointer transition-colors ${view === 'library' && activeTab === 'quizzes' ? 'text-indigo-600' : 'text-slate-200'}`} />
        <User onClick={() => setView('profile')} className={`cursor-pointer transition-colors ${view === 'profile' ? 'text-indigo-600' : 'text-slate-200'}`} />
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
