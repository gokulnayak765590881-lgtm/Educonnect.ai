'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';

const EXAM_TYPES = ['FA-1', 'FA-2', 'SA-1', 'FA-3', 'FA-4', 'SA-2'];

export default function ParentDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState('FA-1');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const formatDate = (value: any) => {
    if (!value) return 'N/A';
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-IN');
    if (value instanceof Date) return value.toLocaleDateString('en-IN');
    if (typeof value === 'string') return new Date(value).toLocaleDateString('en-IN');
    return String(value);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/auth/parent');
        return;
      }

      try {
        setUser(firebaseUser);

        const parentSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!parentSnap.exists()) { router.push('/auth/parent'); return; }

        const parentData = parentSnap.data();
        if (parentData.role !== 'parent') { router.push('/auth/parent'); return; }

        const childId = parentData.childId;
        if (!childId) { setLoading(false); return; }

        // Fetch Student
        const studentSnap = await getDoc(doc(db, 'students', childId));
        let studentData: any = null;
        if (studentSnap.exists()) {
          studentData = { id: studentSnap.id, ...studentSnap.data() };
          setStudent(studentData);
        }

        // Fetch Attendance
        const attendanceSnap = await getDocs(
          query(collection(db, 'attendance'), where('studentId', '==', childId))
        );
        setAttendance(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Homework by class
        if (studentData?.class) {
          const homeworkSnap = await getDocs(
            query(collection(db, 'homework'), where('class', '==', studentData.class))
          );
          setHomework(homeworkSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }

        // Fetch Feedback
        const feedbackSnap = await getDocs(
          query(collection(db, 'feedback'), where('studentId', '==', childId))
        );
        setFeedback(feedbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Announcements — for child's class + All
        const allAnnouncementsSnap = await getDocs(collection(db, 'announcements'));
        const allAnn = allAnnouncementsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = allAnn.filter((ann: any) =>
          ann.targetClass === 'All' || ann.targetClass === studentData?.class
        );
        filtered.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
        setAnnouncements(filtered);

        // Fetch Marks
        const marksSnap = await getDocs(
          query(collection(db, 'marks'), where('studentId', '==', childId))
        );
        setMarks(marksSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (error) {
        console.error('ERROR:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth/parent');
  };

  const presentDays = attendance.filter(a =>
    ['present', 'late'].includes(String(a.status || '').toLowerCase().trim())
  ).length;
  const totalDays = attendance.length;
  const attendancePercent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const ANNOUNCEMENT_COLORS: { [key: string]: string } = {
    exam: '#dc2626',
    holiday: '#16a34a',
    fee: '#d97706',
    ptm: '#2563eb',
    celebration: '#7c3aed',
    general: '#6b7280',
  };

  const ANNOUNCEMENT_LABELS: { [key: string]: string } = {
    exam: '📝 Exam',
    holiday: '🏖️ Holiday',
    fee: '💰 Fee Due',
    ptm: '👨‍👩‍👧 PTM',
    celebration: '🎉 Celebration',
    general: '📢 General',
  };

  const currentExamMarks = marks.find(m => m.examType === selectedExam);

  // Helper: compute totals and overall grade/percentage for a marks record
  const computeExamTotals = (examMarks: any) => {
    if (!examMarks?.subjects) return { totalObtained: 0, totalMax: 0, totalPercent: 0, totalGrade: 'N/A' };
    const totalObtained = Object.values(examMarks.subjects).reduce((sum: number, m: any) => {
      return sum + parseInt(m.split('/')[0]);
    }, 0) as number;
    const totalMax = Object.values(examMarks.subjects).reduce((sum: number, m: any) => {
      return sum + parseInt(m.split('/')[1]);
    }, 0) as number;
    const totalPercent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
    const totalGrade =
      totalPercent >= 90 ? 'A+' :
      totalPercent >= 80 ? 'A' :
      totalPercent >= 70 ? 'B' :
      totalPercent >= 60 ? 'C' : 'D';
    return { totalObtained, totalMax, totalPercent, totalGrade };
  };

  // Download progress report as a printable HTML page
  const handleDownloadReport = () => {
    if (!student || !currentExamMarks) return;

    const { totalObtained, totalMax, totalPercent, totalGrade } = computeExamTotals(currentExamMarks);

    const subjectRows = currentExamMarks.subjects
      ? Object.entries(currentExamMarks.subjects).map(([subject, marksValue]: any) => {
          const parts = marksValue.split('/');
          const obtained = parseInt(parts[0]);
          const total = parseInt(parts[1]);
          const percent = total > 0 ? Math.round((obtained / total) * 100) : 0;
          const grade = percent >= 90 ? 'A+' : percent >= 80 ? 'A' : percent >= 70 ? 'B' : percent >= 60 ? 'C' : 'D';
          const gradeColor = percent >= 80 ? '#16a34a' : percent >= 60 ? '#d97706' : '#dc2626';
          return `
            <tr>
              <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb;">${subject}</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; font-weight:600; color:#2563eb;">${marksValue}</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; font-weight:700; color:${gradeColor};">${grade}</td>
              <td style="padding:10px 14px; border-bottom:1px solid #e5e7eb; font-weight:600; color:#0891b2;">${percent}%</td>
            </tr>`;
        }).join('')
      : '';

    const totalGradeColor = totalPercent >= 80 ? '#16a34a' : totalPercent >= 60 ? '#d97706' : '#dc2626';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Progress Report – ${student.name} – ${selectedExam}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f9fafb; color: #111827; padding: 40px; }
    .report { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 32px 36px; }
    .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { font-size: 13px; margin-top: 4px; opacity: 0.8; }
    .student-info { display: flex; gap: 32px; padding: 20px 36px; background: #f0f4ff; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 15px; font-weight: 600; color: #111827; }
    .section-title { padding: 20px 36px 12px; font-size: 16px; font-weight: 700; color: #1e3a5f; border-bottom: 2px solid #2563eb; margin: 0 36px; }
    table { width: calc(100% - 72px); margin: 16px 36px; border-collapse: collapse; font-size: 14px; }
    thead tr { background: #f3f4f6; }
    thead th { padding: 10px 14px; text-align: left; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-row { background: #1e3a5f; color: white; }
    .total-row td { padding: 12px 14px; font-weight: 700; font-size: 15px; }
    .footer { padding: 20px 36px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; margin-top: 8px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }
    @media print {
      body { background: white; padding: 0; }
      .report { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>📊 Progress Report — ${selectedExam}</h1>
      <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    </div>
    <div class="student-info">
      <div class="info-item">
        <span class="info-label">Student Name</span>
        <span class="info-value">${student.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Class & Section</span>
        <span class="info-value">${student.class} – ${student.section}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Roll Number</span>
        <span class="info-value">${student.rollNumber}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Exam</span>
        <span class="info-value">${selectedExam}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Attendance</span>
        <span class="info-value">${attendancePercent}% (${presentDays}/${totalDays} days)</span>
      </div>
    </div>
    <div class="section-title">Subject-wise Performance</div>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Marks</th>
          <th>Grade</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows}
        <tr class="total-row">
          <td>Total</td>
          <td>${totalObtained}/${totalMax}</td>
          <td style="color:${totalPercent >= 80 ? '#86efac' : totalPercent >= 60 ? '#fde047' : '#fca5a5'};">${totalGrade}</td>
          <td style="color:${totalPercent >= 80 ? '#86efac' : totalPercent >= 60 ? '#fde047' : '#fca5a5'};">${totalPercent}%</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">
      This is a computer-generated progress report. · Parent Portal – EduConnect
    </div>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Progress_Report_${student.name.replace(/\s+/g, '_')}_${selectedExam}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'attendance', label: '📋 Attendance' },
    { id: 'homework', label: '📚 Homework' },
    { id: 'marks', label: '📊 Marks' },
    { id: 'announcements', label: '📢 Announcements' },
    { id: 'feedback', label: '💬 Feedback' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center text-xl">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">

      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-gray-800 p-6">
        <h1 className="text-2xl font-bold text-blue-400 mb-8">👨‍👩‍👧 Parent Portal</h1>
        <nav className="flex flex-col gap-2 flex-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`p-3 rounded-lg text-left transition-all duration-300 ${
                activeTab === tab.id ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout}
          className="mt-6 bg-red-600 hover:bg-red-500 p-3 rounded-lg font-semibold transition">
          🚪 Logout
        </button>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex justify-around py-2 z-50 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center text-xs px-2 min-w-[50px] ${
              activeTab === tab.id ? 'text-blue-400' : 'text-gray-400'}`}>
            <span className="text-lg">{tab.label.split(' ')[0]}</span>
            <span className="text-[10px]">{tab.label.split(' ')[1]}</span>
          </button>
        ))}
        <button onClick={handleLogout}
          className="flex flex-col items-center text-xs px-2 text-red-400">
          <span className="text-lg">🚪</span>
          <span className="text-[10px]">Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24">
        <h1 className="text-3xl font-bold mb-2">Welcome Parent 👋</h1>
        <p className="text-gray-400 mb-6 text-sm">{user?.email}</p>

        {/* OVERVIEW */}
        {activeTab === 'overview' && student && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-600 rounded-xl p-6 shadow-lg">
                <h2 className="font-semibold">Children</h2>
                <p className="text-3xl font-bold mt-2">1</p>
              </div>
              <div className="bg-green-600 rounded-xl p-6 shadow-lg">
                <h2 className="font-semibold">Present Days</h2>
                <p className="text-3xl font-bold mt-2">{presentDays}</p>
              </div>
              <div className="bg-yellow-600 rounded-xl p-6 shadow-lg">
                <h2 className="font-semibold">Homework</h2>
                <p className="text-3xl font-bold mt-2">{homework.length}</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 shadow">
              <h2 className="text-xl font-bold mb-4">👤 {student.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-xs">Roll Number</p>
                  <p className="font-bold">{student.rollNumber}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Class</p>
                  <p className="font-bold">{student.class} - {student.section}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Performance</p>
                  <p className={`font-bold ${
                    student.performanceCategory === 'Excellent' ? 'text-green-400'
                    : student.performanceCategory === 'Good' ? 'text-blue-400'
                    : student.performanceCategory === 'Average' ? 'text-orange-400'
                    : student.performanceCategory === 'Poor' ? 'text-red-400'
                    : 'text-gray-400'}`}>
                    {student.performanceCategory || 'Not Assessed'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Attendance</p>
                  <p className="font-bold text-green-400">{attendancePercent}%</p>
                  <p className="text-xs text-gray-400 mt-1">{presentDays}/{totalDays} Days</p>
                </div>
              </div>
            </div>

            {/* Latest Announcement Preview */}
            {announcements.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-5 shadow">
                <h3 className="font-bold mb-3">📢 Latest Announcement</h3>
                <div className="border-l-4 pl-4"
                  style={{ borderColor: ANNOUNCEMENT_COLORS[announcements[0].type] || '#6b7280' }}>
                  <p className="font-semibold">{announcements[0].title}</p>
                  <p className="text-gray-400 text-sm mt-1">{announcements[0].message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">📋 Attendance Records</h2>
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <p className="text-lg font-bold text-green-400">{attendancePercent}% Attendance</p>
              <p className="text-gray-400 text-sm">{presentDays} present out of {totalDays} days</p>
            </div>
            {attendance.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No attendance records found</p>
            ) : (
              attendance.map(a => (
                <div key={a.id} className="bg-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 text-sm">📅 {formatDate(a.date)}</p>
                  <span className={`px-3 py-1 rounded-full text-sm mt-2 inline-block ${
                    String(a.status || '').toLowerCase() === 'present' ? 'bg-green-600' :
                    String(a.status || '').toLowerCase() === 'late' ? 'bg-orange-500' : 'bg-red-600'}`}>
                    {a.status || 'Absent'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* HOMEWORK */}
        {activeTab === 'homework' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">📚 Homework</h2>
            {homework.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No homework assigned</p>
            ) : (
              homework.map(hw => (
                <div key={hw.id} className="bg-gray-800 rounded-xl p-4">
                  <h3 className="font-semibold text-lg">{hw.title}</h3>
                  <p className="text-gray-400 text-sm">Class: {hw.class}</p>
                  <p className="text-gray-400 text-sm mt-1">{hw.description}</p>
                  <p className="text-gray-400 text-sm mt-1">Due: {formatDate(hw.dueDate)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* MARKS */}
        {activeTab === 'marks' && (
          <div className="space-y-4">
            {/* Title + Download Button Row */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-2xl font-bold">📊 Exam Marks</h2>
              {currentExamMarks && student && (
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition shadow-lg"
                >
                  ⬇️ Download Report
                </button>
              )}
            </div>

            {/* Exam Type Selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              {EXAM_TYPES.map(exam => (
                <button key={exam} onClick={() => setSelectedExam(exam)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedExam === exam ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                  {exam}
                </button>
              ))}
            </div>

            {/* Student Info */}
            {student && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="font-bold text-lg">{student.name}</p>
                <p className="text-gray-400 text-sm">
                  Class: {student.class}-{student.section} | Roll No: {student.rollNumber}
                </p>
              </div>
            )}

            {/* Marks Table */}
            {currentExamMarks ? (() => {
              const { totalObtained, totalMax, totalPercent, totalGrade } = computeExamTotals(currentExamMarks);
              const totalGradeColor = totalPercent >= 80 ? 'text-green-400' : totalPercent >= 60 ? 'text-yellow-400' : 'text-red-400';

              return (
                <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg">{selectedExam} Results</h3>
                    <span className="text-xs text-gray-400">
                      Updated: {formatDate(currentExamMarks.updatedAt)}
                    </span>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="p-4 text-left">Subject</th>
                        <th className="p-4 text-left">Marks</th>
                        <th className="p-4 text-left">Grade</th>
                        <th className="p-4 text-left">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentExamMarks.subjects && Object.entries(currentExamMarks.subjects).map(
                        ([subject, marksValue]: any) => {
                          const parts = marksValue.split('/');
                          const obtained = parseInt(parts[0]);
                          const total = parseInt(parts[1]);
                          const percent = total > 0 ? Math.round((obtained / total) * 100) : 0;
                          const grade = percent >= 90 ? 'A+' : percent >= 80 ? 'A' : percent >= 70 ? 'B' : percent >= 60 ? 'C' : 'D';
                          const gradeColor = percent >= 80 ? 'text-green-400' : percent >= 60 ? 'text-yellow-400' : 'text-red-400';

                          return (
                            <tr key={subject} className="border-t border-gray-700">
                              <td className="p-4 font-medium">{subject}</td>
                              <td className="p-4 font-bold text-blue-400">{marksValue}</td>
                              <td className={`p-4 font-bold ${gradeColor}`}>{grade}</td>
                              <td className="p-4 font-bold text-cyan-400">{percent}%</td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>

                  {/* Total Row — now includes percentage and grade */}
                  {currentExamMarks.subjects && (
                    <div className="p-4 bg-gray-700 grid grid-cols-4 items-center">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-green-400">
                        {totalObtained}/{totalMax}
                      </span>
                      <span className={`font-bold ${totalGradeColor}`}>
                        {totalGrade}
                      </span>
                      <span className={`font-bold ${totalGradeColor}`}>
                        {totalPercent}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
                No marks available for {selectedExam} yet.
              </div>
            )}
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">📢 Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No announcements yet.</p>
            ) : (
              announcements.map(ann => (
                <div key={ann.id} className="bg-gray-800 rounded-xl p-5 shadow border-l-4"
                  style={{ borderLeftColor: ANNOUNCEMENT_COLORS[ann.type] || '#6b7280' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs px-3 py-1 rounded-full font-medium text-white"
                      style={{ backgroundColor: ANNOUNCEMENT_COLORS[ann.type] || '#6b7280' }}>
                      {ANNOUNCEMENT_LABELS[ann.type] || '📢 General'}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(ann.createdAt)}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{ann.title}</h3>
                  <p className="text-gray-300 leading-relaxed">{ann.message}</p>
                  <p className="text-xs text-gray-500 mt-2">By: {ann.createdBy}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* FEEDBACK */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">💬 AI Feedback</h2>
            {feedback.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No feedback yet</p>
            ) : (
              feedback.map(f => (
                <div key={f.id} className="bg-gray-800 rounded-xl p-4">
                  <p className="text-gray-300 leading-relaxed">{f.feedbackText}</p>
                  {f.createdAt && (
                    <p className="text-gray-500 text-xs mt-2">{formatDate(f.createdAt)}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}