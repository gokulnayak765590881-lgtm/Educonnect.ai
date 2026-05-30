'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>('');

  // ← Fetch role from Firestore directly (not localStorage)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userRole = userDoc.data().role;
            setRole(userRole);
            localStorage.setItem('userRole', userRole); // save for speed
          }
        } catch (e) {
          // fallback to localStorage
          const saved = localStorage.getItem('userRole');
          if (saved) setRole(saved);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleLogout = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('userRole');
      await signOut(auth);
      router.replace('/auth');
    } catch (error) {
      console.error('Logout Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const teacherLinks = [
    { href: '/dashboard', label: '🏠', full: 'Dashboard' },
    { href: '/dashboard/students', label: '👨‍🎓', full: 'Students' },
    { href: '/dashboard/attendance', label: '📋', full: 'Attendance' },
    { href: '/dashboard/homework', label: '📚', full: 'Homework' },
    { href: '/dashboard/feedback', label: '🤖', full: 'AI Feedback' },
    { href: '/dashboard/reports', label: '📊', full: 'Reports' },
    { href: '/dashboard/announcements', label: '📢', full: 'Announcements' },
    { href: '/dashboard/marks', label: '📝', full: 'Marks' },
  ];

  const adminLinks = [
    { href: '/dashboard', label: '🏠', full: 'Dashboard' },
    { href: '/dashboard/students', label: '👨‍🎓', full: 'Students' },
    { href: '/dashboard/attendance', label: '📋', full: 'Attendance' },
    { href: '/dashboard/homework', label: '📚', full: 'Homework' },
    { href: '/dashboard/feedback', label: '🤖', full: 'AI Feedback' },
    { href: '/dashboard/reports', label: '📊', full: 'Reports' },
    { href: '/dashboard/announcements', label: '📢', full: 'Announcements' },
    { href: '/dashboard/marks', label: '📝', full: 'Marks' },
    { href: '/dashboard/classes', label: '🏫', full: 'Classes' },
    { href: '/dashboard/users', label: '👑', full: 'Manage Users' },
  ];

  const links = role === 'admin' ? adminLinks : teacherLinks;

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: '#1f2937', display: 'flex',
        justifyContent: 'space-around', padding: '8px 0',
        zIndex: 1000, borderTop: '1px solid #374151', overflowX: 'auto',
      }}>
        {links.map(link => (
          <Link key={link.href} href={link.href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textDecoration: 'none',
            color: pathname === link.href ? '#60a5fa' : '#9ca3af',
            fontSize: '18px', minWidth: '48px',
          }}>
            <span>{link.label}</span>
            <span style={{ fontSize: '8px', marginTop: '2px' }}>{link.full}</span>
          </Link>
        ))}
        <button onClick={handleLogout} disabled={loading} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          color: '#ef4444', fontSize: '18px', minWidth: '48px',
        }}>
          <span>{loading ? '⏳' : '🚪'}</span>
          <span style={{ fontSize: '8px', marginTop: '2px' }}>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: '220px', minHeight: '100vh',
      backgroundColor: '#1f2937', padding: '16px',
      display: 'flex', flexDirection: 'column',
    }}>
      <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '24px' }}>
        EduConnect AI
      </h1>

      <div style={{ marginBottom: '12px' }}>
        <span style={{
          fontSize: '11px', padding: '4px 10px', borderRadius: '9999px',
          backgroundColor:
            role === 'admin' ? '#7c3aed' :
            role === 'teacher' ? '#2563eb' : '#374151',
          color: 'white', textTransform: 'capitalize',
        }}>
          {role || 'loading...'}
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {links.map(link => (
          <Link key={link.href} href={link.href} style={{
            padding: '10px 12px', borderRadius: '8px',
            textDecoration: 'none', color: 'white', fontSize: '14px',
            backgroundColor: pathname === link.href ? '#2563eb' : 'transparent',
          }}>
            {link.label} {link.full}
          </Link>
        ))}
      </nav>

      <button onClick={handleLogout} disabled={loading} style={{
        padding: '10px', backgroundColor: '#dc2626',
        borderRadius: '8px', border: 'none',
        color: 'white', cursor: 'pointer', fontSize: '14px',
        opacity: loading ? 0.7 : 1,
      }}>
        {loading ? '⏳ Logging out...' : '🚪 Logout'}
      </button>
    </div>
  );
}