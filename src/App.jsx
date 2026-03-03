import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { Trash2, ChevronLeft, ChevronRight, BrainCircuit, GraduationCap, RefreshCw, X, Plus, LayoutGrid, User, Home, BookOpen, Edit3, LogOut, FlaskConical } from 'lucide-react';

const APP_VERSION = "1.1.7";

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
  const [view, setView] = useState('dashboard'); 
  const [activeTab, setActiveTab] = useState('flashcards'); 
  const [activeSetId, setActiveSetId] = useState(null);
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);

  const fixImageUrl = (url) => {
    if (!url) return '';
    let link = url.trim();
    if (link.includes('imgur.com')) {
      let id = link.includes('#') ? link.split('#').pop() : link.split('/').pop().split(/[.#?]/)[0];
      return `https://i.imgur.com/${id}.png`;
    }
    return link;
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
    onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) setProfile(docSnap.data());
      else setProfile({ displayName: user.isAnonymous ? 'Guest' : 'Student' });
    });
    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    onSnapshot(setsPath, (snapshot) => {
      setSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const historyPath = collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory');
    onSnapshot(historyPath, (snapshot) => {
      setHistoryData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
    });
  }, [user]);

  const activeSet = useMemo(() => sets.find(s => s.id === activeSetId) || null, [sets, activeSetId]);
  const filteredSets = useMemo(() => (sets || []).filter(s => s?.type === activeTab).sort((a, b) => (a?.orderIndex || 0) - (b?.orderIndex || 0)), [sets, activeTab]);
  const stats = useMemo(() => {
    const sList = sets || [];
    const hList = historyData || [];
    const totalItems = sList.reduce((acc, set) => acc + (set?.items?.length || 0), 0);
    const avg = hList.length > 0 ? Math.round((hList.reduce((a, b) => a + (b.score / b.total), 0) / hList.length) * 100) : 0;
    return { sets: sList.length, totalItems, avg, tests: hList.length };
  }, [sets, historyData]);

  const handleAuth = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'info'), { displayName: fullName || 'Student', email, createdAt: Date.now() });
      }
      setView('dashboard');
    } catch (err) { setAuthError(err.message.replace('Firebase: ', '')); }
  };

  const handleGuestEntry = async () => { try { await signInAnonymously(auth); setView('dashboard'); } catch (err) { setAuthError(err.message); } };
  const handleSave = async (op) => { if (!user) return; setSyncing(true); try { await op(); } catch (e) { console.error(e); } finally { setTimeout(() => setSyncing(false), 600); } };
  const updateSet = (id, data) => handleSave(async () => { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', id), { ...data, updatedAt: Date.now() }); });

  if (status === 'loading') return <div className="h-screen flex items-center justify-center bg-white"><RefreshCw className="animate-spin text-indigo-600" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white p-10 rounded-[3.5rem] shadow-2xl border">
        <BrainCircuit className="mx-auto text-indigo-600 mb-6" size={48} />
        <h1 className="text-2xl font-black mb-8 uppercase tracking-tight">Learnly Pro</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && <input type="text" placeholder="Full Name" onChange={e => setFullName(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" />}
          <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" />
          <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" />
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Sign In</button>
        </form>
        <button onClick={handleGuestEntry} className="mt-6 w-full text-slate-400 font-black text-[10px] uppercase flex items-center justify-center gap-2"><FlaskConical size={14} /> Enter as Guest</button>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="mt-8 text-indigo-600 font-black text-[10px] uppercase underline">{authMode === 'login' ? "Sign Up" : "Login"}</button>
        <div className="mt-10 text-[8px] font-black text-slate-200 tracking-[0.3em] uppercase">Build {APP_VERSION}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans selection:bg-indigo-100">
      <nav className="bg-white border-b px-6 h-20 flex items-center justify-between sticky top-0 z-50">
        <span className="font-black text-2xl tracking-tighter" onClick={() => setView('dashboard')}>LEARNLY</span>
        <User className="text-indigo-600" onClick={() => setView('profile')} />
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8"><h1 className="text-3xl font-black uppercase">Your Classroom</h1></header>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.sets}</div><div className="text-[10px] font-black uppercase text-slate-300">Sets</div></div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-50"><div className="text-2xl font-black text-indigo-600">{stats.avg}%</div><div className="text-[10px] font-black uppercase text-slate-300">Avg Score</div></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div onClick={() => { setActiveTab('flashcards'); setView('library'); }} className="bg-white p-12 rounded-[3.5rem] border border-slate-100 text-center cursor-pointer group hover:shadow-xl transition-all"><BookOpen size={48} className="mx-auto mb-4 text-indigo-600 group-hover:scale-110" /><h2 className="text-2xl font-black uppercase">Flashcards</h2></div>
              <div onClick={() => { setActiveTab('quizzes'); setView('library'); }} className="bg-white p-12 rounded-[3.5rem] border border-slate-100 text-center cursor-pointer group hover:shadow-xl transition-all"><GraduationCap size={48} className="mx-auto mb-4 text-emerald-600 group-hover:scale-110" /><h2 className="text-2xl font-black uppercase">Exams</h2></div>
            </div>
          </div>
        )}

        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <header className="flex justify-between items-center mb-10"><button onClick={() => setView('dashboard')} className="font-black text-xs uppercase text-slate-400">← Back</button><button onClick={() => {
              handleSave(async () => {
                const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'studySets'), { title: 'New Set', type: activeTab, items: [], updatedAt: Date.now() });
                setActiveSetId(docRef.id); setView('edit');
              })
            }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl">+ New Set</button></header>
            <div className="space-y-4">
              {filteredSets.map(set => (
                <div key={set.id} onClick={() => { setActiveSetId(set.id); setCurrentCardIndex(0); setIsFlipped(false); setView(activeTab === 'flashcards' ? 'study' : 'quiz-ready'); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 flex justify-between items-center cursor-pointer relative overflow-hidden">
                  {set.lastScore !== undefined && <div className="absolute bottom-0 left-0 h-1 bg-indigo-600" style={{ width: `${set.lastScore}%` }}></div>}
                  <div className="flex-1"><h3 className="text-lg font-black">{set.title}</h3><p className="text-[10px] font-bold text-slate-300 uppercase">{set.items?.length || 0} Items {set.lastScore !== undefined && `• ${set.lastScore}%`}</p></div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}><Edit3 onClick={() => { setActiveSetId(set.id); setView('edit'); }} className="text-slate-300 hover:text-indigo-600" /><Trash2 onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', set.id))} className="text-slate-300 hover:text-rose-500" /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'study' && activeSet && (
          <div className="animate-in fade-in max-w-lg mx-auto py-10">
            <header className="flex justify-between items-center mb-10"><button onClick={() => setView('library')} className="font-black text-xs uppercase text-slate-400">← Exit</button><span className="text-[10px] font-black text-indigo-600">{currentCardIndex + 1} / {activeSet.items.length}</span></header>
            <div className="perspective-1000 w-full h-[400px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 bg-white rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-12 backface-hidden border border-slate-100">
                  {activeSet.items[currentCardIndex]?.imageUrl && <img src={activeSet.items[currentCardIndex].imageUrl} className="max-h-40 mb-6 object-contain" /> }
                  <h3 className="text-2xl font-black text-center uppercase">{activeSet.items[currentCardIndex]?.term || activeSet.items[currentCardIndex]?.question}</h3>
                </div>
                <div className="absolute inset-0 bg-indigo-600 rounded-[4rem] shadow-2xl flex flex-col items-center justify-center p-12 backface-hidden rotate-y-180 text-white">
                  <p className="text-xl font-bold text-center">{activeSet.items[currentCardIndex]?.definition || activeSet.items[currentCardIndex]?.correctAnswer?.toUpperCase()}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-12 gap-4"><button disabled={currentCardIndex === 0} onClick={() => { setCurrentCardIndex(currentCardIndex - 1); setIsFlipped(false); }} className="flex-1 bg-white p-6 rounded-3xl border shadow-sm font-black uppercase text-xs">Prev</button><button disabled={currentCardIndex === activeSet.items.length - 1} onClick={() => { setCurrentCardIndex(currentCardIndex + 1); setIsFlipped(false); }} className="flex-1 bg-indigo-600 text-white p-6 rounded-3xl shadow-xl font-black uppercase text-xs">Next</button></div>
          </div>
        )}

        {view === 'quiz-ready' && activeSet && (
          <div className="max-w-md mx-auto py-10 text-center"><div className="bg-white p-14 rounded-[4rem] shadow-2xl border"><GraduationCap className="mx-auto text-indigo-600 mb-8" size={72} /><h2 className="text-3xl font-black mb-2 uppercase">{activeSet.title}</h2><p className="text-slate-400 mb-12 font-bold uppercase text-[10px] tracking-widest">{activeSet.items?.length || 0} Questions</p><button onClick={() => { setQuizQuestions([...activeSet.items].sort(() => 0.5 - Math.random())); setQuizAnswers({}); setQuizResults(null); setView('quiz'); }} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Start Exam</button></div></div>
        )}

        {view === 'edit' && activeSet && (
          <div className="animate-in fade-in pb-24"><header className="flex justify-between items-center mb-8 sticky top-20 bg-slate-50/90 py-4 z-40 backdrop-blur-md"><button onClick={() => setView('library')} className="font-black text-xs uppercase text-slate-400">← Exit</button><button onClick={() => setView('library')} className="bg-indigo-600 text-white px-8 py-2 rounded-2xl font-black text-[10px] uppercase shadow-xl">Done</button></header><input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-4xl font-black bg-transparent outline-none mb-10 uppercase border-b-4 pb-4 focus:border-indigo-500" /><div className="space-y-6">{activeSet.items?.map((item, i) => (<div key={i} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-50 space-y-4"><div className="flex justify-between items-center"><span className="text-xs font-black text-indigo-500 uppercase tracking-widest">Item {i+1}</span><Trash2 onClick={() => { const ni = activeSet.items.filter((_, idx) => idx !== i); updateSet(activeSetId, {items:ni}); }} className="text-slate-200 hover:text-rose-500" /></div><textarea value={item.question || item.term} onChange={e => { const ni = [...activeSet.items]; if(activeTab === 'flashcards') ni[i].term = e.target.value; else ni[i].question = e.target.value; updateSet(activeSetId, {items:ni}); }} className="w-full bg-slate-50 p-6 rounded-3xl font-bold outline-none h-32 border border-transparent focus:border-indigo-100" placeholder="Text..." /><input value={item.imageUrl || ''} placeholder="Imgur Link" onChange={e => { const ni = [...activeSet.items]; ni[i].imageUrl = fixImageUrl(e.target.value); updateSet(activeSetId, {items:ni}); }} className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black outline-none uppercase tracking-widest" />{item.imageUrl && <img src={item.imageUrl} className="w-32 h-32 object-contain rounded-3xl border bg-slate-50" />}</div>))}<button onClick={() => updateSet(activeSetId, { items: [...(activeSet.items||[]), { term: '', definition: '', question: '', imageUrl: '', options: {a:'',b:'',c:'',d:''}, correctAnswer: 'a' }] })} className="w-full py-20 border-4 border-dashed rounded-[4rem] text-slate-200 font-black uppercase text-xs tracking-widest hover:border-indigo-200 hover:text-indigo-500 transition-all">+ Add Item</button></div></div>
        )}

        {view === 'profile' && (
          <div className="max-w-md mx-auto py-20 text-center"><div className="bg-white p-16 rounded-[4rem] shadow-2xl border"><User size={64} className="mx-auto mb-4 text-indigo-600" /><h2 className="text-3xl font-black mb-10 uppercase">{profile.displayName || 'Student'}</h2><button onClick={() => signOut(auth)} className="w-full bg-rose-50 text-rose-600 py-6 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"><LogOut size={16}/> Sign Out</button></div></div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-6 flex justify-around items-center z-50 shadow-lg"><Home onClick={() => setView('dashboard')} className={`cursor-pointer ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-200'}`} /><LayoutGrid onClick={() => { setActiveTab('flashcards'); setView('library'); }} className={`cursor-pointer ${view === 'library' && activeTab === 'flashcards' ? 'text-indigo-600' : 'text-slate-200'}`} /><GraduationCap onClick={() => { setActiveTab('quizzes'); setView('library'); }} className={`cursor-pointer ${view === 'library' && activeTab === 'quizzes' ? 'text-indigo-600' : 'text-slate-200'}`} /><User onClick={() => setView('profile')} className={`cursor-pointer ${view === 'profile' ? 'text-indigo-600' : 'text-slate-200'}`} /></div>

      <style>{`.perspective-1000 { perspective: 1000px; } .transform-style-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .rotate-y-180 { transform: rotateY(180deg); }`}</style>
    </div>
  );
}

