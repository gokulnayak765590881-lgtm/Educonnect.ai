'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, getDocs, doc, getDoc,
  setDoc, updateDoc, query, where
} from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';

const CLASS_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const SECTIONS = ['A', 'B'];
const SUBJECTS = ['Telugu', 'Hindi', 'English', 'Maths', 'EVS', 'Science', 'Social', 'Computer'];

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedClass, setSelectedClass] = useState('I');
  const [selectedSection, setSelectedSection] = useState('A');
  const [classTeacher, setClassTeacher] = useState('');
  const [subjectTeachers, setSubjectTeachers] = useState<{ [key: string]: string }>({
    Telugu: '', Hindi: '', English: '', Maths: '',
    EVS: '', Science: '', Social: '', Computer: ''
  });

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchClasses = async () => {
    const snap = await getDocs(collection(db, 'classes'));
    setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchTeachers = async () => {
    const snap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'teacher'))
    );
    setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleSaveClass = async () => {
    const classId = `${selectedClass}-${selectedSection}`;
    setLoading(true);
    setMessage('');

    try {
      const classTeacherData = teachers.find(t => t.id === classTeacher);

      // Save class document
      await setDoc(doc(db, 'classes', classId), {
        classId,
        className: selectedClass,
        section: selectedSection,
        classTeacherId: classTeacher,
        classTeacherName: classTeacherData?.name || classTeacherData?.displayName || '',
        subjects: subjectTeachers,
        updatedAt: new Date(),
      });

      // Update class teacher's document
      if (classTeacher) {
        await updateDoc(doc(db, 'users', classTeacher), {
          classTeacherOf: classId,
        });
      }

      // Update each subject teacher's assignments
      for (const [subject, teacherId] of Object.entries(subjectTeachers)) {
        if (teacherId) {
          const teacherDoc = await getDoc(doc(db, 'users', teacherId));
          if (teacherDoc.exists()) {
            const currentAssignments = teacherDoc.data().subjectAssignments || [];
            // Remove old assignment for this class+subject if exists
            const filtered = currentAssignments.filter(
              (a: any) => !(a.class === classId && a.subject === subject)
            );
            // Add new assignment
            filtered.push({ class: classId, subject });
            await updateDoc(doc(db, 'users', teacherId), {
              subjectAssignments: filtered,
            });
          }
        }
      }

      setMessage(`✅ Class ${classId} saved successfully!`);
      fetchClasses();
    } catch (e) {
      console.error(e);
      setMessage('❌ Error saving class.');
    }
    setLoading(false);
  };

  // Load existing class data when class/section changes
  useEffect(() => {
    const classId = `${selectedClass}-${selectedSection}`;
    const existing = classes.find(c => c.classId === classId);
    if (existing) {
      setClassTeacher(existing.classTeacherId || '');
      setSubjectTeachers(existing.subjects || {
        Telugu: '', Hindi: '', English: '', Maths: '',
        EVS: '', Science: '', Social: '', Computer: ''
      });
    } else {
      setClassTeacher('');
      setSubjectTeachers({
        Telugu: '', Hindi: '', English: '', Maths: '',
        EVS: '', Science: '', Social: '', Computer: ''
      });
    }
  }, [selectedClass, selectedSection, classes]);

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher?.name || teacher?.displayName || 'Not assigned';
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 pb-24 overflow-x-hidden">

        <h1 className="text-2xl md:text-4xl font-bold mb-6">🏫 Class Management</h1>

        {/* Assignment Form */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8 shadow-lg">
          <h2 className="text-xl font-bold mb-6">Assign Teachers to Class</h2>

          {/* Class & Section Selector */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Select Class</label>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none"
              >
                {CLASS_NAMES.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Select Section</label>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none"
              >
                {SECTIONS.map(s => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Class Teacher */}
          <div className="mb-6 p-4 bg-gray-700 rounded-xl">
            <label className="block text-blue-400 font-bold mb-2">
              👨‍🏫 Class Teacher for {selectedClass}-{selectedSection}
            </label>
            <select
              value={classTeacher}
              onChange={e => setClassTeacher(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-600 text-white border border-gray-500 outline-none"
            >
              <option value="">Select Class Teacher</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name || t.displayName || t.email}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Teachers */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4 text-yellow-400">📚 Subject Teachers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SUBJECTS.map(subject => (
                <div key={subject} className="p-3 bg-gray-700 rounded-xl">
                  <label className="block text-gray-300 text-sm mb-2 font-medium">
                    {subject}
                  </label>
                  <select
                    value={subjectTeachers[subject] || ''}
                    onChange={e => setSubjectTeachers(prev => ({
                      ...prev, [subject]: e.target.value
                    }))}
                    className="w-full p-2 rounded-lg bg-gray-600 text-white border border-gray-500 outline-none text-sm"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.displayName || t.email}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveClass}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50 transition"
          >
            {loading ? '⏳ Saving...' : `💾 Save ${selectedClass}-${selectedSection} Assignment`}
          </button>

          {message && (
            <div className="mt-4 p-3 bg-gray-700 rounded-lg text-sm text-green-400">
              {message}
            </div>
          )}
        </div>

        {/* All Classes Overview */}
        <div>
          <h2 className="text-xl font-bold mb-4">📋 All Class Assignments</h2>
          {classes.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-8 text-center text-gray-400">
              No classes set up yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classes
                .sort((a, b) => a.classId.localeCompare(b.classId))
                .map(cls => (
                  <div key={cls.id} className="bg-gray-800 rounded-2xl p-5 shadow-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-bold text-blue-400">
                        Class {cls.classId}
                      </h3>
                      <span className="text-xs bg-blue-900 px-3 py-1 rounded-full">
                        {cls.className} - {cls.section}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-gray-400 text-xs">Class Teacher</p>
                      <p className="font-bold text-green-400">
                        👨‍🏫 {cls.classTeacherName || getTeacherName(cls.classTeacherId) || 'Not assigned'}
                      </p>
                    </div>

                    {cls.subjects && (
                      <div>
                        <p className="text-gray-400 text-xs mb-2">Subject Teachers</p>
                        <div className="space-y-1">
                          {Object.entries(cls.subjects).map(([subject, teacherId]: any) => (
                            teacherId ? (
                              <div key={subject} className="flex justify-between text-sm">
                                <span className="text-gray-300">{subject}</span>
                                <span className="text-yellow-400">{getTeacherName(teacherId)}</span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}