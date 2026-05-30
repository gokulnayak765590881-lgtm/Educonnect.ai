'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentPercentage: 0,
    totalHomework: 0,
  });
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) { router.push('/auth'); return; }
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const data = userDoc.data();
        const role = data?.role;
        if (role !== 'admin' && role !== 'teacher') {
          await auth.signOut();
          router.push('/auth');
          return;
        }
        setUser(firebaseUser);
        await fetchDashboardStats();
      } catch (e) {
        console.error('Dashboard Error:', e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchDashboardStats = async () => {
    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      let presentCount = 0;
      attendanceSnap.forEach(doc => {
        const status = String(doc.data().status || '').toLowerCase().trim();
        if (status === 'present' || status === 'late') presentCount++;
      });
      const attendancePercent = attendanceSnap.size > 0
        ? Math.round((presentCount / attendanceSnap.size) * 100) : 0;
      const homeworkSnap = await getDocs(collection(db, 'homework'));
      setStats({
        totalStudents: studentsSnap.size,
        presentPercentage: attendancePercent,
        totalHomework: homeworkSnap.size,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', backgroundColor: '#111827', color: 'white', fontSize: '18px' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#111827', color: 'white' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '16px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>
          Welcome to EduConnect AI
        </h1>
        <p style={{ color: '#9ca3af', marginBottom: '24px', fontSize: '14px', wordBreak: 'break-all' }}>
          {user?.email}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold' }}>Students</h2>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#60a5fa', marginTop: '8px' }}>
              {stats.totalStudents}
            </p>
          </div>
          <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold' }}>Attendance</h2>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#34d399', marginTop: '8px' }}>
              {stats.presentPercentage}%
            </p>
          </div>
          <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold' }}>Homework</h2>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#fbbf24', marginTop: '8px' }}>
              {stats.totalHomework}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}