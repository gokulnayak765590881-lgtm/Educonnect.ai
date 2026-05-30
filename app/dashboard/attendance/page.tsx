'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, addDoc, getDocs, query, where, doc, getDoc
} from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';

export default function Attendance() {
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any>({});
  const [savedStudents, setSavedStudents] = useState<any>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [role, setRole] = useState('');
  const [teacherData, setTeacherData] = useState<any>(null);
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');

  // Fetch teacher role and assignments
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRole(data.role);
          setTeacherData(data);

          if (data.role === 'teacher') {
            // Build list of assigned classes
            const classes: string[] = [];
            if (data.classTeacherOf) classes.push(data.classTeacherOf);
            if (data.subjectAssignments && Array.isArray(data.subjectAssignments)) {
              data.subjectAssignments.forEach((a: any) => {
                if (a.class && !classes.includes(a.class)) classes.push(a.class);
              });
            }
            setAssignedClasses(classes);
            if (classes.length > 0) setSelectedClass(classes[0]);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all students
  useEffect(() => {
    const fetchStudents = async () => {
      const snapshot = await getDocs(collection(db, 'students'));
      setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchStudents();
  }, []);

  // Filter students based on role and selected class
  useEffect(() => {
    if (role === 'admin') {
      // Admin sees all, filter by selected class if any
      if (selectedClass) {
        const [cls, sec] = selectedClass.split('-');
        setFilteredStudents(students.filter(s => s.class === cls && s.section === sec));
      } else {
        setFilteredStudents(students);
      }
    } else if (role === 'teacher') {
      if (!selectedClass) {
        setFilteredStudents([]);
        return;
      }
      const [cls, sec] = selectedClass.split('-');
      setFilteredStudents(students.filter(s => s.class === cls && s.section === sec));
    }
  }, [students, role, selectedClass]);

  // Fetch saved attendance for selected date
  useEffect(() => {
    const fetchSavedAttendance = async () => {
      if (!date) return;
      const q = query(collection(db, 'attendance'), where('date', '==', date));
      const snapshot = await getDocs(q);
      const saved: any = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        saved[data.studentId] = { status: data.status, id: d.id };
      });
      setSavedStudents(saved);
      const initial: any = {};
      Object.keys(saved).forEach(sid => { initial[sid] = saved[sid].status; });
      setAttendance(initial);
    };
    fetchSavedAttendance();
  }, [date]);

  const handleStatus = (studentId: string, status: string) => {
    if (savedStudents[studentId]) return;
    setAttendance((prev: any) => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    const markedStudents = Object.keys(attendance).filter(
      sid => !savedStudents[sid] && filteredStudents.find(s => s.id === sid)
    );

    if (markedStudents.length === 0) {
      alert('Please mark attendance for at least one student.');
      return;
    }

    setIsSaving(true);
    try {
      for (const studentId of markedStudents) {
        const student = filteredStudents.find(s => s.id === studentId);
        if (!student) continue;
        await addDoc(collection(db, 'attendance'), {
          studentId: student.id,
          studentName: student.name,
          class: student.class,
          section: student.section,
          date,
          status: attendance[studentId],
          createdAt: new Date()
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setAttendance({});

      // Refresh saved
      const q = query(collection(db, 'attendance'), where('date', '==', date));
      const snapshot = await getDocs(q);
      const refreshed: any = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        refreshed[data.studentId] = { status: data.status };
      });
      setSavedStudents(refreshed);

    } catch (error) {
      alert('Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mark all present
  const markAllPresent = () => {
    const newAttendance: any = { ...attendance };
    filteredStudents.forEach(s => {
      if (!savedStudents[s.id]) newAttendance[s.id] = 'present';
    });
    setAttendance(newAttendance);
  };

  const presentCount = filteredStudents.filter(s =>
    attendance[s.id] === 'present' || savedStudents[s.id]?.status === 'present'
  ).length;

  const absentCount = filteredStudents.filter(s =>
    attendance[s.id] === 'absent' || savedStudents[s.id]?.status === 'absent'
  ).length;

  return (
    <div className="flex min-h-screen bg-gray-900 text-white overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 w-full p-4 md:p-8 pb-24">

        <h1 className="text-2xl md:text-4xl font-bold mb-6">📋 Attendance</h1>

        {/* Teacher assignment info */}
        {role === 'teacher' && (
          <div className="bg-gray-800 rounded-xl p-4 mb-6 border-l-4 border-blue-500">
            <p className="text-blue-400 font-bold text-sm mb-2">Your Assigned Classes:</p>
            {assignedClasses.length === 0 ? (
              <p className="text-gray-400 text-sm">Not assigned to any class yet. Contact admin.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assignedClasses.map(cls => (
                  <span key={cls}
                    onClick={() => setSelectedClass(cls)}
                    className={`px-3 py-1 rounded-full text-sm cursor-pointer transition ${
                      selectedClass === cls ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-blue-700'
                    }`}>
                    Class {cls}
                    {teacherData?.classTeacherOf === cls && ' 👨‍🏫'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin class selector */}
        {role === 'admin' && (
          <div className="bg-gray-800 rounded-xl p-4 mb-6">
            <p className="text-gray-400 text-sm mb-2">Filter by Class:</p>
            <div className="flex flex-wrap gap-2">
              <span onClick={() => setSelectedClass('')}
                className={`px-3 py-1 rounded-full text-sm cursor-pointer transition ${
                  !selectedClass ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-blue-700'}`}>
                All Classes
              </span>
              {['I-A','I-B','II-A','II-B','III-A','III-B','IV-A','IV-B','V-A','V-B',
                'VI-A','VI-B','VII-A','VII-B','VIII-A','VIII-B','IX-A','IX-B','X-A','X-B'
              ].map(cls => (
                <span key={cls} onClick={() => setSelectedClass(cls)}
                  className={`px-3 py-1 rounded-full text-sm cursor-pointer transition ${
                    selectedClass === cls ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-blue-700'}`}>
                  {cls}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Date, Stats & Save */}
        <div className="bg-gray-800 rounded-2xl p-4 md:p-6 mb-6 shadow-lg">
          <div className="flex flex-col md:flex-row gap-4 md:items-center mb-4">
            <label className="text-gray-300 text-sm font-medium">Select Date:</label>
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-gray-700 text-white rounded-xl px-4 py-3 outline-none text-sm w-full md:w-auto"
            />
            <button onClick={markAllPresent}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-sm transition">
              ✅ Mark All Present
            </button>
            <button onClick={saveAttendance} disabled={isSaving}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition ${
                isSaving ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'}`}>
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </button>
            {saved && <p className="text-green-400 font-medium">✅ Saved!</p>}
          </div>

          {/* Stats */}
          {selectedClass && (
            <div className="flex gap-4 text-sm">
              <span className="text-gray-400">Class: <strong className="text-white">{selectedClass}</strong></span>
              <span className="text-gray-400">Total: <strong className="text-white">{filteredStudents.length}</strong></span>
              <span className="text-green-400">Present: <strong>{presentCount}</strong></span>
              <span className="text-red-400">Absent: <strong>{absentCount}</strong></span>
            </div>
          )}
        </div>

        {/* Attendance Table */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-4 text-left">Student Name</th>
                  <th className="p-4 text-left">Class</th>
                  <th className="p-4 text-left">Roll No</th>
                  <th className="p-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-gray-400">
                      {role === 'teacher' && assignedClasses.length === 0
                        ? '⚠️ Not assigned to any class yet. Contact admin.'
                        : selectedClass
                        ? `No students in Class ${selectedClass}.`
                        : 'Select a class to view students.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => {
                    const isSaved = !!savedStudents[student.id];
                    const currentStatus = attendance[student.id] || savedStudents[student.id]?.status;
                    return (
                      <tr key={student.id} className="border-t border-gray-700 hover:bg-gray-700/30 transition">
                        <td className="p-4 font-medium">{student.name}</td>
                        <td className="p-4 text-gray-400 text-sm">{student.class}-{student.section}</td>
                        <td className="p-4">{student.rollNumber}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {['present', 'absent', 'late'].map(status => (
                              <button key={status}
                                onClick={() => handleStatus(student.id, status)}
                                disabled={isSaved}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition
                                  ${currentStatus === status
                                    ? status === 'present' ? 'bg-green-600'
                                      : status === 'absent' ? 'bg-red-600'
                                      : 'bg-orange-500'
                                    : 'bg-gray-700 hover:bg-gray-600'}
                                  ${isSaved ? 'cursor-not-allowed opacity-75' : ''}`}>
                                {status}
                              </button>
                            ))}
                          </div>
                          {isSaved && <p className="text-xs text-green-400 mt-1">✓ Saved</p>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}