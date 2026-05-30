'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';

export default function Reports() {
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const studentsSnap = await getDocs(collection(db, 'students'));
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      const homeworkSnap = await getDocs(collection(db, 'homework'));
      const feedbackSnap = await getDocs(collection(db, 'feedback'));

      setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setAttendance(attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setHomework(homeworkSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setFeedback(feedbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  // ← NEW: Update performance in Firestore when dropdown changes
  const handlePerformanceChange = async (studentId: string, newPerformance: string) => {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        performanceCategory: newPerformance
      });
      // Update local state immediately
      setStudents(prev =>
        prev.map(s =>
          s.id === studentId ? { ...s, performanceCategory: newPerformance } : s
        )
      );
    } catch (e) {
      console.error('Error updating performance:', e);
    }
  };

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;

  return (
    <div className="flex min-h-screen bg-gray-900 text-white overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 w-full p-4 md:p-8 pb-24">

        <h1 className="text-2xl md:text-4xl font-bold mb-6">📊 Reports & Analytics</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-600 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm md:text-lg font-semibold">Total Students</h2>
            <p className="text-3xl md:text-5xl font-bold mt-3">{students.length}</p>
          </div>
          <div className="bg-green-600 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm md:text-lg font-semibold">Present</h2>
            <p className="text-3xl md:text-5xl font-bold mt-3">{presentCount}</p>
          </div>
          <div className="bg-red-600 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm md:text-lg font-semibold">Absent</h2>
            <p className="text-3xl md:text-5xl font-bold mt-3">{absentCount}</p>
          </div>
          <div className="bg-orange-500 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm md:text-lg font-semibold">Homework</h2>
            <p className="text-3xl md:text-5xl font-bold mt-3">{homework.length}</p>
          </div>
        </div>

        {/* Student Performance */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden mb-8 shadow-lg">
          <div className="p-5 border-b border-gray-700">
            <h2 className="text-xl md:text-2xl font-bold">Student Performance</h2>
            <p className="text-gray-400 text-sm mt-1">
              Use the dropdown to set each student's performance level
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px]">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-4 text-left text-sm md:text-base">Name</th>
                  <th className="p-4 text-left text-sm md:text-base">Roll No</th>
                  <th className="p-4 text-left text-sm md:text-base">Class</th>
                  <th className="p-4 text-left text-sm md:text-base">Performance</th>
                  <th className="p-4 text-left text-sm md:text-base">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map(student => (
                    <tr key={student.id} className="border-t border-gray-700 hover:bg-gray-700/30 transition">
                      <td className="p-4 text-sm md:text-base font-medium">{student.name}</td>
                      <td className="p-4 text-sm md:text-base">{student.rollNumber}</td>
                      <td className="p-4 text-sm md:text-base">{student.class}</td>
                      <td className="p-4">
                        {/* ← NEW: Dropdown to change performance */}
                        <select
                          value={student.performanceCategory || 'Not Set'}
                          onChange={(e) => handlePerformanceChange(student.id, e.target.value)}
                          className={`px-3 py-1 rounded-full text-xs md:text-sm font-medium cursor-pointer border-0 outline-none
                            ${student.performanceCategory === 'Excellent' ? 'bg-green-600 text-white'
                            : student.performanceCategory === 'Good' ? 'bg-blue-600 text-white'
                            : student.performanceCategory === 'Average' ? 'bg-orange-500 text-white'
                            : student.performanceCategory === 'Poor' ? 'bg-red-600 text-white'
                            : 'bg-gray-600 text-white'}`}
                        >
                          <option value="Not Set">Not Set</option>
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Average">Average</option>
                          <option value="Poor">Poor</option>
                        </select>
                      </td>
                      <td className="p-4 text-sm md:text-base">
  {(() => {
    const studentAttendance = attendance.filter(a => a.studentId === student.id);
    const presentDays = studentAttendance.filter(a => a.status === 'present').length;
    return studentAttendance.length > 0
      ? Math.round((presentDays / studentAttendance.length) * 100)
      : 0;
    })()}%
    </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center p-6 text-gray-400">No student data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feedback History */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-5 border-b border-gray-700">
            <h2 className="text-xl md:text-2xl font-bold">AI Generated Feedback History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-4 text-left text-sm md:text-base w-[30%]">Student</th>
                  <th className="p-4 text-left text-sm md:text-base">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {feedback.length > 0 ? (
                  feedback.map((f) => (
                    <tr key={f.id} className="border-t border-gray-700 hover:bg-gray-700/30 transition">
                      <td className="p-4 font-semibold text-sm md:text-base">{f.studentName}</td>
                      <td className="p-4 text-gray-300 text-xs md:text-sm leading-relaxed">
                        {f.feedbackText?.slice(0, 120)}...
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="text-center p-6 text-gray-400">No feedback history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}