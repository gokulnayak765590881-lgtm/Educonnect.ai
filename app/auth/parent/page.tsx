'use client';

import { useEffect, useState } from 'react';
import {
  collection, getDocs, query, where, doc, getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';

const EXAM_TYPES = ['FA-1', 'FA-2', 'SA-1', 'FA-3', 'FA-4', 'SA-2'];

const getGrade = (percent: number) => {
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'F';
};

const getGradeColor = (grade: string) => {
  if (grade === 'A+' || grade === 'A') return '#16a34a';
  if (grade === 'B') return '#2563eb';
  if (grade === 'C') return '#d97706';
  if (grade === 'D') return '#ea580c';
  return '#dc2626';
};

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
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const formatDate = (value: any) => {
    if (!value) return 'N/A';
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-IN');
    if (value instanceof Date) return value.toLocaleDateString('en-IN');
    if (typeof value === 'string') return new Date(value).toLocaleDateString('en-IN');
    return String(value);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { router.push('/auth/parent'); return; }

      try {
        setUser(firebaseUser);
        const parentSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!parentSnap.exists()) { router.push('/auth/parent'); return; }

        const parentData = parentSnap.data();
        if (parentData.role !== 'parent') { router.push('/auth/parent'); return; }

        const childId = parentData.childId;
        if (!childId) { setLoading(false); return; }

        // Fetch student
        const studentSnap = await getDoc(doc(db, 'students', childId));
        let studentData: any = null;
        if (studentSnap.exists()) {
          studentData = { id: studentSnap.id, ...studentSnap.data() };
          setStudent(studentData);
        }

        // Fetch attendance
        const attendanceSnap = await getDocs(
          query(collection(db, 'attendance'), where('studentId', '==', childId))
        );
        setAttendance(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch homework by class
        if (studentData?.class) {
          const homeworkSnap = await getDocs(
            query(collection(db, 'homework'), where('class', '==', studentData.class))
          );
          setHomework(homeworkSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }

        // Fetch feedback
        const feedbackSnap = await getDocs(
          query(collection(db, 'feedback'), where('studentId', '==', childId))
        );
        setFeedback(feedbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch announcements
        const annSnap = await getDocs(collection(db, 'announcements'));
        const filteredAnn = annSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((ann: any) => ann.targetClass === 'All' || ann.targetClass === studentData?.class)
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAnnouncements(filteredAnn);

        // Fetch marks
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

  const currentExamMarks = marks.find(m => m.examType === selectedExam);

  const calculateTotal = () => {
    let obtained = 0, total = 0;
    if (!currentExamMarks?.subjects) return { obtained, total };
    Object.values(currentExamMarks.subjects).forEach((value: any) => {
      const parts = value.split('/');
      obtained += parseInt(parts[0]) || 0;
      total += parseInt(parts[1]) || 0;
    });
    return { obtained, total };
  };

  const { obtained, total } = calculateTotal();
  const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
  const overallGrade = getGrade(percentage);

  const presentDays = attendance.filter(a =>
    ['present', 'late'].includes(String(a.status || '').toLowerCase().trim())
  ).length;
  const totalDays = attendance.length;
  const attendancePercent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const ANNOUNCEMENT_COLORS: { [key: string]: string } = {
    exam: '#dc2626', holiday: '#16a34a', fee: '#d97706',
    ptm: '#2563eb', celebration: '#7c3aed', general: '#6b7280',
  };
  const ANNOUNCEMENT_LABELS: { [key: string]: string } = {
    exam: '📝 Exam', holiday: '🏖️ Holiday', fee: '💰 Fee Due',
    ptm: '👨‍👩‍👧 PTM', celebration: '🎉 Celebration', general: '📢 General',
  };

  // Download JPEG
  const downloadJPEG = async () => {
    if (!student || !currentExamMarks) {
      alert('No marks available for this exam');
      return;
    }
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '794px';
      container.style.background = 'white';
      document.body.appendChild(container);

      const subjects = currentExamMarks.subjects || {};
      const subjectEntries = Object.entries(subjects);

      container.innerHTML = `
        <div style="width:794px;padding:50px;background:white;font-family:'Segoe UI',Arial,sans-serif;box-sizing:border-box;position:relative;">
          <div style="position:absolute;top:12px;left:12px;right:12px;bottom:12px;border:3px solid #1d4ed8;border-radius:12px;pointer-events:none;"></div>
          <div style="position:absolute;top:20px;left:20px;right:20px;bottom:20px;border:1px solid #93c5fd;border-radius:8px;pointer-events:none;"></div>
          <div style="text-align:center;margin-bottom:28px;padding-top:10px;">
            <h1 style="font-size:28px;font-weight:800;color:#1d4ed8;margin:0 0 4px 0;letter-spacing:1px;">EduConnect AI School</h1>
            <p style="font-size:13px;color:#2563eb;margin:0;font-weight:600;letter-spacing:3px;text-transform:uppercase;">Progress Report — ${selectedExam}</p>
            <div style="width:80px;height:3px;background:linear-gradient(to right,#1d4ed8,#60a5fa);margin:12px auto 0;border-radius:2px;"></div>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 24px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <p style="margin:0;font-size:12px;color:#6b7280;font-weight:500;">Student Name</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#1e3a8a;">${student.name}</p>
            </div>
            <div style="text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;font-weight:500;">Class & Section</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#1e3a8a;">${student.class} — ${student.section}</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0;font-size:12px;color:#6b7280;font-weight:500;">Roll No</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#1e3a8a;">${student.rollNumber || 'N/A'}</p>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <thead>
              <tr style="background:#1d4ed8;">
                <th style="padding:12px 16px;text-align:left;color:white;font-size:14px;">Subject</th>
                <th style="padding:12px 16px;text-align:center;color:white;font-size:14px;">Marks</th>
                <th style="padding:12px 16px;text-align:center;color:white;font-size:14px;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${subjectEntries.map(([subject, value]: any, i) => {
                const parts = value.split('/');
                const obt = parseInt(parts[0]) || 0;
                const tot = parseInt(parts[1]) || 1;
                const pct = Math.round((obt / tot) * 100);
                const grade = getGrade(pct);
                const color = getGradeColor(grade);
                return `<tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'};border-bottom:1px solid #e2e8f0;">
                  <td style="padding:12px 16px;font-size:14px;color:#1e293b;font-weight:500;">${subject}</td>
                  <td style="padding:12px 16px;text-align:center;font-size:14px;font-weight:700;color:#1d4ed8;">${value}</td>
                  <td style="padding:12px 16px;text-align:center;font-size:14px;font-weight:700;color:${color};">${grade}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div style="margin-bottom:24px;">
            <p style="font-size:14px;font-weight:700;color:#1d4ed8;margin:0 0 12px 0;">Performance Chart</p>
            ${subjectEntries.map(([subject, value]: any) => {
              const parts = value.split('/');
              const obt = parseInt(parts[0]) || 0;
              const tot = parseInt(parts[1]) || 1;
              const pct = Math.round((obt / tot) * 100);
              return `<div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-size:13px;color:#374151;">${subject}</span>
                  <span style="font-size:13px;color:#374151;font-weight:600;">${value}</span>
                </div>
                <div style="background:#e2e8f0;border-radius:999px;height:10px;overflow:hidden;">
                  <div style="width:${pct}%;height:10px;background:linear-gradient(to right,#1d4ed8,#60a5fa);border-radius:999px;"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:2px solid #93c5fd;border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Total Marks</p>
              <p style="margin:4px 0 0;font-size:26px;font-weight:800;color:#1d4ed8;">${obtained}/${total}</p>
            </div>
            <div style="text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Percentage</p>
              <p style="margin:4px 0 0;font-size:26px;font-weight:800;color:#1d4ed8;">${percentage}%</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Overall Grade</p>
              <p style="margin:4px 0 0;font-size:36px;font-weight:800;color:${getGradeColor(overallGrade)};">${overallGrade}</p>
            </div>
          </div>
          <div style="text-align:center;margin-top:20px;padding-bottom:8px;">
            <p style="font-size:11px;color:#9ca3af;margin:0;">Generated by EduConnect AI • ${new Date().toLocaleDateString('en-IN')}</p>
          </div>
        </div>
      `;

      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, backgroundColor: 'white', width: 794,
      });
      document.body.removeChild(container);

      const link = document.createElement('a');
      link.download = `${student.name}_${selectedExam}_Report.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();

    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setDownloading(false);
    }
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-xl">
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
              className={`p-3 rounded-lg text-left transition-all ${
                activeTab === tab.id ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout}
          className="mt-6 bg-red-600 hover:bg-red-500 p-3 rounded-lg font-semibold">
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
        <button onClick={handleLogout} className="flex flex-col items-center text-xs px-2 text-red-400">
          <span className="text-lg">🚪</span>
          <span className="text-[10px]">Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 pb-24">
        <h1 className="text-3xl font-bold mb-2">Welcome Parent 👋</h1>
        <p className="text-gray-400 mb-6 text-sm">{user?.email}</p>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {!student ? (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
                No student linked to your account. Contact admin.
              </div>
            ) : (
              <>
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
              </>
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
                  <p className="text-gray-400 text-sm mt-2">Due: {formatDate(hw.dueDate)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* MARKS */}
        {activeTab === 'marks' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">📊 Exam Marks</h2>

            <div className="flex flex-wrap gap-2 items-center mb-4">
              {EXAM_TYPES.map(exam => (
                <button key={exam} onClick={() => setSelectedExam(exam)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedExam === exam ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  {exam}
                </button>
              ))}
              <button
                onClick={downloadJPEG}
                disabled={downloading || !currentExamMarks}
                className="ml-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-sm disabled:opacity-40 transition flex items-center gap-2"
              >
                {downloading ? '⏳ Generating...' : '⬇️ Download JPEG'}
              </button>
            </div>

            {student && (
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="font-bold text-lg">{student.name}</p>
                <p className="text-gray-400 text-sm">
                  Class: {student.class}-{student.section} | Roll No: {student.rollNumber}
                </p>
              </div>
            )}

            {currentExamMarks ? (
              <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold text-lg">{selectedExam} Results</h3>
                  <span className="text-xs text-gray-400">Updated: {formatDate(currentExamMarks.updatedAt)}</span>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="p-4 text-left">Subject</th>
                      <th className="p-4 text-left">Marks</th>
                      <th className="p-4 text-left">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(currentExamMarks.subjects || {}).map(([subject, value]: any) => {
                      const parts = value.split('/');
                      const obt = parseInt(parts[0]) || 0;
                      const tot = parseInt(parts[1]) || 1;
                      const pct = Math.round((obt / tot) * 100);
                      const grade = getGrade(pct);
                      const gradeColor = grade === 'A+' || grade === 'A' ? 'text-green-400'
                        : grade === 'B' ? 'text-blue-400'
                        : grade === 'C' ? 'text-yellow-400'
                        : grade === 'D' ? 'text-orange-400' : 'text-red-400';
                      return (
                        <tr key={subject} className="border-t border-gray-700">
                          <td className="p-4 font-medium">{subject}</td>
                          <td className="p-4 font-bold text-blue-400">{value}</td>
                          <td className={`p-4 font-bold ${gradeColor}`}>{grade}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-700">
                    <tr>
                      <td className="p-4 font-bold">Total</td>
                      <td className="p-4 font-bold text-green-400">{obtained}/{total}</td>
                      <td className="p-4 font-bold" style={{ color: getGradeColor(overallGrade) }}>
                        {overallGrade} ({percentage}%)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
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