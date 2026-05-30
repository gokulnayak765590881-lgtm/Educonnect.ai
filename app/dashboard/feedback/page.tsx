'use client';
import { useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';

export default function Feedback() {
  const [studentName, setStudentName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [reading, setReading] = useState('');
  const [writing, setWriting] = useState('');
  const [behaviour, setBehaviour] = useState('');
  const [participation, setParticipation] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const generateFeedback = async () => {
    if (!studentName) return;
    setLoading(true);

    const prompt = `Write a professional school feedback letter for parents about their child named ${studentName}.

Rules:
- Start with: "Dear Parent/Guardian,"
- Do NOT use any markdown, asterisks (*), bold formatting, or bullet points
- Write in plain paragraph format only
- Include overall assessment, positive encouragement, and improvement suggestions naturally in the paragraphs
- End with: "Best Regards," followed by a new line with "${teacherName || 'Class Teacher'}"
- Keep it warm, professional, and under 150 words

Student details:
Reading: ${reading}
Writing: ${writing}
Behaviour: ${behaviour}
Participation: ${participation}
Areas needing improvement: ${weaknesses}`;

    try {
      const response = await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();

      // Clean any remaining markdown symbols
      const cleanFeedback = data.feedback
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/##/g, '')
        .replace(/#{1,6}/g, '')
        .trim();

      setFeedback(cleanFeedback);

      // Find student's parentPhone to link feedback
      const studentsSnap = await getDocs(
        query(collection(db, 'students'), where('name', '==', studentName))
      );

      let parentPhone = '';
      if (!studentsSnap.empty) {
        parentPhone = studentsSnap.docs[0].data().parentPhone || '';
      }

      // Save feedback with parentPhone for filtering
      await addDoc(collection(db, 'feedback'), {
        studentName,
        teacherName: teacherName || 'Class Teacher',
        reading, writing, behaviour,
        participation, weaknesses,
        feedbackText: cleanFeedback,
        parentPhone,
        createdAt: new Date()
      });

    } catch (error) {
      setFeedback('Error generating feedback. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{display: 'flex', minHeight: '100vh', backgroundColor: '#111827', color: 'white'}}>
      <Sidebar />
      <div style={{flex: 1, padding: '16px', paddingBottom: '80px', maxWidth: '100%', overflowX: 'hidden'}}>
        <h1 style={{fontSize: '22px', fontWeight: 'bold', marginBottom: '16px'}}>🤖 AI Feedback Generator</h1>

        <div style={{backgroundColor: '#1f2937', padding: '16px', borderRadius: '12px', marginBottom: '16px'}}>
          <h2 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '12px'}}>Student Details</h2>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <input placeholder="Student Name" value={studentName}
              onChange={e => setStudentName(e.target.value)}
              style={{padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', width: '100%', boxSizing: 'border-box'}} />
            <input placeholder="Teacher Name" value={teacherName}
              onChange={e => setTeacherName(e.target.value)}
              style={{padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', width: '100%', boxSizing: 'border-box'}} />
            <select value={reading} onChange={e => setReading(e.target.value)}
              style={{padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', width: '100%'}}>
              <option value="">Reading Skill</option>
              <option>Excellent</option><option>Good</option>
              <option>Average</option><option>Needs Improvement</option>
            </select>
            <select value={writing} onChange={e => setWriting(e.target.value)}
              style={{padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', width: '100%'}}>
              <option value="">Writing Skill</option>
              <option>Excellent</option><option>Good</option>
              <option>Average</option><option>Needs Improvement</option>
            </select>
            <select value={behaviour} onChange={e => setBehaviour(e.target.value)}
              style={{padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', width: '100%'}}>
              <option value="">Behaviour</option>
              <option>Excellent</option><option>Good</option>
              <option>Average</option><option>Needs Improvement</option>
            </select>
            <select value={participation} onChange={e => setParticipation(e.target.value)}
              style={{padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', width: '100%'}}>
              <option value="">Participation</option>
              <option>Very Active</option><option>Active</option>
              <option>Moderate</option><option>Passive</option>
            </select>
            <input placeholder="Weaknesses (e.g. Math, Reading)" value={weaknesses}
              onChange={e => setWeaknesses(e.target.value)}
              style={{padding: '12px', borderRadius: '8px', backgroundColor: '#374151', color: 'white', border: 'none', width: '100%', boxSizing: 'border-box'}} />
            <button onClick={generateFeedback} disabled={loading}
              style={{padding: '14px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', width: '100%'}}>
              {loading ? '⏳ Generating...' : '🤖 Generate AI Feedback'}
            </button>
          </div>
        </div>

        <div style={{backgroundColor: '#1f2937', padding: '16px', borderRadius: '12px'}}>
          <h2 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '12px'}}>Generated Feedback</h2>
          {feedback ? (
            <div style={{backgroundColor: '#374151', padding: '16px', borderRadius: '8px'}}>
              <p style={{color: '#e5e7eb', lineHeight: '1.9', fontSize: '14px', whiteSpace: 'pre-line'}}>
                {feedback}
              </p>
            </div>
          ) : (
            <p style={{color: '#9ca3af', fontSize: '14px'}}>
              Fill in the details above and click Generate to create AI feedback.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}