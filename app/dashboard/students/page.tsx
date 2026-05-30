'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { parentAuth, parentDb } from '@/lib/firebase-parent';
import { 
  collection, addDoc, getDocs, doc, 
  getDoc, setDoc, deleteDoc 
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Sidebar from '../../components/Sidebar';

const CLASS_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const SECTIONS = ['A', 'B'];

export default function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [teacherData, setTeacherData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Filter states
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // Add Student Form
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRole(data.role);
          setTeacherData(data);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchStudents = async () => {
    const snapshot = await getDocs(collection(db, 'students'));
    const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setStudents(allStudents);
  };

  useEffect(() => { fetchStudents(); }, []);

  // Filter students based on role and teacher assignments
  useEffect(() => {
    if (role === 'admin') {
      // Admin sees all students
      applyFilters(students);
      return;
    }

    if (role === 'teacher' && teacherData) {
      // Get all classes this teacher is assigned to
      const assignedClasses: string[] = [];

      // Add class teacher class
      if (teacherData.classTeacherOf) {
        assignedClasses.push(teacherData.classTeacherOf);
      }

      // Add subject teacher classes
      if (teacherData.subjectAssignments && Array.isArray(teacherData.subjectAssignments)) {
        teacherData.subjectAssignments.forEach((assignment: any) => {
          if (assignment.class && !assignedClasses.includes(assignment.class)) {
            assignedClasses.push(assignment.class);
          }
        });
      }

      if (assignedClasses.length === 0) {
        // Teacher not yet assigned to any class
        setFilteredStudents([]);
        return;
      }

      // Filter students by assigned classes
      // classId format is "VII-A", student has class: "VII" and section: "A"
      const teacherStudents = students.filter(student => {
        const studentClassId = `${student.class}-${student.section}`;
        return assignedClasses.includes(studentClassId);
      });

      applyFilters(teacherStudents);
    }
  }, [students, role, teacherData, filterClass, filterSection]);

  const applyFilters = (studentList: any[]) => {
    let result = studentList;
    if (filterClass) result = result.filter(s => s.class === filterClass);
    if (filterSection) result = result.filter(s => s.section === filterSection);
    setFilteredStudents(result);
  };

  // Re-apply filters when filter changes
  useEffect(() => {
    if (role === 'admin') {
      applyFilters(students);
    }
  }, [filterClass, filterSection, students]);

  // Get assigned classes for teacher (for filter dropdown)
  const getAssignedClasses = () => {
    if (role === 'admin') return CLASS_NAMES;
    if (!teacherData) return [];

    const classes: string[] = [];
    if (teacherData.classTeacherOf) {
      const cls = teacherData.classTeacherOf.split('-')[0];
      if (!classes.includes(cls)) classes.push(cls);
    }
    if (teacherData.subjectAssignments && Array.isArray(teacherData.subjectAssignments)) {
      teacherData.subjectAssignments.forEach((a: any) => {
        const cls = a.class?.split('-')[0];
        if (cls && !classes.includes(cls)) classes.push(cls);
      });
    }
    return classes;
  };

  const addStudent = async () => {
    if (!name || !rollNumber || !parentPhone || !className || !section) {
      setMessage('❌ Please fill all required fields including Class and Section');
      return;
    }
    setLoading(true);
    setMessage('');

    try {
      const studentRef = await addDoc(collection(db, 'students'), {
        name, rollNumber,
        class: className,
        section, parentName, parentPhone,
        parentEmail: `parent_${parentPhone}@educonnect.com`,
        performanceCategory: 'Not Set',
        attendancePercentage: 0,
        createdAt: new Date()
      });

      const studentId = studentRef.id;
      const parentEmail = `parent_${parentPhone}@educonnect.com`;

      try {
        const parentCredential = await createUserWithEmailAndPassword(parentAuth, parentEmail, parentPhone);
        const parentData = {
          email: parentEmail, role: 'parent',
          displayName: parentName, phoneNumber: parentPhone,
          childId: studentId, childName: name,
          createdAt: new Date()
        };
        await setDoc(doc(db, 'users', parentCredential.user.uid), parentData);
        await setDoc(doc(parentDb, 'users', parentCredential.user.uid), parentData);
      } catch (e) {
        console.log('Parent account may already exist');
      }

      setMessage('✅ Student added successfully!');
      setName(''); setRollNumber(''); setClassName('');
      setSection(''); setParentName(''); setParentPhone('');
      fetchStudents();
    } catch (error) {
      setMessage('❌ Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (student: any) => {
    setEditingStudent({ ...student });
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingStudent) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'students', editingStudent.id), {
        ...editingStudent, updatedAt: new Date()
      });
      setMessage('✅ Student updated!');
      setIsEditModalOpen(false);
      fetchStudents();
    } catch (error) {
      setMessage('❌ Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Delete "${studentName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'students', studentId));
      setMessage(`✅ "${studentName}" deleted`);
      fetchStudents();
    } catch (error) {
      setMessage('❌ Failed to delete');
    }
  };

  // Class stats for assigned classes only
  const classStats = CLASS_NAMES.flatMap(cls =>
    SECTIONS.map(sec => ({
      classId: `${cls}-${sec}`,
      count: filteredStudents.filter(s => s.class === cls && s.section === sec).length
    }))
  ).filter(s => s.count > 0);

  const assignedClassesList = teacherData ? [
    teacherData.classTeacherOf,
    ...(teacherData.subjectAssignments || []).map((a: any) => a.class)
  ].filter(Boolean) : [];

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 pb-24">

        <h1 className="text-3xl font-bold mb-4">👨‍🎓 Student Management</h1>

        {/* Teacher assignment info */}
        {role === 'teacher' && (
          <div className="bg-gray-800 rounded-xl p-4 mb-6 border-l-4 border-blue-500">
            <p className="text-blue-400 font-bold text-sm mb-1">Your Assigned Classes:</p>
            {assignedClassesList.length === 0 ? (
              <p className="text-gray-400 text-sm">Not yet assigned to any class. Contact admin.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[...new Set(assignedClassesList)].map((cls: any) => (
                  <span key={cls} className="bg-blue-900 px-3 py-1 rounded-full text-sm text-blue-300">
                    Class {cls}
                    {teacherData?.classTeacherOf === cls && ' (Class Teacher)'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Class stats */}
        {classStats.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold mb-3 text-gray-400">📊 Students per Class</h2>
            <div className="flex flex-wrap gap-2">
              {classStats.map(stat => (
                <div key={stat.classId}
                  onClick={() => {
                    const [cls, sec] = stat.classId.split('-');
                    setFilterClass(cls === filterClass ? '' : cls);
                    setFilterSection(sec === filterSection ? '' : sec);
                  }}
                  className={`px-4 py-2 rounded-xl cursor-pointer transition text-sm font-medium ${
                    filterClass === stat.classId.split('-')[0] ? 'bg-blue-600' : 'bg-gray-800 hover:bg-blue-700'
                  }`}>
                  Class {stat.classId}: <span className="text-blue-300 font-bold">{stat.count}</span>
                </div>
              ))}
              {(filterClass || filterSection) && (
                <button onClick={() => { setFilterClass(''); setFilterSection(''); }}
                  className="bg-red-800 px-4 py-2 rounded-xl text-sm hover:bg-red-700 transition">
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add Student — Admin Only */}
        {role === 'admin' && (
          <div className="bg-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold mb-2">Add New Student</h2>
            <p className="text-gray-400 text-sm mb-4">
              Parent account auto-created. Default password = phone number.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input placeholder="Student Name *" value={name}
                onChange={e => setName(e.target.value)}
                className="bg-gray-700 p-3 rounded-xl outline-none" />
              <input placeholder="Roll Number *" value={rollNumber}
                onChange={e => setRollNumber(e.target.value)}
                className="bg-gray-700 p-3 rounded-xl outline-none" />
              <select value={className} onChange={e => setClassName(e.target.value)}
                className="bg-gray-700 p-3 rounded-xl outline-none text-white">
                <option value="">Select Class *</option>
                {CLASS_NAMES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
              <select value={section} onChange={e => setSection(e.target.value)}
                className="bg-gray-700 p-3 rounded-xl outline-none text-white">
                <option value="">Select Section *</option>
                {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
              <input placeholder="Parent Name" value={parentName}
                onChange={e => setParentName(e.target.value)}
                className="bg-gray-700 p-3 rounded-xl outline-none" />
              <input placeholder="Parent Phone *" value={parentPhone}
                onChange={e => setParentPhone(e.target.value)}
                type="tel" className="bg-gray-700 p-3 rounded-xl outline-none" />
            </div>
            <button onClick={addStudent} disabled={loading}
              className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold disabled:opacity-50">
              {loading ? '⏳ Adding...' : 'Add Student'}
            </button>
            {message && (
              <p className={`mt-3 text-sm ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {message}
              </p>
            )}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            className="bg-gray-700 p-2 rounded-xl outline-none text-white text-sm">
            <option value="">All Classes</option>
            {getAssignedClasses().map(c => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
            className="bg-gray-700 p-2 rounded-xl outline-none text-white text-sm">
            <option value="">All Sections</option>
            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <span className="text-gray-400 text-sm">
            Showing {filteredStudents.length} students
            {filterClass && ` | Class ${filterClass}${filterSection ? `-${filterSection}` : ''}`}
          </span>
        </div>

        {/* Student Table */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden">
          <h2 className="text-xl font-bold p-5 border-b border-gray-700">Student List</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Roll No</th>
                  <th className="p-4 text-left">Class</th>
                  <th className="p-4 text-left">Section</th>
                  <th className="p-4 text-left">Parent</th>
                  <th className="p-4 text-left">Performance</th>
                  {role === 'admin' && <th className="p-4 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      {role === 'teacher' && assignedClassesList.length === 0
                        ? '⚠️ You are not assigned to any class yet. Contact admin.'
                        : 'No students found.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr key={student.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="p-4 font-medium">{student.name}</td>
                      <td className="p-4">{student.rollNumber}</td>
                      <td className="p-4">{student.class}</td>
                      <td className="p-4">{student.section}</td>
                      <td className="p-4">{student.parentName || '-'}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          student.performanceCategory === 'Excellent' ? 'bg-green-600' :
                          student.performanceCategory === 'Good' ? 'bg-blue-600' :
                          student.performanceCategory === 'Average' ? 'bg-yellow-600' :
                          student.performanceCategory === 'Poor' ? 'bg-red-600' : 'bg-gray-600'
                        }`}>
                          {student.performanceCategory || 'Not Set'}
                        </span>
                      </td>
                      {role === 'admin' && (
                        <td className="p-4">
                          <button onClick={() => openEditModal(student)}
                            className="text-blue-400 hover:text-blue-300 mr-4 text-sm">✏️ Edit</button>
                          <button onClick={() => deleteStudent(student.id, student.name)}
                            className="text-red-400 hover:text-red-300 text-sm">🗑️ Delete</button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Edit Student</h2>
            <div className="space-y-4">
              <input value={editingStudent.name}
                onChange={e => setEditingStudent({...editingStudent, name: e.target.value})}
                className="w-full bg-gray-700 p-3 rounded-xl outline-none" placeholder="Student Name" />
              <input value={editingStudent.rollNumber}
                onChange={e => setEditingStudent({...editingStudent, rollNumber: e.target.value})}
                className="w-full bg-gray-700 p-3 rounded-xl outline-none" placeholder="Roll Number" />
              <select value={editingStudent.class || ''}
                onChange={e => setEditingStudent({...editingStudent, class: e.target.value})}
                className="w-full bg-gray-700 p-3 rounded-xl outline-none text-white">
                <option value="">Select Class</option>
                {CLASS_NAMES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
              <select value={editingStudent.section || ''}
                onChange={e => setEditingStudent({...editingStudent, section: e.target.value})}
                className="w-full bg-gray-700 p-3 rounded-xl outline-none text-white">
                <option value="">Select Section</option>
                {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
              <input value={editingStudent.parentName || ''}
                onChange={e => setEditingStudent({...editingStudent, parentName: e.target.value})}
                className="w-full bg-gray-700 p-3 rounded-xl outline-none" placeholder="Parent Name" />
              <input value={editingStudent.parentPhone || ''}
                onChange={e => setEditingStudent({...editingStudent, parentPhone: e.target.value})}
                className="w-full bg-gray-700 p-3 rounded-xl outline-none" placeholder="Parent Phone" />
              <select value={editingStudent.performanceCategory || 'Not Set'}
                onChange={e => setEditingStudent({...editingStudent, performanceCategory: e.target.value})}
                className="w-full bg-gray-700 p-3 rounded-xl outline-none text-white">
                <option value="Not Set">Not Set</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Average">Average</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveEdit} disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded-xl font-bold">
                Save Changes
              </button>
              <button onClick={() => setIsEditModalOpen(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 py-3 rounded-xl font-bold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}