'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  updateDoc,
  deleteDoc 
} from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const EXAM_TYPES = ['FA-1', 'FA-2', 'SA-1', 'FA-3', 'FA-4', 'SA-2'];

const getGrade = (obtained: string, total: string) => {
  if (obtained === '') return '-';
  const percent = parseInt(total) > 0 ? Math.round((parseInt(obtained) / parseInt(total)) * 100) : 0;
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'F';
};

const getGradeColor = (grade: string) => {
  if (grade === 'A+' || grade === 'A') return 'text-green-400';
  if (grade === 'B') return 'text-blue-400';
  if (grade === 'C') return 'text-yellow-400';
  if (grade === 'D') return 'text-orange-400';
  if (grade === 'F') return 'text-red-400';
  return 'text-gray-400';
};

export default function Marks() {
  const [students, setStudents] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [teacherAssignments, setTeacherAssignments] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [allMarks, setAllMarks] = useState<any[]>([]);

  const [selectedStudent, setSelectedStudent] = useState('');
  const [examType, setExamType] = useState('FA-1');

  const [subjectsList] = useState<string[]>(['Telugu', 'Hindi', 'English', 'Maths','EVS','Computer']);
  const [subjectMarks, setSubjectMarks] = useState<{ [key: string]: { obtained: string; total: string } }>({});

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Initialize subjectMarks
  useEffect(() => {
    const initialMarks: any = {};
    subjectsList.forEach(subject => {
      initialMarks[subject] = { obtained: '', total: '20' };
    });
    setSubjectMarks(initialMarks);
  }, [subjectsList]);

  // AUTH & TEACHER FILTER
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserEmail(user.email || '');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setRole(userData.role);

          let assigned: string[] = [];
          if (userData.role === 'teacher') {
            if (userData.classTeacherOf) assigned.push(userData.classTeacherOf);
            if (userData.subjectAssignments && Array.isArray(userData.subjectAssignments)) {
              userData.subjectAssignments.forEach((item: any) => {
                if (item.class) assigned.push(item.class);
              });
            }
            assigned = [...new Set(assigned)];
            setTeacherAssignments(assigned);
          }
          fetchStudents(userData.role, assigned);
          fetchAllMarks(userData.role, assigned); // Filter marks too
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchStudents = async (currentRole: string, assignedClasses: string[]) => {
    const snap = await getDocs(collection(db, 'students'));
    let studentList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (currentRole === 'teacher' && assignedClasses.length > 0) {
      studentList = studentList.filter((student: any) => {
        if (!student.class) return false;
        const sClass = String(student.class).trim();
        const sSection = student.section ? String(student.section).trim() : '';
        const fullKey = sSection ? `${sClass}-${sSection}` : sClass;
        return assignedClasses.some(a => 
          String(a).trim() === sClass || String(a).trim() === fullKey
        );
      });
    }
    setStudents(studentList);
  };

  // Fetch and filter marks for teachers
  const fetchAllMarks = async (currentRole: string, assignedClasses: string[]) => {
    const snap = await getDocs(collection(db, 'marks'));
    let marksList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (currentRole === 'teacher' && assignedClasses.length > 0) {
      marksList = marksList.filter((mark: any) => {
        if (!mark.class) return false;
        const mClass = String(mark.class).trim();
        const mSection = mark.section ? String(mark.section).trim() : '';
        const fullKey = mSection ? `${mClass}-${mSection}` : mClass;
        return assignedClasses.some(a => 
          String(a).trim() === mClass || String(a).trim() === fullKey
        );
      });
    }
    setAllMarks(marksList);
  };

  const handleMarkChange = (subject: string, field: 'obtained' | 'total', value: string) => {
    setSubjectMarks(prev => ({
      ...prev,
      [subject]: { ...prev[subject], [field]: value }
    }));
  };

  const handleSaveMarks = async () => {
    if (!selectedStudent) {
      setMessage('❌ Please select a student.');
      return;
    }
    setLoading(true);
    try {
      const student = students.find(s => s.id === selectedStudent);
      if (!student) return;

      const formattedSubjects: { [key: string]: string } = {};
      Object.entries(subjectMarks).forEach(([subject, marks]) => {
        if (marks.obtained !== '') {
          formattedSubjects[subject] = `${marks.obtained}/${marks.total}`;
        }
      });

      const existingQuery = query(
        collection(db, 'marks'),
        where('studentId', '==', selectedStudent),
        where('examType', '==', examType)
      );
      const existingSnap = await getDocs(existingQuery);

      if (existingSnap.docs.length > 0) {
        await updateDoc(doc(db, 'marks', existingSnap.docs[0].id), {
          subjects: formattedSubjects,
          updatedBy: userEmail,
          updatedAt: new Date(),
        });
      } else {
        await addDoc(collection(db, 'marks'), {
          studentId: selectedStudent,
          studentName: student.name || '',
          class: student.class || '',
          section: student.section || '',
          rollNumber: student.rollNumber || '',
          examType,
          subjects: formattedSubjects,
          updatedBy: userEmail,
          updatedAt: new Date(),
        });
      }

      setMessage(`✅ Marks saved for ${student.name} - ${examType}`);
      fetchAllMarks(role, teacherAssignments);
      setSelectedStudent('');
    } catch (e) {
      console.error(e);
      setMessage('❌ Error saving marks.');
    }
    setLoading(false);
  };

  const deleteReport = async (markId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    setDeletingId(markId);
    try {
      await deleteDoc(doc(db, 'marks', markId));
      setMessage('✅ Report deleted successfully');
      fetchAllMarks(role, teacherAssignments);
    } catch (error) {
      setMessage('❌ Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  };

  // Download Report (same as before with total percentage)
  const downloadStudentReport = async (mark: any) => {
    setDownloadingId(mark.id);
    try {
      const tempDiv = document.createElement('div');

tempDiv.style.position = 'absolute';
tempDiv.style.left = '-9999px';

/* Certificate Size */
tempDiv.style.width = '950px';

/* Background */
tempDiv.style.background = '#f8f6f2';
tempDiv.style.color = '#1e293b';

/* Outer Certificate Border */
tempDiv.style.border = '10px solid #1e3c8d';

/* Margin Around Certificate */
tempDiv.style.padding = '15px';

/* Space Outside Border */
tempDiv.style.margin = '50px auto';

/* Inner Premium Border */
tempDiv.style.boxSizing = 'border-box';
tempDiv.style.fontFamily = 'Georgia, serif';

/* Add inner shadow look */
tempDiv.style.boxShadow = '0 0 25px rgba(0,0,0,0.15)';

/* Create Inner Certificate Layer */
tempDiv.innerHTML = `
  <div style="
    border:2px solid #d4af37;
    padding:40px;
    background:#ffffff;
    min-height:1200px;
    position:relative;
  ">

    YOUR COMPLETE REPORT HTML HERE

  </div>
`;

      let totalObtained = 0;
      let totalMax = 0;

      const subjectsHTML = subjectsList.map((subject) => {
  const value = mark.subjects?.[subject];

  if (!value) return '';

  const parts = value.split('/');
  const obtained = parseInt(parts[0]);
  const total = parseInt(parts[1]);

  totalObtained += obtained;
  totalMax += total;

  const grade = getGrade(parts[0], parts[1]);

  const percentage =
    total > 0
      ? Math.round((obtained / total) * 100)
      : 0;

  return `
    <tr>
      <td style="border:1px solid #94a3b8; padding:12px;">
        ${subject}
      </td>

      <td style="border:1px solid #94a3b8; padding:12px; font-weight:bold;">
        ${value}
      </td>

      <td style="border:1px solid #94a3b8; padding:12px; font-weight:bold; color:#16a34a;">
        ${grade}
      </td>

      <td style="border:1px solid #94a3b8; padding:12px; font-weight:bold; color:#2563eb;">
        ${percentage}%
      </td>
    </tr>
  `;
}).join('');
      const overallPercent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
      const overallGrade = getGrade(totalObtained.toString(), totalMax.toString());
<br/>
      const barChartHTML = subjectsList.map((subject) => {
  const value = mark.subjects?.[subject];

  if (!value) return '';

  const parts = value.split('/');
  const score = parseInt(parts[0]);
  const total = parseInt(parts[1]);

  const percentage = (score / total) * 100;

  return `
    <div style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="font-weight:500;">${subject}</span>
        <span>${score}/${total}</span>
      </div>

      <div style="background:#e2e8f0; height:26px; border-radius:6px; overflow:hidden;">
        <div style="background:#3b82f6; width:${percentage}%; height:100%;"></div>
      </div>
    </div>
  `;
}).join('');

      tempDiv.innerHTML = `
        <div style="text-align:center; margin-bottom:30px;">
          <h1 style="font-size:32px; margin:0; color:#1e40af;">EduConnect AI English Medium High School</h1>
          <h2 style="margin:15px 0; color:#1e40af;">Progress Report - ${mark.examType}</h2>
        </div>
        <div style="margin-bottom:30px; padding:15px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <p><strong>Student Name:</strong> ${mark.studentName}</p>
          <p><strong>Class:</strong> ${mark.class} ${mark.section} | Roll No: ${mark.rollNumber}</p>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
          <thead>
  <tr style="background:#e2e8f0;">
    <th style="border:1px solid #94a3b8; padding:12px; text-align:left;">
      Subject
    </th>

    <th style="border:1px solid #94a3b8; padding:12px; text-align:left;">
      Marks
    </th>

    <th style="border:1px solid #94a3b8; padding:12px; text-align:left;">
      Grade
    </th>

    <th style="border:1px solid #94a3b8; padding:12px; text-align:left;">
      Percentage
    </th>
  </tr>
</thead>
          <tbody>${subjectsHTML}</tbody>
        </table>

          <br/>
          <br/>

        <div style="margin:30px 0;">
          <h3 style="margin-bottom:12px; color:#1e40af;">Performance Chart</h3>
          ${barChartHTML}
        </div>

        <div style="text-align:right; font-size:25px; font-weight:bold; color:#16a34a; padding:15px; border:2px solid #16a34a; border-radius:8px; background:#f0fdf4;">
          Total: ${totalObtained}/${totalMax} &nbsp;&nbsp; (${overallPercent}%) &nbsp;&nbsp; Grade: ${overallGrade}
        </div>
<br/>
<br/>
<br/>
<br/>
        <p style="text-align:right; margin-top:40px; color:#666;">Generated on: ${new Date().toLocaleDateString('en-IN')}</p>
      `;

      document.body.appendChild(tempDiv);
      const canvas = await html2canvas(tempDiv, { scale: 2 });
      document.body.removeChild(tempDiv);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      pdf.save(`${mark.studentName}_${mark.examType}_Report.pdf`);

    } catch (error) {
      console.error(error);
      alert("Failed to download report");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 pb-24 overflow-x-hidden">

        <h1 className="text-2xl md:text-4xl font-bold mb-6">📋 Marks Management</h1>

        {/* Enter Student Marks Form - Same as before */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Enter Student Marks</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
              className="p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none">
              <option value="">Select Student *</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} - Class {s.class} {s.section} (Roll: {s.rollNumber})
                </option>
              ))}
            </select>

            <select value={examType} onChange={e => setExamType(e.target.value)}
              className="p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none">
              {EXAM_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3 text-left">Subject</th>
                  <th className="p-3 text-left">Marks Obtained</th>
                  <th className="p-3 text-left">Total Marks</th>
                  <th className="p-3 text-left">Grade</th>
                  <th className="p-3 text-left">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(subjectMarks).map(([subject, marks]) => {
  const grade = getGrade(marks.obtained, marks.total);
  const gradeColor = getGradeColor(grade);

  const percentage =
    marks.obtained &&
    Number(marks.total) > 0
      ? (
          (Number(marks.obtained) / Number(marks.total)) *
          100
        ).toFixed(2)
      : '-';

  return (
    <tr key={subject} className="border-t border-gray-700">
      <td className="p-3 font-medium">{subject}</td>

      <td className="p-3">
        <input
          type="number"
          placeholder="e.g. 18"
          value={marks.obtained}
          onChange={e =>
            handleMarkChange(subject, 'obtained', e.target.value)
          }
          className="w-24 p-2 rounded-lg bg-gray-600 text-white border border-gray-500 outline-none focus:border-blue-500"
          min="0"
        />
      </td>

      <td className="p-3">
        <input
          type="number"
          value={marks.total}
          onChange={e =>
            handleMarkChange(subject, 'total', e.target.value)
          }
          className="w-24 p-2 rounded-lg bg-gray-600 text-white border border-gray-500 outline-none focus:border-blue-500"
          min="0"
        />
      </td>

      <td className={`p-3 font-bold text-lg ${gradeColor}`}>
        {grade}
      </td>

      <td className="p-3 font-bold text-cyan-400">
        {percentage === '-' ? '-' : `${percentage}%`}
      </td>
    </tr>
  );
})}
              </tbody>
            </table>
          </div>

          <button onClick={handleSaveMarks} disabled={loading || !selectedStudent}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold disabled:opacity-50 transition">
            {loading ? '⏳ Saving...' : '💾 Save Marks'}
          </button>

          {message && <div className="mt-4 p-3 bg-gray-700 rounded-lg text-sm text-green-400">{message}</div>}
        </div>

        {/* Saved Marks Records - Filtered for Teacher */}
        <div>
          <h2 className="text-xl font-bold mb-4">Saved Marks Records</h2>
          {allMarks.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-8 text-center text-gray-400">
              No marks saved yet.
            </div>
          ) : (
            <div className="space-y-6">
              {allMarks.map(mark => {
                let totalObtained = 0;
                let totalMax = 0;
                Object.values(mark.subjects || {}).forEach((v: any) => {
                  const parts = v.split('/');
                  totalObtained += parseInt(parts[0]) || 0;
                  totalMax += parseInt(parts[1]) || 0;
                });
                const totalGrade = getGrade(totalObtained.toString(), totalMax.toString());
                const totalPercent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

                return (
                  <div key={mark.id} className="bg-gray-800 rounded-2xl p-6 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold">{mark.studentName}</h3>
                        <p className="text-gray-400 text-sm">
                          Class {mark.class} {mark.section} | Roll No: {mark.rollNumber}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-4 py-1 bg-blue-600 rounded-full text-sm font-bold">
                          {mark.examType}
                        </span>
                        <button
                          onClick={() => downloadStudentReport(mark)}
                          disabled={downloadingId === mark.id}
                          className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                        >
                          {downloadingId === mark.id ? 'Generating...' : '⬇ Download Report'}
                        </button>
                        <button
                          onClick={() => deleteReport(mark.id)}
                          disabled={deletingId === mark.id}
                          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                        >
                          {deletingId === mark.id ? 'Deleting...' : '🗑 Delete'}
                        </button>
                      </div>
                    </div>

                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="p-2 text-left text-sm">Subject</th>
                          <th className="p-2 text-left text-sm">Marks</th>
                          <th className="p-2 text-left text-sm">Grade</th>
                          <th className="p-2 text-left text-sm">Perrcentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectsList.map((subject) => {
  const marksValue = mark.subjects?.[subject];

  if (!marksValue) return null;

  const parts = marksValue.split('/');

  const obtained = parseInt(parts[0]) || 0;
  const total = parseInt(parts[1]) || 0;

  const percentage =
    total > 0
      ? Math.round((obtained / total) * 100)
      : 0;

  const grade = getGrade(parts[0], parts[1]);
  const gradeColor = getGradeColor(grade);

  return (
    <tr key={subject} className="border-t border-gray-700">
      <td className="p-2 text-sm">
        {subject}
      </td>

      <td className="p-2 text-sm font-bold text-blue-400">
        {marksValue}
      </td>

      <td className={`p-2 text-sm font-bold ${gradeColor}`}>
        {grade}
      </td>

      <td className="p-2 text-sm font-bold text-cyan-400">
        {percentage}%
      </td>
    </tr>
  );
})}
                      </tbody>
                      <tfoot className="bg-gray-700">
            <tr>
            <td className="p-2 font-bold">Total</td>

            <td className="p-2 font-bold text-green-400">
            {totalObtained}/{totalMax}
            </td>

            <td className={`p-2 font-bold ${getGradeColor(totalGrade)}`}>
            {totalGrade}
            </td>

            <td className="p-2 font-bold text-cyan-400">
            {totalPercent}%
            </td>
            </tr>
            </tfoot>
                    </table>

                    <p className="text-xs text-gray-500 mt-3">Updated by: {mark.updatedBy}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}