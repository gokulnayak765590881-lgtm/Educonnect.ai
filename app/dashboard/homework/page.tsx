'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import Sidebar from '../../components/Sidebar';

export default function Homework() {
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saved, setSaved] = useState(false);

  const fetchHomework = async () => {
    const snapshot = await getDocs(collection(db, 'homework'));

    setHomeworks(
      snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.seconds
            ? new Date(data.dueDate.seconds * 1000).toLocaleDateString()
            : data.dueDate || '',
          createdAt:
            data.createdAt?.toDate?.()?.toLocaleDateString() || '',
        };
      })
    );
  };

  useEffect(() => {
    fetchHomework();
  }, []);

  const addHomework = async () => {
    if (!title || !dueDate) return;

    await addDoc(collection(db, 'homework'), {
      title,
      description,
      class: className,
      section,
      dueDate,
      status: 'Pending',
      createdAt: new Date(),
    });

    setTitle('');
    setDescription('');
    setClassName('');
    setSection('');
    setDueDate('');

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);

    fetchHomework();
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-white overflow-x-hidden">
      
      <Sidebar />

      <div className="flex-1 p-4 md:p-8 w-full">

        {/* Heading */}
        <h1 className="text-2xl md:text-4xl font-bold mb-6">
          Homework Management
        </h1>

        {/* Form Section */}
        <div className="bg-gray-800 rounded-2xl p-4 md:p-6 mb-6 shadow-lg w-full">

          <h2 className="text-xl md:text-2xl font-semibold mb-5">
            Add New Homework
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <input
              type="text"
              placeholder="Homework Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-700 text-white outline-none text-sm md:text-base"
            />

            <input
              type="text"
              placeholder="Class"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-700 text-white outline-none text-sm md:text-base"
            />

            <input
              type="text"
              placeholder="Section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-700 text-white outline-none text-sm md:text-base"
            />

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-700 text-white outline-none text-sm md:text-base"
            />

            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="md:col-span-2 w-full p-3 rounded-xl bg-gray-700 text-white outline-none text-sm md:text-base resize-none"
            />

          </div>

          {/* Button */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 mt-5">

            <button
              onClick={addHomework}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 transition-all px-6 py-3 rounded-xl font-medium"
            >
              Add Homework
            </button>

            {saved && (
              <p className="text-green-400 text-sm md:text-base">
                ✅ Homework Added Successfully
              </p>
            )}
          </div>
        </div>

        {/* Homework Table */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-lg w-full">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[650px] border-collapse">

              <thead className="bg-gray-700">

                <tr>
                  <th className="p-4 text-left text-sm md:text-base">
                    Title
                  </th>

                  <th className="p-4 text-left text-sm md:text-base">
                    Class
                  </th>

                  <th className="p-4 text-left text-sm md:text-base">
                    Section
                  </th>

                  <th className="p-4 text-left text-sm md:text-base">
                    Due Date
                  </th>

                  <th className="p-4 text-left text-sm md:text-base">
                    Status
                  </th>
                </tr>

              </thead>

              <tbody>

                {homeworks.length > 0 ? (
                  homeworks.map((hw) => (
                    <tr
                      key={hw.id}
                      className="border-t border-gray-700 hover:bg-gray-700/40 transition"
                    >

                      <td className="p-4 text-sm md:text-base">
                        {hw.title}
                      </td>

                      <td className="p-4 text-sm md:text-base">
                        {hw.class}
                      </td>

                      <td className="p-4 text-sm md:text-base">
                        {hw.section}
                      </td>

                      <td className="p-4 text-sm md:text-base">
                        {hw.dueDate}
                      </td>

                      <td className="p-4">
                        <span className="bg-yellow-600 text-white text-xs md:text-sm px-3 py-1 rounded-full">
                          {hw.status}
                        </span>
                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-gray-400"
                    >
                      No homework added yet.
                    </td>
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