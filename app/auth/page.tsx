'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loginType, setLoginType] = useState('staff');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const loginEmail = loginType === 'parent'
      ? `parent_${phone}@educonnect.com`
      : email;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const uid = userCredential.user.uid;

      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists() && userDoc.data().role === 'parent') {
          router.push('/parent');
        } else {
          router.push('/dashboard');
        }
      } catch {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827'}}>
      <div style={{backgroundColor: '#1f2937', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', margin: '16px'}}>

        <h1 style={{color: 'white', fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center'}}>
          EduConnect AI
        </h1>
        <p style={{color: '#9ca3af', textAlign: 'center', marginBottom: '24px', fontSize: '14px'}}>
          School Management Platform
        </p>

        {/* Login Type Toggle */}
        <div style={{display: 'flex', gap: '8px', marginBottom: '24px'}}>
          <button onClick={() => setLoginType('staff')}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', fontWeight: 'bold',
              backgroundColor: loginType === 'staff' ? '#2563eb' : '#374151',
              color: 'white'
            }}>
            👨‍🏫 Staff
          </button>
          <button onClick={() => setLoginType('parent')}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', fontWeight: 'bold',
              backgroundColor: loginType === 'parent' ? '#2563eb' : '#374151',
              color: 'white'
            }}>
            👨‍👩‍👧 Parent
          </button>
        </div>

        {error && (
          <p style={{color: '#f87171', marginBottom: '16px', textAlign: 'center', fontSize: '14px'}}>
            {error}
          </p>
        )}

        <form onSubmit={handleLogin}>
          {loginType === 'parent' ? (
            <input type="tel" placeholder="Phone Number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', boxSizing: 'border-box'}} />
          ) : (
            <input type="email" placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', boxSizing: 'border-box'}} />
          )}

          <input type="password" placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', boxSizing: 'border-box'}} />

          <button type="submit" disabled={loading}
            style={{width: '100%', padding: '14px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px'}}>
            {loading ? '⏳ Logging in...' : '🔐 Login'}
          </button>
        </form>

        <p style={{color: '#9ca3af', fontSize: '12px', textAlign: 'center', marginTop: '16px'}}>
          {loginType === 'parent' ? 'Parents: Enter your phone number and password' : 'Staff: Enter your email and password'}
        </p>
      </div>
    </div>
  );
}