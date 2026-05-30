'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { parentAuth } from '@/lib/firebase-parent';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [message, setMessage] = useState('');
  const [addingTeacher, setAddingTeacher] = useState(false);

  // Add Teacher Form fields
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
            fetchUsers();
          } else {
            router.push('/dashboard');
          }
        } catch (e) {
          router.push('/dashboard');
        }
      } else {
        router.push('/auth');
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUsers = async () => {
    const snapshot = await getDocs(collection(db, 'users'));
    setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  const handleUpdateName = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { name: editName });
      setMessage('✅ Name updated!');
      setEditingUser(null);
      fetchUsers();
    } catch (e) {
      setMessage('❌ Error updating name.');
    }
  };

  const handleAddTeacher = async () => {
    if (!teacherName || !teacherEmail || !teacherPassword) {
      setMessage('❌ Name, email and password are required.');
      return;
    }
    if (teacherPassword.length < 6) {
      setMessage('❌ Password must be at least 6 characters.');
      return;
    }

    setAddingTeacher(true);
    setMessage('');

    try {
      // Use parentAuth so admin stays logged in
      const credential = await createUserWithEmailAndPassword(
        parentAuth, teacherEmail, teacherPassword
      );
      const uid = credential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        name: teacherName,
        email: teacherEmail,
        phone: teacherPhone,
        role: 'teacher',
        classTeacherOf: '',
        subjectAssignments: [],
        createdAt: new Date(),
      });

      setMessage(`✅ Teacher "${teacherName}" added! Login: ${teacherEmail}`);
      setTeacherName('');
      setTeacherEmail('');
      setTeacherPassword('');
      setTeacherPhone('');
      fetchUsers();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setMessage('❌ Email already registered.');
      } else {
        setMessage(`❌ Error: ${err.message}`);
      }
    }
    setAddingTeacher(false);
  };

  if (!isAdmin) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Checking permissions...</p>
    </div>
  );

  const teachers = users.filter(u => u.role === 'teacher');
  const admins = users.filter(u => u.role === 'admin');
  const parents = users.filter(u => u.role === 'parent');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#111827', color: 'white' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '16px', paddingBottom: '80px', overflowX: 'hidden' }}>

        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
          👑 User Management
        </h1>

        {message && (
          <div style={{
            padding: '12px', borderRadius: '8px', marginBottom: '16px',
            backgroundColor: message.startsWith('✅') ? '#064e3b' : '#7f1d1d',
            color: message.startsWith('✅') ? '#34d399' : '#fca5a5',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}

        {/* ===== ADD TEACHER FORM ===== */}
        <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: '#60a5fa' }}>
            👨‍🏫 Add New Teacher
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
            Teacher account will be created automatically with Firebase login.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input
              placeholder="Full Name *"
              value={teacherName}
              onChange={e => setTeacherName(e.target.value)}
              style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', outline: 'none' }}
            />
            <input
              placeholder="Email Address *"
              type="email"
              value={teacherEmail}
              onChange={e => setTeacherEmail(e.target.value)}
              style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', outline: 'none' }}
            />
            <input
              placeholder="Password * (min 6 chars)"
              type="password"
              value={teacherPassword}
              onChange={e => setTeacherPassword(e.target.value)}
              style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', outline: 'none' }}
            />
            <input
              placeholder="Phone Number (optional)"
              type="tel"
              value={teacherPhone}
              onChange={e => setTeacherPhone(e.target.value)}
              style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', outline: 'none' }}
            />
          </div>

          <button
            onClick={handleAddTeacher}
            disabled={addingTeacher}
            style={{
              padding: '12px 24px',
              backgroundColor: addingTeacher ? '#374151' : '#2563eb',
              color: 'white', borderRadius: '8px', border: 'none',
              cursor: addingTeacher ? 'not-allowed' : 'pointer',
              fontWeight: 'bold', fontSize: '14px'
            }}
          >
            {addingTeacher ? '⏳ Adding...' : '➕ Add Teacher'}
          </button>
        </div>

        {/* ===== TEACHERS TABLE ===== */}
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', padding: '16px', borderBottom: '1px solid #374151', color: '#60a5fa' }}>
            👨‍🏫 Teachers ({teachers.length})
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead style={{ backgroundColor: '#374151' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Phone</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Class Teacher Of</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                      No teachers yet. Add one above!
                    </td>
                  </tr>
                ) : (
                  teachers.map(user => (
                    <tr key={user.id} style={{ borderTop: '1px solid #374151' }}>
                      <td style={{ padding: '12px 16px' }}>
                        {editingUser === user.id ? (
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            style={{ padding: '6px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}
                          />
                        ) : (
                          user.name || user.displayName || 'No name'
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '13px' }}>{user.email}</td>
                      <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '13px' }}>{user.phone || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '9999px', fontSize: '12px',
                          backgroundColor: user.classTeacherOf ? '#1d4ed8' : '#374151',
                          color: 'white'
                        }}>
                          {user.classTeacherOf || 'Not assigned'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {editingUser === user.id ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleUpdateName(user.id)}
                              style={{ padding: '6px 12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                              Save
                            </button>
                            <button onClick={() => setEditingUser(null)}
                              style={{ padding: '6px 12px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingUser(user.id); setEditName(user.name || ''); }}
                            style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                            ✏️ Edit Name
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== ADMINS ===== */}
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', padding: '16px', borderBottom: '1px solid #374151', color: '#a78bfa' }}>
            👑 Admins ({admins.length})
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#374151' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(user => (
                <tr key={user.id} style={{ borderTop: '1px solid #374151' }}>
                  <td style={{ padding: '12px 16px' }}>{user.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', backgroundColor: '#7c3aed', color: 'white' }}>
                      Admin
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== PARENTS ===== */}
        <div style={{ backgroundColor: '#1f2937', borderRadius: '12px', padding: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399' }}>
            👨‍👩‍👧 Parents ({parents.length})
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px' }}>
            Parents are auto-created when students are added.
          </p>
        </div>

      </div>
    </div>
  );
}