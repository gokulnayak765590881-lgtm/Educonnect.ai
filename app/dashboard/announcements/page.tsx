'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';

const ANNOUNCEMENT_TYPES = [
  { value: 'exam', label: '📝 Exam', color: '#dc2626' },
  { value: 'holiday', label: '🏖️ Holiday', color: '#16a34a' },
  { value: 'fee', label: '💰 Fee Due', color: '#d97706' },
  { value: 'ptm', label: '👨‍👩‍👧 PTM', color: '#2563eb' },
  { value: 'celebration', label: '🎉 Celebration', color: '#7c3aed' },
  { value: 'general', label: '📢 General', color: '#6b7280' },
];

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [type, setType] = useState('general');
  const [targetClass, setTargetClass] = useState('All');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserEmail(user.email || '');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) setRole(userDoc.data().role);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async () => {
    const snap = await getDocs(collection(db, 'announcements'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by newest first
    data.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
    setAnnouncements(data);
  };

  const handleAdd = async () => {
    if (!title || !announcementMessage) {
      setMessage('❌ Please fill title and message.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        message: announcementMessage,
        type,
        targetClass,
        createdBy: userEmail,
        createdAt: new Date(),
        isActive: true,
      });
      setMessage('✅ Announcement sent successfully!');
      setTitle('');
      setAnnouncementMessage('');
      setType('general');
      setTargetClass('All');
      fetchAnnouncements();
    } catch (e) {
      setMessage('❌ Error sending announcement.');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await deleteDoc(doc(db, 'announcements', id));
    fetchAnnouncements();
  };

  const getTypeInfo = (typeValue: string) => {
    return ANNOUNCEMENT_TYPES.find(t => t.value === typeValue) || ANNOUNCEMENT_TYPES[5];
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN');
    if (typeof timestamp === 'string') return timestamp;
    return '';
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 pb-24 overflow-x-hidden">

        <h1 className="text-2xl md:text-4xl font-bold mb-6">📢 Announcements</h1>

        {/* Add Announcement Form */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Create New Announcement</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              placeholder="Announcement Title *"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none focus:border-blue-500"
            />

            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none"
            >
              {ANNOUNCEMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <select
              value={targetClass}
              onChange={e => setTargetClass(e.target.value)}
              className="p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none"
            >
              <option value="All">All Classes</option>
              <option value="I">Class I</option>
              <option value="II">Class II</option>
              <option value="III">Class III</option>
              <option value="IV">Class IV</option>
              <option value="V">Class V</option>
              <option value="VI">Class VI</option>
              <option value="VII">Class VII</option>
              <option value="VIII">Class VIII</option>
              <option value="IX">Class IX</option>
              <option value="X">Class X</option>
            </select>
          </div>

          <textarea
            placeholder="Announcement message... *"
            value={announcementMessage}
            onChange={e => setAnnouncementMessage(e.target.value)}
            rows={4}
            className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none focus:border-blue-500 mb-4 resize-none"
          />

          <div className="flex items-center gap-4">
            <button
              onClick={handleAdd}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50 transition"
            >
              {loading ? '⏳ Sending...' : '📢 Send Announcement'}
            </button>
          </div>

          {message && (
            <div className="mt-4 p-3 bg-gray-700 rounded-lg text-sm text-green-400">
              {message}
            </div>
          )}
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">All Announcements ({announcements.length})</h2>

          {announcements.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-8 text-center text-gray-400">
              No announcements yet. Create one above!
            </div>
          ) : (
            announcements.map(ann => {
              const typeInfo = getTypeInfo(ann.type);
              return (
                <div key={ann.id} className="bg-gray-800 rounded-2xl p-5 shadow-lg border-l-4"
                  style={{ borderLeftColor: typeInfo.color }}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs px-3 py-1 rounded-full font-medium"
                          style={{ backgroundColor: typeInfo.color }}>
                          {typeInfo.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          Class: {ann.targetClass || 'All'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(ann.createdAt)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold mb-2">{ann.title}</h3>
                      <p className="text-gray-300 leading-relaxed">{ann.message}</p>
                      <p className="text-xs text-gray-500 mt-2">By: {ann.createdBy}</p>
                    </div>

                    {(role === 'admin' || role === 'teacher') && (
                      <button
                        onClick={() => handleDelete(ann.id)}
                        className="ml-4 text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-lg hover:bg-red-900/30 transition"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}